import { readSecurityConfig } from "../../src/lib/server/security/config.ts";
import { SecurityController } from "../../src/lib/server/security/controller.ts";
import { LocalProtectionStore } from "../../src/lib/server/security/local-store.ts";
export const securityConfig = (env: Record<string, string | undefined> = {}) => readSecurityConfig({ NODE_ENV: "test", API_SECURITY_MODE: "local", API_IDENTITY_SECRET: "synthetic-secret-for-deterministic-tests-only", ...env });
export function securityFixture(env: Record<string, string | undefined> = {}, initial = Date.UTC(2026, 0, 15, 12)) {
  let time = initial; const config = securityConfig(env), store = new LocalProtectionStore(() => time);
  return { config, store, now: () => time, advance: (ms: number) => { time += ms; }, create: () => new SecurityController(config, store, () => time) };
}
export const safeValue = (data: unknown): data is { value: string } => !!data && typeof data === "object" && "value" in data && typeof data.value === "string";
