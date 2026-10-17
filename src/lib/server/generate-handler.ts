import type { SecurityController } from "./security/controller.ts";
import { ProtectionError } from "./security/types.ts";
import { protectionResponse } from "./security/error-response.ts";
import { validateRecipe } from "../recipe-quality/validate-recipe.ts";
import { createHash } from "node:crypto";
import { GenerationError, generatedRecipeSchema, modelOutputSchema, normalizeRecipe, querySchema, understandQuery, validateModelRecipe } from "../ai/recipe-schema.ts";
import { errorMessages, mapGenerationError } from "../ai/errors.ts";
import type { ResolvedRecipe } from "../../types/recipe.ts";
import { aiBundleSchema, hybridRequestSchema, type AIBundle } from "../ai/hybrid.ts";

export const DEFAULT_MODEL = "gpt-5-mini";
export const REQUEST_TIMEOUT_MS = 45000;
export function readAIConfig(env: Record<string, string | undefined>) {
  if (!env.OPENAI_API_KEY?.trim()) throw new GenerationError("CONFIGURATION", 503);
  return { apiKey: env.OPENAI_API_KEY.trim(), model: env.OPENAI_MODEL?.trim() || DEFAULT_MODEL };
}
export type GenerateDependencies = {
  security?: () => SecurityController;
  config: () => { apiKey: string; model: string };
  generate: (query: string, config: { apiKey: string; model: string }, signal: AbortSignal, batch?: number) => Promise<unknown>;
  decode?: (output: unknown, query: string, model: string, batch: number) => AIBundle;
  maxExtraBatches?: () => number;
  now?: () => number;
  timeoutMs?: number;
};
async function readBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new GenerationError("MALFORMED_JSON", 400);
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8192) { await reader.cancel(); throw new GenerationError("TOO_LARGE", 413); }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    try { return JSON.parse(text) as unknown; } catch { throw new GenerationError("MALFORMED_JSON", 400); }
  } finally { reader.releaseLock(); }
}

