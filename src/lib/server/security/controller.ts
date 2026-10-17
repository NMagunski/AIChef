import { AsyncLocalStorage } from "node:async_hooks";
import { randomUUID } from "node:crypto";
import { type CounterRule, type Endpoint, type ProtectionStore, ProtectionError } from "./types.ts";
import type { SecurityConfig } from "./config.ts";
import { clientIdentity, privateKey } from "./identity.ts";
import { quotaRules } from "./quotas.ts";
export class SecurityController {
  readonly config: SecurityConfig;
  private store: ProtectionStore; private now: () => number;
  private context = new AsyncLocalStorage<string>();
  constructor(config: SecurityConfig, store: ProtectionStore, now = Date.now) { this.config = config; this.store = store; this.now = now; }
  private prefix() { return `{${this.config.namespace}}:security:v1`; }
  async request(request: Request, endpoint: Endpoint): Promise<string> {
    const client = clientIdentity(request, this.config), prefix = this.prefix(), limits = this.config[endpoint];
    const decision = await this.store.admit({ counters: [
      { key: `${prefix}:rate:${endpoint}:client:${client}`, amount: 1, limit: limits.clientMinute, windowMs: 60000, code: "RATE_LIMIT" },
      { key: `${prefix}:rate:${endpoint}:global`, amount: 1, limit: limits.globalMinute, windowMs: 60000, code: "RATE_LIMIT" },
    ] });
    if (!decision.allowed) throw new ProtectionError(decision.code!, 429, decision.retryAfter);
    return client;
  }
  withClient<T>(client: string, work: () => Promise<T>) { return this.context.run(client, work); }
  currentClient() { return this.context.getStore() ?? privateKey("anonymous-shared", this.config.secret); }
  async execute<T>(endpoint: Endpoint, client: string, fingerprint: string, units: number, batch: number, work: () => Promise<T>, valid: (data: unknown) => data is T): Promise<T> {
    const prefix = this.prefix(), key = privateKey(`${endpoint}:${client}:${fingerprint}`, this.config.secret), cacheKey = `${prefix}:cache:${key}`;
    const raw = await this.store.get(cacheKey);
    if (raw && raw.length <= 2000000) { try { const value: unknown = JSON.parse(raw); if (valid(value)) return value; } catch { /* Never reuse malformed shared data. */ } }
    const token = randomUUID(), lock = { key: `${prefix}:lock:${key}`, token, ttlMs: 120000 }, concurrency = { key: `${prefix}:concurrency:${endpoint}`, token, limit: this.config[endpoint].concurrency, ttlMs: 120000 };
    const counters = quotaRules(prefix, endpoint, client, this.config, this.now(), units);
    counters.push({ key: `${prefix}:paid-rate:${endpoint}:client:${client}`, amount: 1, limit: this.config[endpoint].clientMinute, windowMs: 60000, code: "RATE_LIMIT" }, { key: `${prefix}:paid-rate:${endpoint}:global`, amount: 1, limit: this.config[endpoint].globalMinute, windowMs: 60000, code: "RATE_LIMIT" });
    if (endpoint === "ai") counters.push({ key: `${prefix}:attempt:${key}`, amount: 1, limit: batch ? 1 : 2, windowMs: 86400000, code: "GENERATION_LIMIT" } satisfies CounterRule);
    const decision = await this.store.admit({ counters, lock, concurrency, blockKey: `${prefix}:provider-block:${endpoint}` });
    if (!decision.allowed) throw new ProtectionError(decision.code!, decision.code === "PROVIDER_QUOTA" ? 503 : 429, decision.retryAfter);
    try {
      // A second cache read closes the cache-miss / prior-lock-release race.
      // Reservations are deliberately not refunded if another worker just filled it.
      const latest = await this.store.get(cacheKey);
      if (latest && latest.length <= 2000000) { try { const value: unknown = JSON.parse(latest); if (valid(value)) return value; } catch { /* Invalid cache is not usable. */ } }
      const value = await this.withClient(client, work);
      if (!valid(value)) throw new ProtectionError("SECURITY_UNAVAILABLE", 503);
      const data = JSON.stringify(value);
      if (data.length <= 2000000) await this.store.set(cacheKey, data, endpoint === "ai" ? 600000 : 300000);
      return value;
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && ["INSUFFICIENT_QUOTA", "AUTHENTICATION_ERROR", "QUOTA", "AUTHENTICATION"].includes(String(error.code))) await this.store.set(`${prefix}:provider-block:${endpoint}`, "blocked", 300000);
      throw error;
    } finally {
      // A failed cleanup cannot bypass quotas; leases expire after a bounded interval.
      try { await this.store.release(lock, concurrency); } catch { /* TTL recovery, fail closed on next admission. */ }
    }
  }
}
