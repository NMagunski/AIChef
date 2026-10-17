import { createHmac, timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { SecurityConfig } from "./config.ts";
import { ProtectionError } from "./types.ts";
export function privateKey(value: string, secret: string) { return createHmac("sha256", secret).update(value).digest("hex"); }
export function clientIdentity(request: Request, config: SecurityConfig): string {
  let identity = "anonymous-shared";
  if (config.identity === "trusted-proxy") {
    const actual = Buffer.from(request.headers.get("x-aichef-proxy-secret") ?? ""), expected = Buffer.from(config.proxySecret ?? "");
    if (!expected.length || actual.length !== expected.length || !timingSafeEqual(actual, expected)) throw new ProtectionError("CLIENT_IDENTITY", 403, 0);
    const ip = request.headers.get(config.proxyHeader)?.trim() ?? "";
    if (!isIP(ip)) throw new ProtectionError("CLIENT_IDENTITY", 403, 0);
    // Canonicalize IPv6 textual aliases to prevent alternate spelling buckets.
    identity = isIP(ip) === 6 ? new URL(`http://[${ip}]/`).hostname : ip;
  }
  return privateKey(identity, config.secret);
}
