export type Endpoint = "ai" | "web";
export type LimitCode = "RATE_LIMIT" | "DAILY_LIMIT" | "MONTHLY_LIMIT" | "GENERATION_LIMIT" | "REQUEST_IN_PROGRESS" | "SECURITY_UNAVAILABLE" | "SECURITY_CONFIGURATION" | "CLIENT_IDENTITY" | "PROVIDER_QUOTA";
export class ProtectionError extends Error {
  code: LimitCode; status: number; retryAfter: number;
  constructor(code: LimitCode, status = 429, retryAfter = 60) { super(code); this.code = code; this.status = status; this.retryAfter = retryAfter; }
}
export type CounterRule = { key: string; limit: number; amount: number; windowMs: number; code: LimitCode };
export type Admission = { counters: CounterRule[]; lock?: { key: string; token: string; ttlMs: number }; concurrency?: { key: string; token: string; limit: number; ttlMs: number }; blockKey?: string };
export type Decision = { allowed: boolean; code?: LimitCode; retryAfter: number };
/** Implementations must check ALL gates before changing ANY counters or leases. */
export interface ProtectionStore {
  admit(input: Admission): Promise<Decision>;
  release(lock?: Admission["lock"], concurrency?: Admission["concurrency"]): Promise<void>;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlMs: number): Promise<void>;
}
