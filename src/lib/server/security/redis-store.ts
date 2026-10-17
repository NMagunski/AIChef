import { z } from "zod";
import { type Admission, type Decision, type ProtectionStore, ProtectionError } from "./types.ts";
/** KEYS all share one configured Redis hash tag. Redis TIME owns expiry, not client clocks.
 * Check first, then increment every counter / acquire leases in ONE atomic EVAL. */
export const admissionScript = `
local config = cjson.decode(ARGV[1])
local clock = redis.call('TIME')
local now = tonumber(clock[1])*1000 + math.floor(tonumber(clock[2])/1000)
local function deny(code, ms) return cjson.encode({allowed=false,code=code,retryAfter=math.max(1,math.ceil(ms/1000))}) end
if config.block > 0 and redis.call('EXISTS', KEYS[config.block]) == 1 then return deny('PROVIDER_QUOTA', redis.call('PTTL', KEYS[config.block])) end
if config.lock > 0 and redis.call('EXISTS', KEYS[config.lock]) == 1 then return deny('REQUEST_IN_PROGRESS', redis.call('PTTL', KEYS[config.lock])) end
if config.concurrent > 0 then
 redis.call('ZREMRANGEBYSCORE', KEYS[config.concurrent], '-inf', now)
 if redis.call('ZCARD', KEYS[config.concurrent]) >= config.concurrentLimit then
  local first = redis.call('ZRANGE', KEYS[config.concurrent], 0, 0, 'WITHSCORES')
  return deny('RATE_LIMIT', tonumber(first[2])-now)
 end
end
for _, rule in ipairs(config.rules) do
 local value = tonumber(redis.call('GET', KEYS[rule.index]) or '0')
 if value + rule.amount > rule.limit then
  local ttl = redis.call('PTTL', KEYS[rule.index])
  if ttl < 1 then ttl = rule.windowMs end
  return deny(rule.code, ttl)
 end
end
for _, rule in ipairs(config.rules) do
 local value = redis.call('INCRBY', KEYS[rule.index], rule.amount)
 if value == rule.amount then redis.call('PEXPIRE', KEYS[rule.index], rule.windowMs) end
end
if config.lock > 0 then redis.call('SET', KEYS[config.lock], config.token, 'PX', config.lockTtl) end
if config.concurrent > 0 then
 redis.call('ZADD', KEYS[config.concurrent], now + config.concurrentTtl, config.token)
 redis.call('PEXPIRE', KEYS[config.concurrent], config.concurrentTtl)
end
return cjson.encode({allowed=true,retryAfter=0})
`;
export const releaseScript = `
local config = cjson.decode(ARGV[1])
if config.lock > 0 and redis.call('GET', KEYS[config.lock]) == config.lockToken then redis.call('DEL', KEYS[config.lock]) end
if config.concurrent > 0 then redis.call('ZREM', KEYS[config.concurrent], config.concurrentToken) end
return 1
`;
const decisionSchema = z.object({ allowed: z.boolean(), code: z.enum(["RATE_LIMIT", "DAILY_LIMIT", "MONTHLY_LIMIT", "GENERATION_LIMIT", "REQUEST_IN_PROGRESS", "PROVIDER_QUOTA"]).optional(), retryAfter: z.number().int().min(0).max(2678400) });
export class RedisRestProtectionStore implements ProtectionStore {
  private url: string; private token: string; private send: typeof fetch; private timeoutMs: number;
  constructor(url: string, token: string, send: typeof fetch = fetch, timeoutMs = 2000) { this.timeoutMs = timeoutMs; this.url = url; this.token = token; this.send = send; }
  private async command(args: (string | number)[]): Promise<unknown> {
    try {
      const signal = AbortSignal.timeout(this.timeoutMs);
      const work = (async () => {
        const response = await this.send(this.url, { method: "POST", headers: { Authorization: `Bearer ${this.token}`, "Content-Type": "application/json" }, body: JSON.stringify(args), signal, redirect: "error", cache: "no-store" });
        if (!response.ok) throw Error("Unavailable");
        const reader = response.body?.getReader(); if (!reader) throw Error("No body");
        let size = 0; const chunks: Uint8Array[] = [];
        try { for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > 3000000) { await reader.cancel(); throw Error("Too large"); } chunks.push(value); } } finally { reader.releaseLock(); }
        const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (payload.error || !("result" in payload)) throw Error("Invalid response");
        return payload.result as unknown;
      })();
      const deadline = new Promise<never>((_, reject) => { if (signal.aborted) reject(Error("Timeout")); else signal.addEventListener("abort", () => reject(Error("Timeout")), { once: true }); });
      return await Promise.race([work, deadline]);
    } catch { throw new ProtectionError("SECURITY_UNAVAILABLE", 503, 30); }
  }
  async admit(input: Admission): Promise<Decision> {
    const keys: string[] = [], index = (key?: string) => key ? keys.push(key) : 0;
    const rules = input.counters.map((rule) => ({ ...rule, index: index(rule.key) }));
    const config = { rules, block: index(input.blockKey), lock: index(input.lock?.key), concurrent: index(input.concurrency?.key), token: input.lock?.token ?? input.concurrency?.token ?? "", lockTtl: input.lock?.ttlMs ?? 0, concurrentTtl: input.concurrency?.ttlMs ?? 0, concurrentLimit: input.concurrency?.limit ?? 0 };
    const raw = await this.command(["EVAL", admissionScript, keys.length, ...keys, JSON.stringify(config)]);
    try { const result = decisionSchema.parse(typeof raw === "string" ? JSON.parse(raw) : raw); if (!result.allowed && !result.code) throw Error("Missing code"); return result; } catch { throw new ProtectionError("SECURITY_UNAVAILABLE", 503); }
  }
  async release(lock?: Admission["lock"], concurrency?: Admission["concurrency"]) {
    if (!lock && !concurrency) return;
    const keys: string[] = [], config = { lock: lock ? keys.push(lock.key) : 0, concurrent: concurrency ? keys.push(concurrency.key) : 0, lockToken: lock?.token ?? "", concurrentToken: concurrency?.token ?? "" };
    await this.command(["EVAL", releaseScript, keys.length, ...keys, JSON.stringify(config)]);
  }
  async get(key: string) { const value = await this.command(["GET", key]); if (value === null || typeof value === "string") return value; throw new ProtectionError("SECURITY_UNAVAILABLE", 503); }
  async set(key: string, value: string, ttlMs: number) { await this.command(["SET", key, value, "PX", ttlMs]); }
}
