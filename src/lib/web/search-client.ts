import { retryAfterSeconds, recordCooldown, readCooldown } from "../retry-after";
import { validateRecipe } from "../recipe-quality/validate-recipe";
import { z } from "zod";
import type { WebSearchPage } from "./types";
import { webPageSchema } from "./schema";
import { normalizeWebQuery } from "./query";
import { WebSearchError } from "./errors";
import { BoundedCache } from "./cache";
import { saveGeneratedRecipe, generatedStoreEvent } from "../ai/recipe-store";
const cache = new BoundedCache<WebSearchPage>(20, 60000, 2_000_000);
const pending = new Map<string, Promise<WebSearchPage>>();
const errorSchema = z.object({ error: z.object({ code: z.string(), retryable: z.boolean() }) });
export function requestWebRecipes(query: string, cursor: string | null = null, retry = false): Promise<WebSearchPage> {
  const key = `${normalizeWebQuery(query)}:${cursor ?? "0:0"}`;
  if (pending.has(key)) return pending.get(key)!;
  const cached = retry ? undefined : cache.get(key);
  if (cached && webPageSchema.safeParse(cached).success) return Promise.resolve(cached);
  const request = (async () => {
    const signal = AbortSignal.timeout(75000);
    try {
      const cooldown = readCooldown("web"); if (cooldown) throw new WebSearchError(cooldown.code, cooldown.status, true, cooldown.seconds);
      const response = await fetch("/api/recipes/search-web", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query, cursor }), signal });
      let raw: unknown; try { raw = await response.json(); } catch { throw new WebSearchError("INVALID_RESPONSE", 502, true); }
      if (!response.ok) {
        const error = errorSchema.safeParse(raw);
        const seconds = retryAfterSeconds(response.headers.get("Retry-After"));
        recordCooldown("web", error.success ? error.data.error.code : "RATE_LIMIT", response.status, seconds);
        throw new WebSearchError(error.success ? error.data.error.code : "UNAVAILABLE", response.status, error.success && error.data.error.retryable && !["QUOTA", "AUTHENTICATION", "CONFIGURATION"].includes(error.data.error.code), seconds);
      }
      const page = webPageSchema.safeParse(raw); if (!page.success) throw new WebSearchError("INVALID_RESPONSE", 502, true);
      for (const result of page.data.results) if (result.recipe) {
        const quality = validateRecipe(result.recipe, { query });
        result.quality = quality;
        let saved = false; try { saved = quality.valid && saveGeneratedRecipe(sessionStorage, result.recipe, result.id); } catch { /* Report a usable original source below. */ }
        if (!saved) { delete result.recipe; result.access = "metadata_only"; result.discoveryType = "web_metadata_only"; result.limitations.push("Рецептата не може да бъде показана като пълна; отвори оригинала."); }
      }
      window.dispatchEvent(new Event(generatedStoreEvent));
      cache.set(key, page.data); return page.data;
    } catch (error) { if (error instanceof WebSearchError) throw error; throw new WebSearchError(signal.aborted ? "TIMEOUT" : "UNAVAILABLE", 0, true); }
  })();
  pending.set(key, request); void request.finally(() => pending.delete(key)).catch(() => {}); return request;
}
