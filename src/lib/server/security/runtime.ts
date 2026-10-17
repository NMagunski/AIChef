import "server-only";
import { readSecurityConfig } from "./config";
import { LocalProtectionStore } from "./local-store";
import { RedisRestProtectionStore } from "./redis-store";
import { SecurityController } from "./controller";
let controller: SecurityController | undefined;
export function getSecurityController() {
  if (controller) return controller;
  const config = readSecurityConfig(process.env);
  const store = config.mode === "redis" ? new RedisRestProtectionStore(config.redisUrl!, config.redisToken!) : new LocalProtectionStore();
  return controller = new SecurityController(config, store);
}
