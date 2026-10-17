"use client";
import { useRetryCooldown } from "@/hooks/use-retry-cooldown";
import { useEffect, useState } from "react";
import type { ResolvedRecipe } from "@/types/recipe";
import { requestAIBundle } from "@/lib/ai/generate-client";
import { errorMessages } from "@/lib/ai/errors";
import { GenerationError, querySchema } from "@/lib/ai/recipe-schema";
import { SearchRecipeCard } from "./search-recipe-card";
import styles from "./search-results.module.css";
import { selectHybridRecipes, uniqueRecipes } from "@/lib/ai/hybrid";
import { requestWebRecipes } from "@/lib/web/search-client";
import { WebSearchError, webErrorMessages } from "@/lib/web/errors";
import type { WebRecipeResult } from "@/lib/web/types";
import { defaultFilters, type SearchFilters } from "@/lib/recipe-search";
import { matchesLiveFilters } from "@/lib/web/filters";
import { SearchFilterControls } from "./search-filters";
import { WebRecipeCard } from "./web-recipe-card";
export function AISearchResults({ query }: { query: string }) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{ recipe?: ResolvedRecipe; alternatives?: ResolvedRecipe[]; issues?: string[]; maxExtraBatches?: number; error?: GenerationError } | null>(null);
  const [webAttempt, setWebAttempt] = useState(0);
  const [web, setWeb] = useState<{ results: WebRecipeResult[]; cursor: string | null; error?: WebSearchError; limitations: string[] } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [extraBatch, setExtraBatch] = useState(0);
  const [extraError, setExtraError] = useState<GenerationError | null>(null);
  const [revealedMore, setRevealedMore] = useState(false);
  const aiWait = useRetryCooldown(result?.error?.retryAfter);
  const webWait = useRetryCooldown(web?.error?.retryAfter);
  const extraWait = useRetryCooldown(extraError?.retryAfter);
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  useEffect(() => {
    if (!querySchema.safeParse({ query }).success) return;
    let active = true;
    requestAIBundle(query, attempt > 0).then((bundle) => { if (active) setResult(bundle); }, (error: unknown) => { if (active) setResult({ error: error instanceof GenerationError ? error : new GenerationError("NETWORK", 0, true) }); });
    return () => { active = false; };
  }, [query, attempt]);
  useEffect(() => {
    if (!querySchema.safeParse({ query }).success) return;
    let active = true;
    requestWebRecipes(query, null, webAttempt > 0).then((page) => { if (active) setWeb({ results: page.results, cursor: page.nextCursor, limitations: page.limitations }); }, (error: unknown) => { if (active) setWeb({ results: [], cursor: null, limitations: [], error: error instanceof WebSearchError ? error : new WebSearchError("UNAVAILABLE", 0, true) }); });
    return () => { active = false; };
  }, [query, webAttempt]);
  async function loadMore() {
    if (loadingMore) return;
    if (!revealedMore && selected.additional.length) { setRevealedMore(true); return; }
    if (!web?.cursor) {
      if (!web) return;
      if (extraBatch >= (result?.maxExtraBatches ?? 0) || extraError) return;
      setLoadingMore(true);
      try {
        const bundle = await requestAIBundle(query, false, extraBatch + 1);
        setResult((current) => current ? { ...current, alternatives: uniqueRecipes([...(current.alternatives ?? []), ...bundle.alternatives]), issues: [...new Set([...(current.issues ?? []), ...bundle.issues])] } : current);
        setExtraBatch((value) => value + 1);
        setRevealedMore(true);
      } catch (error) { setExtraError(error instanceof GenerationError ? error : new GenerationError("NETWORK", 0, false)); }
      finally { setLoadingMore(false); }
      return;
    }
    setLoadingMore(true);
    try {
      const page = await requestWebRecipes(query, web.cursor, true);
      setRevealedMore(true);
      setWeb((current) => current ? { results: [...current.results, ...page.results.filter((r) => !current.results.some((old) => old.id === r.id))], cursor: page.nextCursor, limitations: [...new Set([...current.limitations, ...page.limitations])] } : current);
    } catch (error) { setWeb((current) => current ? { ...current, error: error instanceof WebSearchError ? error : new WebSearchError("UNAVAILABLE", 0, true) } : current); }
    finally { setLoadingMore(false); }
  }
  if (!query.trim()) return <section className={styles.empty}><h2>Какво ти се готви?</h2><p>Напиши ястие, продукти или условия, за да създадем една AI рецепта.</p></section>;
  if (!querySchema.safeParse({ query }).success) return <p role="alert">{errorMessages.INVALID_REQUEST}</p>;
  const allRecipes = [result?.recipe, ...(result?.alternatives ?? []), ...(web?.results.map((r) => r.recipe) ?? [])].filter((r): r is ResolvedRecipe => !!r);
  const selected = selectHybridRecipes(result?.recipe, result?.alternatives ?? [], web?.results ?? []);
  const initial = selected.initial.filter((r) => matchesLiveFilters(r, filters));
  const additional = revealedMore ? selected.additional.filter((r) => matchesLiveFilters(r, filters)) : [];
  const webMatches = selected.metadata.filter(() => matchesLiveFilters(undefined, filters));
  const canLoadWeb = !!web?.cursor && (!web.error || web.error.retryable);
  const canGenerateMore = !!web && !web.cursor && !extraError && extraBatch < (result?.maxExtraBatches ?? 0);
  const canRevealMore = !revealedMore && selected.additional.length > 0;
  return <>
    <SearchFilterControls filters={filters} cuisines={[...new Set(allRecipes.flatMap((r) => r.cuisine ? [r.cuisine] : []))]} categories={[...new Set(allRecipes.map((r) => r.category))]} onChange={setFilters} onReset={() => setFilters(defaultFilters)} />
    <p className={styles.demoNotice}>До три пълни рецепти: оригинална AI идея, разрешени интернет рецепти и независими AI алтернативи. Само рецепти с разрешено възпроизвеждане и достатъчно данни се отварят в AIChef. Филтрите се прилагат към заредените рецепти; връзки с неизвестни стойности се скриват при активен филтър.</p>
    <section aria-label="Интернет търсене" aria-busy={!web}>
      {!web && <p role="status">Търсим рецепти в интернет…</p>}
      {web?.error && <div><p role="alert">{webErrorMessages[web.error.code] ?? webErrorMessages.UNAVAILABLE}</p>{web.error.retryable && <button className={styles.loadMore} type="button" disabled={webWait > 0} onClick={() => web.results.length ? void loadMore() : setWebAttempt((value) => value + 1)}>Опитай интернет търсенето отново</button>}</div>}
      {web?.limitations.map((message) => <p className={styles.demoNotice} key={message}>{message}</p>)}
      {web && !web.error && !web.results.length && <p>Няма интернет резултати за тази заявка.</p>}
    </section>
    <section aria-label="Подбрани пълни рецепти" className={styles.featuredGrid}>
    <section aria-label="AI рецепта" aria-busy={!result} className={styles.aiSlot}>
    {!result && <p role="status" className={styles.demoNotice}>Създаваме твоята AI рецепта… Това може да отнеме до 45 секунди.</p>}
    {result?.error && <div className={styles.empty}><h2>Не успяхме да създадем рецепта</h2><p role="alert">{result.error.explanation ?? errorMessages[result.error.code] ?? errorMessages.UNAVAILABLE}</p>{result.error.retryable && <button type="button" disabled={aiWait > 0} onClick={() => { setResult(null); setAttempt((value) => value + 1); }}>Опитай отново</button>}</div>}
    {initial.filter((r) => r.id === result?.recipe?.id).map((recipe) => <SearchRecipeCard key={recipe.id} recipe={recipe} />)}
    {result && !result.recipe && !result.error && <p>Оригиналната AI рецепта не е налична. Виж останалите валидни предложения.</p>}
    </section>
    {initial.filter((r) => r.id !== result?.recipe?.id).map((recipe) => <SearchRecipeCard key={recipe.id} recipe={recipe} />)}
    </section>
    {allRecipes.length + (web?.results.filter((r) => !r.recipe).length ?? 0) > 0 && !webMatches.length && !initial.length && !additional.length && <p role="status">Няма рецепти с тези филтри.</p>}
    {(aiWait > 0 || webWait > 0 || extraWait > 0) && <p role="status" className={styles.demoNotice}>Можеш да опиташ отново след {Math.max(aiWait, webWait, extraWait)} сек. Няма да изпращаме автоматична заявка.</p>}
    {result?.issues?.map((message) => <p className={styles.demoNotice} key={message}>{message}</p>)}
    {additional.length > 0 && <section className={styles.additional} aria-label="Още пълни рецепти"><h2>Още рецепти</h2><div className={styles.additionalGrid}>{additional.map((recipe) => <SearchRecipeCard key={recipe.id} recipe={recipe} compact />)}</div></section>}
    <section className={styles.additional} aria-label="Още интернет рецепти"><h2>Още рецепти в интернет</h2>
      <div className={styles.additionalGrid}>{webMatches.map((item) => <WebRecipeCard key={item.id} result={item} compact />)}</div>
      <button className={styles.loadMore} type="button" disabled={loadingMore || webWait > 0 || extraWait > 0 || (!canLoadWeb && !canGenerateMore && !canRevealMore)} aria-busy={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Зареждаме още рецепти…" : "Покажи още рецепти"}</button>
      {extraError && <p role="alert">{errorMessages[extraError.code] ?? errorMessages.UNAVAILABLE}</p>}
      {web && !web.cursor && <p className={styles.demoNotice}>Няма повече интернет резултати.{canGenerateMore ? " Можеш да заредиш още независими AI варианти в рамките на лимита." : ""}</p>}
      {result?.maxExtraBatches !== undefined && result.maxExtraBatches > 0 && extraBatch >= result.maxExtraBatches && <p className={styles.demoNotice}>Достигнат е лимитът за допълнителни AI варианти.</p>}
    </section>
    <p className={styles.demoNotice}>AI рецептите не са професионално проверени. Запазват се временно в този раздел до 24 часа; интернет рецептите — до 10 минути.</p>
  </>;
}
