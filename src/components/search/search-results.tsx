"use client";

import Form from "next/form";
import Link from "next/link";
import { ChevronDown, ChevronRight, Heart, Search, SearchX } from "lucide-react";
import { useState } from "react";
import { mockSearchRecipes } from "@/lib/mock-search-recipes";
import { defaultFilters, filterRecipes, initialAdditionalCount, matchRecipes, sortRecipes, type RecipeSort, type SearchFilters } from "@/lib/recipe-search";
import { SearchFilterControls } from "./search-filters";
import { SearchRecipeCard } from "./search-recipe-card";
import { AISearchResults } from "./ai-search-results";
import { SearchPhoto } from "./search-photo";
import styles from "./search-results.module.css";

const cuisines = [...new Set(mockSearchRecipes.map((recipe) => recipe.cuisine))];
const categories = [...new Set(mockSearchRecipes.map((recipe) => recipe.category))];

export function SearchResults({ query, mode = "demo" }: { query: string; mode?: "ai" | "demo" }) {
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [sort, setSort] = useState<RecipeSort>("recommended");
  const [visibleCount, setVisibleCount] = useState(initialAdditionalCount);
  const matches = matchRecipes(mockSearchRecipes, query);
  const filtered = sortRecipes(filterRecipes(matches, filters), sort);
  const featured = filtered.filter((recipe) => recipe.featured);
  const additional = filtered.filter((recipe) => !recipe.featured);
  const visible = additional.slice(0, visibleCount);
  const hasFilters = Object.values(filters).some((value) => value !== "all");

  function changeFilters(next: SearchFilters) {
    setFilters(next);
    setVisibleCount(initialAdditionalCount);
  }

  return (
    <div data-search className={styles.page}>
      <header className={styles.hero}>
        <div className={styles.heroPhoto}><SearchPhoto name="hero" /></div>
        <div className={styles.heroShade} />
        <div className={styles.heroInner}>
          <nav className={styles.breadcrumbs} aria-label="Път до страницата"><Link href="/">Начало</Link><ChevronRight size={14} aria-hidden="true" /><span aria-current="page">Резултати</span></nav>
          <h1>{query ? <>Резултати за:<br /><span>„{query}“</span></> : "Открий рецепти"}</h1>
          <p className={styles.matchCount}>{mode === "ai" ? "AI рецепта и предложения от интернет според твоите условия." : matches.length ? <>Намерихме {matches.length} {matches.length === 1 ? "вкусно предложение" : "вкусни предложения"} за теб.</> : "Да открием следващата ти вкусна идея."}</p>
          <span className={styles.heroNote}>Вкусни идеи<br />с вдъхновение<Heart size={29} strokeWidth={1.2} aria-hidden="true" /></span>
        </div>
      </header>

      <div className={styles.resultsPanel}>
        <Form action="/search" className={styles.queryForm} role="search">
          <label className="sr-only" htmlFor="results-query">Търси рецепти</label>
          <Search size={18} aria-hidden="true" />
          <input id="results-query" name="q" type="search" defaultValue={query} maxLength={500} placeholder="Напиши ястие, продукт или идея..." />
          <button type="submit">Търси</button>
        </Form>
        <nav aria-label="Режим на търсене" className={styles.searchModes}><Link href={`/search?q=${encodeURIComponent(query)}&mode=ai`} aria-current={mode === "ai" ? "page" : undefined}>AI рецепта</Link><Link href={`/search?q=${encodeURIComponent(query)}&mode=demo`} aria-current={mode === "demo" ? "page" : undefined}>Демо колекция</Link></nav>
        {mode === "ai" ? <AISearchResults key={query} query={query} /> : <>
        <SearchFilterControls filters={filters} cuisines={cuisines} categories={categories} onChange={changeFilters} onReset={() => changeFilters(defaultFilters)} />
        <div className={styles.statusRow}>
          <p className={styles.demoNotice}>Демо колекция · локални примерни рецепти. Без AI генериране и търсене в интернет.</p>
          <p className={styles.resultStatus} role="status" aria-live="polite" aria-atomic="true">{filtered.length} от {matches.length} рецепти{additional.length > 0 ? ` · показани ${featured.length + visible.length}` : ""}</p>
        </div>

        {filtered.length === 0 ? (
          <section className={styles.empty} aria-labelledby="empty-title">
            <SearchX size={38} strokeWidth={1.4} aria-hidden="true" />
            <h2 id="empty-title">{matches.length ? "Няма рецепти с тези филтри." : "Все още нямаме рецепта за това търсене."}</h2>
            <p>{matches.length ? "Промени времето, сложността или кухнята, за да видиш още идеи." : "Това е малка демо колекция. Опитай с „пилешко“, „супа“ или „картофи“."}</p>
            {hasFilters && <button type="button" onClick={() => changeFilters(defaultFilters)}>Изчисти филтрите</button>}
            <Link href="/search">Виж всички демо рецепти<ChevronRight size={16} aria-hidden="true" /></Link>
          </section>
        ) : (
          <>
            {featured.length > 0 && <section aria-labelledby="featured-title"><h2 id="featured-title" className="sr-only">Подбрани рецепти</h2><div className={styles.featuredGrid}>{featured.map((recipe) => <SearchRecipeCard key={recipe.id} recipe={recipe} />)}</div></section>}
            {additional.length > 0 && (
              <section className={styles.additional} aria-labelledby="additional-title">
                <div className={styles.additionalHeading}>
                  <h2 id="additional-title">Още рецепти <span>({additional.length})</span></h2>
                  <label className={styles.sortLabel}><span>Сортирай по:</span><select aria-label="Сортиране на рецептите" value={sort} onChange={(event) => { setSort(event.target.value as RecipeSort); setVisibleCount(initialAdditionalCount); }}><option value="recommended">Най-подходящи</option><option value="time-asc">Най-бързи</option><option value="time-desc">Най-дълго време</option></select></label>
                </div>
                <div className={styles.additionalGrid}>{visible.map((recipe) => <SearchRecipeCard key={recipe.id} recipe={recipe} compact />)}</div>
                {visibleCount < additional.length && <button className={styles.loadMore} type="button" onClick={() => setVisibleCount((count) => count + initialAdditionalCount)}>Покажи още рецепти<ChevronDown size={17} aria-hidden="true" /></button>}
              </section>
            )}
          </>
        )}
        </>}
      </div>
    </div>
  );
}
