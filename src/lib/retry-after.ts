/** HTTP delay-seconds or HTTP-date. Bounded to a calendar month's maximum. */
export function retryAfterSeconds(value: string | null, now = Date.now()): number {
  if (!value) return 0;
  const seconds = /^\d+$/u.test(value.trim()) ? Number(value) : Math.ceil((Date.parse(value) - now) / 1000);
  return Number.isFinite(seconds) ? Math.max(0, Math.min(2678400, seconds)) : 0;
}
type Cooldown = { until: number; code: string; status: number };
const cooldowns = new Map<"ai" | "web", Cooldown>();
export function recordCooldown(endpoint: "ai" | "web", code: string, status: number, seconds: number, now = Date.now()) { if ((status === 429 || code === "PROVIDER_QUOTA") && seconds > 0) cooldowns.set(endpoint, { until: now + seconds * 1000, code, status }); }
export function readCooldown(endpoint: "ai" | "web", now = Date.now()) { const item = cooldowns.get(endpoint); if (!item) return null; if (item.until <= now) { cooldowns.delete(endpoint); return null; } return { ...item, seconds: Math.ceil((item.until - now) / 1000) }; }
