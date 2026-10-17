import { type Admission, type Decision, type ProtectionStore, ProtectionError } from "./types.ts";
/** Explicit development/test backend only. Synchronous mutation before Promise return
 * gives deterministic atomic semantics within this process, never across instances. */
export class LocalProtectionStore implements ProtectionStore {
  private values = new Map<string, { value: string; until: number }>();
  private leases = new Map<string, Map<string, number>>();
  private now: () => number;
  constructor(now = Date.now) { this.now = now; }
  private clean() {
    const time = this.now();
    for (const [key, value] of this.values) if (value.until <= time) this.values.delete(key);
    for (const [key, entries] of this.leases) { for (const [token, until] of entries) if (until <= time) entries.delete(token); if (!entries.size) this.leases.delete(key); }
    if (this.values.size + this.leases.size > 10000) throw new ProtectionError("SECURITY_UNAVAILABLE", 503);
  }
  async admit(input: Admission): Promise<Decision> {
    this.clean(); const time = this.now(), deny = (code: Decision["code"], ms: number): Decision => ({ allowed: false, code, retryAfter: Math.max(1, Math.ceil(ms / 1000)) });
    const blocked = input.blockKey && this.values.get(input.blockKey);
    if (blocked) return deny("PROVIDER_QUOTA", blocked.until - time);
    if (input.lock) { const lock = this.values.get(input.lock.key); if (lock) return deny("REQUEST_IN_PROGRESS", lock.until - time); }
    if (input.concurrency) { const entries = this.leases.get(input.concurrency.key); if (entries && entries.size >= input.concurrency.limit) return deny("RATE_LIMIT", Math.min(...entries.values()) - time); }
    for (const counter of input.counters) { const saved = this.values.get(counter.key); if (Number(saved?.value ?? 0) + counter.amount > counter.limit) return deny(counter.code, saved ? saved.until - time : counter.windowMs); }
    for (const counter of input.counters) { const saved = this.values.get(counter.key); this.values.set(counter.key, { value: String(Number(saved?.value ?? 0) + counter.amount), until: saved?.until ?? time + counter.windowMs }); }
    if (input.lock) this.values.set(input.lock.key, { value: input.lock.token, until: time + input.lock.ttlMs });
    if (input.concurrency) { const entries = this.leases.get(input.concurrency.key) ?? new Map<string, number>(); entries.set(input.concurrency.token, time + input.concurrency.ttlMs); this.leases.set(input.concurrency.key, entries); }
    return { allowed: true, retryAfter: 0 };
  }
  async release(lock?: Admission["lock"], concurrency?: Admission["concurrency"]) { if (lock && this.values.get(lock.key)?.value === lock.token) this.values.delete(lock.key); if (concurrency) this.leases.get(concurrency.key)?.delete(concurrency.token); }
  async get(key: string) { this.clean(); return this.values.get(key)?.value ?? null; }
  async set(key: string, value: string, ttlMs: number) { this.clean(); this.values.set(key, { value, until: this.now() + ttlMs }); }
}
