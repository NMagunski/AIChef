import { z } from "zod";
import type { WebSearchProvider, WebSearchResult } from "../../web/types.ts";
import { canonicalRecipeUrl, recipeUrlKey, webRecipeId } from "../../web/url.ts";
import { WebSearchError } from "../../web/errors.ts";
import { buildSearchQuery } from "../../web/query.ts";
const organic = z.object({ title: z.string().min(1).max(3000), link: z.string().max(2048), snippet: z.string().max(3000).optional(), source: z.string().max(3000).optional(), position: z.number().int().positive().max(1000).optional() });
const responseSchema = z.object({ organic_results: z.array(organic).max(100).optional(), error: z.string().optional(), search_metadata: z.object({ status: z.string().optional() }).optional(), serpapi_pagination: z.object({ next: z.string().optional() }).optional() });
export function normalizeSerpResponse(value: unknown, start = 0, now = Date.now()) {
  const parsed = responseSchema.safeParse(value);
  if (!parsed.success) throw new WebSearchError("INVALID_RESPONSE", 502, true);
  const data = parsed.data;
  if (data.error) {
    if (/key|unauthorized|forbidden/i.test(data.error)) throw new WebSearchError("AUTHENTICATION", 503);
    if (/quota|credit|run out|searches|limit.*month/i.test(data.error)) throw new WebSearchError("QUOTA", 503);
    if (/rate|too many/i.test(data.error)) throw new WebSearchError("RATE_LIMIT", 429, true);
    throw new WebSearchError("UNAVAILABLE", 502, true);
  }
  if (!data.organic_results && data.search_metadata?.status !== "Success") throw new WebSearchError("INVALID_RESPONSE", 502, true);
  const seen = new Set<string>(); const results: WebSearchResult[] = [];
  for (const [index, item] of (data.organic_results ?? []).slice(0, 10).entries()) {
    try {
      const url = canonicalRecipeUrl(item.link), key = recipeUrlKey(url);
      if (seen.has(key)) continue; seen.add(key);
      const domain = new URL(url).hostname.replace(/^www\./, "");
      results.push({ id: webRecipeId(url), title: item.title, url, domain, sourceName: item.source?.trim() || domain, description: item.snippet ?? "", imageUrl: null, rank: item.position ?? start + index + 1, discoveredAt: new Date(now).toISOString() });
    } catch { /* Invalid URLs never enter discovery results. */ }
  }
  return { results, nextCursor: data.serpapi_pagination?.next && start < 90 ? String(start + 10) : null };
}
export function createSerpApiProvider(apiKey: string, send: typeof fetch = fetch, settings: { timeoutMs?: number } = {}): WebSearchProvider {
  return { async searchRecipes(query, options = {}) {
    if (!Number.isInteger(options.start ?? 0) || (options.start ?? 0) < 0 || (options.start ?? 0) > 90 || (options.start ?? 0) % 10 !== 0) throw new WebSearchError("INVALID_REQUEST", 400);
    if (!apiKey.trim()) throw new WebSearchError("CONFIGURATION", 503);
    const url = new URL("https://serpapi.com/search.json");
    url.search = new URLSearchParams({ engine: "google", api_key: apiKey, q: buildSearchQuery(query), hl: "bg", gl: "bg", google_domain: "google.bg", start: String(options.start ?? 0) }).toString();
    const controller = new AbortController();
    const signal = AbortSignal.any([controller.signal, ...(options.signal ? [options.signal] : [])]);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let abortListener: (() => void) | undefined;
    try {
      const deadline = new Promise<never>((_, reject) => {
        abortListener = () => reject(new WebSearchError("TIMEOUT", 504, true));
        if (signal.aborted) abortListener();
        else signal.addEventListener("abort", abortListener, { once: true });
        timer = setTimeout(() => controller.abort(), settings.timeoutMs ?? 8000);
      });
      const work = (async () => {
        signal.throwIfAborted();
        const response = await send(url, { signal, redirect: "error" });
        if (response.status === 401 || response.status === 403) throw new WebSearchError("AUTHENTICATION", 503);
        if (!response.ok && response.status !== 429) throw new WebSearchError("UNAVAILABLE", 502, true);
        const reader = response.body?.getReader(); if (!reader) throw new WebSearchError("INVALID_RESPONSE", 502, true);
        let size = 0; const chunks: Uint8Array[] = [];
        while (true) { const { done, value } = await reader.read(); if (done) break; size += value.length; if (size > 1_000_000) { await reader.cancel(); throw new WebSearchError("INVALID_RESPONSE", 502, true); } chunks.push(value); }
        let data: unknown; try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { throw new WebSearchError("INVALID_RESPONSE", 502, true); }
        if (response.status === 429) {
          // Quota errors may also arrive with 429; inspect the safe mapped error
          // before classifying it as a recoverable request-rate limit.
          try { normalizeSerpResponse(data, options.start); } catch (error) { if (error instanceof WebSearchError && ["QUOTA", "AUTHENTICATION"].includes(error.code)) throw error; }
          throw new WebSearchError("RATE_LIMIT", 429, true);
        }
        return normalizeSerpResponse(data, options.start);
      })();
      // A signal alone does not bound an uncooperative fetch/body transport.
      // Race the complete read/parse operation; abort the transport without retries.
      return await Promise.race([work, deadline]);
    } catch (error) {
      if (error instanceof WebSearchError) throw error;
      throw new WebSearchError(signal.aborted ? "TIMEOUT" : "UNAVAILABLE", signal.aborted ? 504 : 502, true);
    } finally { if (timer) clearTimeout(timer); if (abortListener) signal.removeEventListener("abort", abortListener); }
  } };
}
