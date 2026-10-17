import type { CounterRule, Endpoint } from "./types.ts";
import type { SecurityConfig } from "./config.ts";
export function quotaWindows(now: number) {
  const date = new Date(now), day = date.toISOString().slice(0, 10), month = day.slice(0, 7);
  return { day, month, dayMs: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + 1) - now, monthMs: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) - now };
}
export function quotaRules(prefix: string, provider: Endpoint, client: string, config: SecurityConfig, now: number, units: number): CounterRule[] {
  const limits = config[provider], windows = quotaWindows(now), rules: CounterRule[] = [];
  for (const [period, windowMs, clientLimit, globalLimit, code] of [[windows.day, windows.dayMs, limits.clientDaily, limits.globalDaily, "DAILY_LIMIT"], [windows.month, windows.monthMs, limits.clientMonthly, limits.globalMonthly, "MONTHLY_LIMIT"]] as const) {
    rules.push({ key: `${prefix}:quota:${provider}:${period}:client:${client}`, limit: clientLimit, amount: 1, windowMs, code }, { key: `${prefix}:quota:${provider}:${period}:global`, limit: globalLimit, amount: 1, windowMs, code });
    if (provider === "ai") rules.push({ key: `${prefix}:recipes:${period}:client:${client}`, limit: code === "DAILY_LIMIT" ? config.aiClientRecipesDaily : config.aiClientRecipesMonthly, amount: units, windowMs, code }, { key: `${prefix}:recipes:${period}:global`, limit: code === "DAILY_LIMIT" ? config.aiGlobalRecipesDaily : config.aiGlobalRecipesMonthly, amount: units, windowMs, code });
  }
  return rules;
}
/** Scenario estimate using caller-supplied rates, never a billing/spend guarantee. */
export function estimateTokenCost(inputTokens: number, outputTokens: number, inputUsdPerMillion: number, outputUsdPerMillion: number): number {
  if ([inputTokens, outputTokens, inputUsdPerMillion, outputUsdPerMillion].some((v) => !Number.isFinite(v) || v < 0)) throw new RangeError("Invalid estimate inputs");
  const amount = (inputTokens * inputUsdPerMillion + outputTokens * outputUsdPerMillion) / 1000000;
  if (!Number.isFinite(amount)) throw new RangeError("Estimate overflow");
  return amount;
}
