import { ProtectionError } from "./types.ts";
export type EndpointLimits = { clientMinute: number; globalMinute: number; clientDaily: number; clientMonthly: number; globalDaily: number; globalMonthly: number; concurrency: number };
export type SecurityConfig = { mode: "local" | "redis"; namespace: string; secret: string; identity: "shared" | "trusted-proxy"; proxySecret?: string; proxyHeader: string; redisUrl?: string; redisToken?: string; ai: EndpointLimits; web: EndpointLimits; aiClientRecipesDaily: number; aiGlobalRecipesDaily: number; aiClientRecipesMonthly: number; aiGlobalRecipesMonthly: number; maxOutputTokens: number; webMaxPages: number };
export function integerSetting(env: Record<string, string | undefined>, key: string, fallback: number, max: number, min = 0) {
  const text = env[key]; if (text === undefined || text === "") return fallback;
  if (!/^\d+$/u.test(text) || !Number.isSafeInteger(Number(text)) || Number(text) < min || Number(text) > max) throw new ProtectionError("SECURITY_CONFIGURATION", 503);
  return Number(text);
}
export function readSecurityConfig(env: Record<string, string | undefined>): SecurityConfig {
  const localTest = env.API_SECURITY_MODE === "local-test" && env.RECIPE_SEARCH_MODE === "demo" && !env.OPENAI_API_KEY?.trim() && !env.SERPAPI_API_KEY?.trim();
  const mode = env.API_SECURITY_MODE ?? (env.NODE_ENV === "production" ? "redis" : "local");
  if (!["local", "local-test", "redis"].includes(mode) || (env.NODE_ENV === "production" && mode !== "redis" && !localTest)) throw new ProtectionError("SECURITY_CONFIGURATION", 503);
  const secret = env.API_IDENTITY_SECRET?.trim() || (mode !== "redis" ? "local-development-only-secret-not-for-production" : "");
  if (secret.length < 32) throw new ProtectionError("SECURITY_CONFIGURATION", 503);
  const identity = env.API_CLIENT_IDENTITY ?? "shared";
  if (!["shared", "trusted-proxy"].includes(identity)) throw new ProtectionError("SECURITY_CONFIGURATION", 503);
  const proxyHeader = env.API_TRUSTED_IP_HEADER ?? "x-real-ip";
  if (identity === "trusted-proxy" && (!/^(?:x-real-ip|cf-connecting-ip)$/u.test(proxyHeader) || (env.API_TRUSTED_PROXY_SECRET?.length ?? 0) < 32)) throw new ProtectionError("SECURITY_CONFIGURATION", 503);
  const namespace = env.API_SECURITY_NAMESPACE ?? "aichef";
  if (!/^[a-zA-Z0-9_-]{1,40}$/u.test(namespace)) throw new ProtectionError("SECURITY_CONFIGURATION", 503);
  if (mode === "redis") {
    try { const url = new URL(env.API_REDIS_REST_URL ?? ""); if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !env.API_REDIS_REST_TOKEN?.trim()) throw Error("Invalid backend"); } catch { throw new ProtectionError("SECURITY_CONFIGURATION", 503); }
  }
  const limits = (provider: "AI" | "WEB"): EndpointLimits => ({
    clientMinute: integerSetting(env, `${provider}_CLIENT_REQUESTS_PER_MINUTE`, provider === "AI" ? 5 : 10, 10000), globalMinute: integerSetting(env, `${provider}_GLOBAL_REQUESTS_PER_MINUTE`, 30, 100000),
    clientDaily: integerSetting(env, `${provider}_CLIENT_REQUESTS_PER_DAY`, provider === "AI" ? 20 : 50, 100000), clientMonthly: integerSetting(env, `${provider}_CLIENT_REQUESTS_PER_MONTH`, provider === "AI" ? 200 : 500, 1000000),
    globalDaily: integerSetting(env, `${provider}_GLOBAL_REQUESTS_PER_DAY`, provider === "AI" ? 500 : 1000, 1000000), globalMonthly: integerSetting(env, `${provider}_GLOBAL_REQUESTS_PER_MONTH`, provider === "AI" ? 5000 : 10000, 10000000), concurrency: integerSetting(env, `${provider}_MAX_CONCURRENT`, provider === "AI" ? 5 : 10, 100, 1),
  });
  return { mode: mode === "redis" ? "redis" : "local", namespace, secret, identity: identity as SecurityConfig["identity"], proxySecret: env.API_TRUSTED_PROXY_SECRET, proxyHeader, redisUrl: env.API_REDIS_REST_URL, redisToken: env.API_REDIS_REST_TOKEN,
    ai: limits("AI"), web: limits("WEB"), aiClientRecipesDaily: integerSetting(env, "AI_CLIENT_MAX_RECIPES_PER_DAY", 80, 100000), aiGlobalRecipesDaily: integerSetting(env, "AI_GLOBAL_MAX_RECIPES_PER_DAY", 2000, 1000000), aiClientRecipesMonthly: integerSetting(env, "AI_CLIENT_MAX_RECIPES_PER_MONTH", 800, 1000000), aiGlobalRecipesMonthly: integerSetting(env, "AI_GLOBAL_MAX_RECIPES_PER_MONTH", 20000, 10000000), maxOutputTokens: integerSetting(env, "OPENAI_MAX_OUTPUT_TOKENS", 16000, 32000, 256), webMaxPages: integerSetting(env, "WEB_MAX_PROVIDER_PAGES", 10, 10, 1) };
}
