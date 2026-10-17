"use client";
import { retryAfterSeconds, recordCooldown, readCooldown } from "../retry-after";
import type { ResolvedRecipe } from "@/types/recipe";
import { GenerationError, generatedRecipeId } from "./recipe-schema";
import { generatedStoreEvent } from "./recipe-store";
import { aiBundleSchema, validateAIBundle, uniqueRecipes, type AIBundle } from "./hybrid";
import { readAIBundle, saveAIBundle } from "./bundle-store";
const requests = new Map<string, Promise<AIBundle>>();
export function requestAIBundle(query: string, retry = false, batch = 0): Promise<AIBundle> {
  const key = `${generatedRecipeId(query.trim().normalize("NFKC").replace(/\s+/gu, " ").toLocaleLowerCase("bg"))}:${batch}`;
  const pending = requests.get(key);
  if (pending) return pending;
  const request = (async () => {
    try {
      if (!retry) {
        const cached = readAIBundle(sessionStorage, key);
        if (cached) { const validated = validateAIBundle(cached, query); if (validated.recipe || validated.alternatives.length) return validated; }
      }
    } catch { /* A failed write below produces an actionable storage message. */ }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 55000);
    try {
      const cooldown = readCooldown("ai"); if (cooldown) throw new GenerationError(cooldown.code, cooldown.status, true, undefined, cooldown.seconds);
      let response: Response;
      try { response = await fetch("/api/recipes/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, ...(batch ? { batch } : {}) }), signal: controller.signal }); }
      catch { throw new GenerationError(controller.signal.aborted ? "TIMEOUT" : "NETWORK", 0, true); }
      let payload;
      try { payload = await response.json(); } catch { throw new GenerationError("INVALID_OUTPUT", 502, true); }
      if (!response.ok) {
        const error = payload?.error;
        const seconds = retryAfterSeconds(response.headers.get("Retry-After"));
        recordCooldown("ai", error?.code ?? "RATE_LIMIT", response.status, seconds);
        throw new GenerationError(typeof error?.code === "string" ? error.code : "SERVICE_UNAVAILABLE", response.status, error?.retryable === true && !["INSUFFICIENT_QUOTA", "AUTHENTICATION_ERROR", "GENERATION_LIMIT"].includes(error?.code), error?.code === "CONSTRAINTS" && typeof error.message === "string" ? error.message.slice(0, 2000) : undefined, seconds);
      }
      const parsed = aiBundleSchema.safeParse(payload);
      if (!parsed.success) throw new GenerationError("INVALID_OUTPUT", 502, true);
      parsed.data = validateAIBundle(parsed.data, query) as typeof parsed.data;
      if (!parsed.data.recipe && !parsed.data.alternatives.length) throw new GenerationError("INVALID_OUTPUT", 502, true);
      const distinct = uniqueRecipes([...(parsed.data.recipe ? [parsed.data.recipe] : []), ...parsed.data.alternatives]);
      if (distinct.length < parsed.data.alternatives.length + (parsed.data.recipe ? 1 : 0)) parsed.data.issues = [...new Set([...parsed.data.issues, "Пропуснат е прекалено сходен AI вариант."])].slice(0, 6);
      parsed.data.alternatives = distinct.filter((r) => r.id !== parsed.data.recipe?.id);
      let saved = false;
      try { saved = saveAIBundle(sessionStorage, parsed.data, key); } catch { /* Storage can be denied. */ }
      if (!saved) throw new GenerationError("STORAGE", 0, true);
      window.dispatchEvent(new Event(generatedStoreEvent));
      return parsed.data;
    } finally { clearTimeout(timeout); }
  })();
  requests.set(key, request);
  void request.finally(() => requests.delete(key)).catch(() => {});
  return request;
}
/** Backward-compatible single-recipe consumer. */
export async function requestAIRecipe(query: string, retry = false): Promise<ResolvedRecipe> {
  const bundle = await requestAIBundle(query, retry);
  if (!bundle.recipe) throw new GenerationError("INVALID_OUTPUT", 502, true);
  return bundle.recipe;
}
