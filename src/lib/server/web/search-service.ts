import { validateRecipe } from "../../recipe-quality/validate-recipe.ts";
import type { WebSearchPage, WebRecipeResult, WebSearchProvider } from "../../web/types.ts";
import type { AuthorizedSource } from "../../web/permissions.ts";
import { classifyPermission } from "../../web/permissions.ts";
import { BoundedCache } from "../../web/cache.ts";
import { normalizeWebQuery } from "../../web/query.ts";
import { WebSearchError } from "../../web/errors.ts";
import { extractRecipe, normalizeAuthorizedRecipe } from "../../web/extract.ts";
import { webRecipeSchema, discoverySchema } from "../../web/schema.ts";
import { recipeUrlKey, webRecipeId } from "../../web/url.ts";
import { understandQuery } from "../../ai/recipe-schema.ts";
type PageFetcher = (url: string, authorize: (url: string) => boolean) => Promise<{ html: string; url: string }>;
export function createWebSearchService(provider: WebSearchProvider, sources: readonly AuthorizedSource[], fetchPage: PageFetcher, now = Date.now) {
  const cache = new BoundedCache<{ results: WebRecipeResult[]; nextCursor: string | null }>(40, 300000, 5_000_000, now);
  const inflight = new Map<string, Promise<{ results: WebRecipeResult[]; nextCursor: string | null }>>();
  return async function search(query: string, cursor: string | null = null): Promise<WebSearchPage> {
    const normalized = normalizeWebQuery(query);
    if (!normalized || normalized.length > 500 || (cursor !== null && !/^(?:[0-9]0|0):[0-9]$/.test(cursor))) throw new WebSearchError("INVALID_REQUEST", 400);
    const [start, offset] = (cursor ?? "0:0").split(":").map(Number);
    const key = `${normalized}:${start}:${JSON.stringify(sources)}`;
    async function load() {
      const page = await provider.searchRecipes(normalized, { start });
      const seen = new Set<string>();
      const results: WebRecipeResult[] = [];
      for (const item of page.results.slice(0, 10)) {
        const valid = discoverySchema.safeParse(item); if (!valid.success) continue;
        const discovery = valid.data, key = recipeUrlKey(discovery.url); if (seen.has(key)) continue; seen.add(key);
        const permission = classifyPermission(discovery.url, sources, now());
        const result: WebRecipeResult = { ...discovery, imageUrl: null, permission, access: "metadata_only", discoveryType: "web_metadata_only", limitations: [] };
        if (permission.contentPermission === "authorized") {
          try {
            const page = await fetchPage(discovery.url, (url) => classifyPermission(url, sources, now()).contentPermission === "authorized");
            const finalPermission = classifyPermission(page.url, sources, now());
            const extracted = extractRecipe(page.html);
            const registered = sources.find((source) => source.origin === new URL(page.url).origin && classifyPermission(page.url, [source], now()).contentPermission === "authorized");
            const finalDiscovery = { ...discovery, sourceName: registered?.sourceName ?? discovery.sourceName, url: page.url, id: webRecipeId(page.url), domain: new URL(page.url).hostname.replace(/^www\./, "") };
            const recipe = extracted ? normalizeAuthorizedRecipe(finalDiscovery, extracted, finalPermission) : null;
            if (recipe && webRecipeSchema.safeParse(recipe).success) {
              const intent = understandQuery(query);
              const quality = validateRecipe(recipe, { query });
              if (quality.valid && (intent.maxMinutes === null || (recipe.minutes !== null && recipe.minutes <= intent.maxMinutes))) Object.assign(result, finalDiscovery, { permission: finalPermission, access: "complete", discoveryType: "web_licensed", recipe, quality });
              else result.limitations.push("Рецептата не премина проверките за данни и ограничения; прегледай оригинала.");
            } else result.limitations.push("Източникът няма достатъчно валидни данни за пълна рецепта и порции.");
          } catch { result.limitations.push("Пълната рецепта не може да бъде извлечена безопасно. Отвори оригинала."); }
        } else result.limitations.push("Няма документирано разрешение за възпроизвеждане на пълната рецепта.");
        if (!results.some((r) => recipeUrlKey(r.url) === recipeUrlKey(result.url))) results.push(result);
      }
      results.sort((a, b) => Number(b.access === "complete") - Number(a.access === "complete") || a.rank - b.rank);
      const output = { results, nextCursor: page.nextCursor && Number(page.nextCursor) > start && /^(?:[1-9]0)$/.test(page.nextCursor) ? page.nextCursor : null };
      cache.set(key, output); return output;
    }
    let page = cache.get(key);
    if (!page) {
      let pending = inflight.get(key);
      if (!pending) { if (inflight.size >= 20) throw new WebSearchError("RATE_LIMIT", 429, true); pending = load(); inflight.set(key, pending); }
      try { page = await pending; } finally { inflight.delete(key); }
    }
    const end = offset + 2;
    const results = page.results.slice(offset, end).map((r) => {
      if (r.access === "complete" && classifyPermission(r.url, sources, now()).contentPermission !== "authorized") { const rest = { ...r }; delete rest.recipe; return { ...rest, permission: classifyPermission(r.url, sources, now()), access: "metadata_only" as const, discoveryType: "web_metadata_only" as const }; }
      return r;
    });
    return { results, nextCursor: end < page.results.length ? `${start}:${end}` : page.nextCursor ? `${page.nextCursor}:0` : null, limitations: results.some((r) => r.access === "metadata_only") ? ["Част от резултатите са само връзки към оригинала. Ограниченията в заявката не са проверени за тези връзки."] : ["Интернет резултатите не са проверени от кулинарен специалист. Провери съответствието с твоите продукти, кухня и хранителни изисквания."] };
  };
}