/** Per-process, bounded MVP controls. NOT a production-wide distributed limiter. */
export function createGenerateHandler(dependencies: GenerateDependencies) {
  const now = dependencies.now ?? Date.now;
  type Payload = { recipe?: ResolvedRecipe; alternatives?: ResolvedRecipe[]; issues?: string[]; maxExtraBatches?: number };
  const cache = new Map<string, { until: number; payload: Payload }>();
  const inFlight = new Map<string, Promise<Payload>>();
  const clients = new Map<string, { count: number; until: number }>();
  let globalCount = 0, globalUntil = 0;
  function allow(identity: string) {
    const time = now();
    for (const [key, entry] of clients) if (entry.until <= time) clients.delete(key);
    if (time >= globalUntil) { globalCount = 0; globalUntil = time + 60000; }
    if (clients.size >= 512 && !clients.has(identity)) identity = "overflow";
    const entry = clients.get(identity) ?? { count: 0, until: time + 60000 };
    if (globalCount >= 30 || entry.count >= 5) throw new GenerationError("RATE_LIMIT", 429, true);
    globalCount++; entry.count++; clients.set(identity, entry);
  }
  return async function POST(request: Request): Promise<Response> {
    const headers = { "Cache-Control": "no-store", "Content-Type": "application/json" };
    try {
      const origin = request.headers.get("origin");
      if (origin && origin !== new URL(request.url).origin) return Response.json({ error: { code: "INVALID_REQUEST", message: errorMessages.INVALID_REQUEST, retryable: false } }, { status: 403, headers });
      if (!request.headers.get("content-type")?.includes("application/json")) throw new GenerationError("INVALID_REQUEST", 415);
      const body = await readBody(request);
      const parsed = (dependencies.decode ? hybridRequestSchema : querySchema).safeParse(body);
      if (!parsed.success) throw new GenerationError("INVALID_REQUEST", 400);
      const { query } = parsed.data;
      const batch = "batch" in parsed.data && typeof parsed.data.batch === "number" ? parsed.data.batch : 0;
      if (batch > (dependencies.maxExtraBatches?.() ?? 0)) throw new GenerationError("GENERATION_LIMIT", 422);
      const intent = understandQuery(query);
      if (intent.servings < 1 || intent.servings > 20 || (intent.maxMinutes !== null && intent.maxMinutes <= 0)) throw new GenerationError("CONSTRAINTS", 422);
      const config = dependencies.config();
      if (!dependencies.security && process.env.NODE_ENV === "production") throw new ProtectionError("SECURITY_CONFIGURATION", 503);
      const security = dependencies.security?.();
      const identity = security ? await security.request(request, "ai") : "anonymous";
      if (!security) allow(identity);
      const hash = createHash("sha256").update(JSON.stringify([identity, config.model, query.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("bg"), batch])).digest("hex");
      for (const [key, entry] of cache) if (entry.until <= now()) cache.delete(key);
      const cached = cache.get(hash);
      if (cached) {
        const recipes = [cached.payload.recipe, ...(cached.payload.alternatives ?? [])].filter((r) => r !== undefined);
        if (recipes.length && recipes.every((r) => generatedRecipeSchema.safeParse(r).success && validateRecipe(r, { query }).valid)) return Response.json(cached.payload, { headers });
        cache.delete(hash);
      }
      let pending = inFlight.get(hash);
      if (!pending) {
        if (inFlight.size >= 5) throw new GenerationError("RATE_LIMIT", 429, true);
        const work = async (): Promise<Payload> => {
          const controller = new AbortController();
          let timer: ReturnType<typeof setTimeout> | undefined;
          try {
            const output = await Promise.race([
              dependencies.generate(query, config, controller.signal, batch),
              new Promise<never>((_, reject) => { timer = setTimeout(() => { reject(new GenerationError("TIMEOUT", 504, true)); controller.abort(); }, dependencies.timeoutMs ?? REQUEST_TIMEOUT_MS); }),
            ]);
            if (dependencies.decode) {
              const payload = dependencies.decode(output, query, config.model, batch);
              if (!payload.recipe && !payload.alternatives.length) throw new GenerationError("INVALID_OUTPUT", 502, true);
              if (cache.size >= 100) cache.delete(cache.keys().next().value!);
              cache.set(hash, { payload, until: now() + 10 * 60_000 });
              return payload;
            }
            const decoded = modelOutputSchema.safeParse(output);
            if (!decoded.success) throw new GenerationError("INVALID_OUTPUT", 502, true);
            if (decoded.data.status === "clarification") throw new GenerationError("CONSTRAINTS", 422, false, decoded.data.clarification ?? undefined);
            const recipe = normalizeRecipe(validateModelRecipe(decoded.data.recipe, query), config.model);
            if (!generatedRecipeSchema.safeParse(recipe).success || !validateRecipe(recipe, { query }).valid) throw new GenerationError("INVALID_OUTPUT", 502, true);
            if (cache.size >= 100) cache.delete(cache.keys().next().value!);
            cache.set(hash, { payload: { recipe }, until: now() + 10 * 60_000 });
            return { recipe };
          } finally { if (timer) clearTimeout(timer); }
        };
        const validPayload = (value: unknown): value is Payload => {
          const parsed = aiBundleSchema.safeParse(value);
          return parsed.success && !!(parsed.data.recipe || parsed.data.alternatives.length) && [parsed.data.recipe, ...parsed.data.alternatives].filter((r) => r !== undefined).every((r) => validateRecipe(r, { query }).valid);
        };
        pending = security ? security.execute("ai", identity, hash, batch ? 2 : 3, batch, work, validPayload) : work();
        inFlight.set(hash, pending);
        void pending.finally(() => inFlight.delete(hash)).catch(() => {});
      }
      return Response.json(await pending, { headers });
    } catch (error) {
      const protectedResponse = protectionResponse(error); if (protectedResponse) return protectedResponse;
      const mapped = mapGenerationError(error);
      return Response.json({ error: { code: mapped.code, message: mapped.explanation ?? errorMessages[mapped.code] ?? errorMessages.UNAVAILABLE, retryable: mapped.retryable } }, { status: mapped.status, headers: { ...headers, ...(mapped.status === 429 ? { "Retry-After": "60" } : {}) } });
    }
  };
}
