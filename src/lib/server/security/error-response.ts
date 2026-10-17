import { protectionMessages } from "../../api-protection-errors.ts";
import { ProtectionError } from "./types.ts";
export function protectionResponse(error: unknown): Response | null {
  if (!(error instanceof ProtectionError)) return null;
  return Response.json({ error: { code: error.code, message: protectionMessages[error.code] ?? "Достигнат е лимитът за генериране на рецепти за тази заявка.", retryable: error.status !== 403, retryAfter: error.retryAfter } }, { status: error.status, headers: { "Cache-Control": "no-store", ...(error.retryAfter > 0 ? { "Retry-After": String(error.retryAfter) } : {}) } });
}
