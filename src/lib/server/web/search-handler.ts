import type { SecurityController } from "../security/controller.ts";
import { ProtectionError } from "../security/types.ts";
import { protectionResponse } from "../security/error-response.ts";
import { z } from "zod";
import type { WebSearchPage } from "../../web/types.ts";
import { WebSearchError, webErrorMessages } from "../../web/errors.ts";
const requestSchema = z.object({ query: z.string().trim().min(1).max(500), cursor: z.string().regex(/^(?:[0-9]0|0):[0-9]$/u).max(10).nullable().optional() }).strict();
export function createWebSearchHandler(search: (query: string, cursor?: string | null) => Promise<WebSearchPage>, security?: () => SecurityController) {
  let requests = 0, resetAt = 0;
  return async function POST(request: Request): Promise<Response> {
    try {
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin) throw new WebSearchError("INVALID_REQUEST", 403);
      if (!request.headers.get("content-type")?.includes("application/json")) throw new WebSearchError("INVALID_REQUEST", 415);
      if (Number(request.headers.get("content-length") ?? 0) > 4096) throw new WebSearchError("INVALID_REQUEST", 400);
      const reader = request.body?.getReader(); if (!reader) throw new WebSearchError("INVALID_REQUEST", 400);
      const chunks: Uint8Array[] = []; let bytes = 0;
      try { for (;;) { const { done, value } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 4096) { await reader.cancel(); throw new WebSearchError("INVALID_REQUEST", 400); } chunks.push(value); } } finally { reader.releaseLock(); }
      const raw = Buffer.concat(chunks).toString("utf8");
      let body: unknown; try { body = JSON.parse(raw); } catch { throw new WebSearchError("INVALID_REQUEST", 400); }
      const parsed = requestSchema.safeParse(body); if (!parsed.success) throw new WebSearchError("INVALID_REQUEST", 400);
      if (!security && process.env.NODE_ENV === "production") throw new ProtectionError("SECURITY_CONFIGURATION", 503);
      const protection = security?.();
      const client = protection ? await protection.request(request, "web") : "";
      if (!protection && Date.now() >= resetAt) { requests = 0; resetAt = Date.now() + 60000; }
      if (!protection && ++requests > 30) throw new WebSearchError("RATE_LIMIT", 429, true);
      const result = await (protection ? protection.withClient(client, () => search(parsed.data.query, parsed.data.cursor)) : search(parsed.data.query, parsed.data.cursor));
      return Response.json(result, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const protectedResponse = protectionResponse(error); if (protectedResponse) return protectedResponse;
      const safe = error instanceof WebSearchError ? error : new WebSearchError("UNAVAILABLE", 502, true);
      return Response.json({ error: { code: safe.code, message: webErrorMessages[safe.code] ?? webErrorMessages.UNAVAILABLE, retryable: safe.retryable } }, { status: safe.status, headers: { "Cache-Control": "no-store", ...(safe.code === "RATE_LIMIT" ? { "Retry-After": "60" } : {}) } });
    }
  };
}
