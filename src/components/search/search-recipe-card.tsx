"use client";

import { RecipeQualityNotice } from "@/components/recipe-details/recipe-quality-notice";
import Link from "next/link";
import { ArrowRight, Clock3, CookingPot, Globe2, Heart, Sparkles, Users } from "lucide-react";
import type { SearchRecipe, ResolvedRecipe } from "@/types/recipe";
import { useFavorites } from "@/components/recipes/favorites-provider";
import { RecipePhoto } from "@/components/recipe-details/recipe-photo";
import { SearchPhoto } from "./search-photo";
import styles from "./search-recipe-card.module.css";
import { saveGeneratedRecipe, generatedStoreEvent } from "@/lib/ai/recipe-store";

export function SearchRecipeCard({ recipe, compact = false }: { recipe: SearchRecipe | ResolvedRecipe; compact?: boolean }) {
  const { ids, toggle } = useFavorites();
  const saved = ids.includes(recipe.id);
  const ai = recipe.source?.kind === "ai";
  const alternative = ai && recipe.source?.kind === "ai" && recipe.source.discoveryType === "ai_alternative";
  const demo = !recipe.source || recipe.source.mode === "demo";
  const href = `/recipes/${recipe.id}`;
  function rememberWebRecipe() {
    if (recipe.source?.kind !== "web" || recipe.source.mode !== "live" || !("visual" in recipe)) return;
    try { if (saveGeneratedRecipe(sessionStorage, recipe, recipe.id)) window.dispatchEvent(new Event(generatedStoreEvent)); } catch { /* Storage availability is checked when loading results. */ }
  }

  return (
    <article className={`${styles.card} ${compact ? styles.compact : ""} ${ai ? styles.ai : styles.web} ${alternative ? styles.alternative : ""}`}>
      <Link href={href} onClick={rememberWebRecipe} className={styles.photoLink} aria-label={`Виж рецептата: ${recipe.title}`}>
        {"photo" in recipe ? <SearchPhoto name={recipe.photo} /> : <RecipePhoto visual={recipe.visual} />}
      </Link>
      <span className={styles.sourceBadge}>{ai ? <Sparkles size={14} aria-hidden="true" /> : <Globe2 size={14} aria-hidden="true" />}{alternative ? "AI алтернатива" : ai ? "AI рецепта" : "От интернет"}{demo && <span className={styles.demoBadge}>Демо</span>}</span>
      <button type="button" className={`${styles.favorite} ${saved ? styles.saved : ""}`} aria-pressed={saved} aria-label={`${saved ? "Премахни от" : "Добави в"} любими: ${recipe.title}`} onClick={() => toggle(recipe.id)}>
        <Heart size={24} fill={saved ? "currentColor" : "none"} strokeWidth={1.7} aria-hidden="true" />
      </button>
      <div className={styles.body}>
        <h3><Link href={href} onClick={rememberWebRecipe}>{recipe.title}</Link></h3>
        <ul className={styles.meta} aria-label="Информация за рецептата">
          <li><Clock3 size={16} aria-hidden="true" />{recipe.minutes === null ? "Време: неуточнено" : `${recipe.minutes} мин`}</li>
          <li><Users size={16} aria-hidden="true" />{recipe.servings} порции</li>
          <li><CookingPot size={16} aria-hidden="true" />{recipe.difficulty ?? "Сложност: неуточнена"}</li>
        </ul>
        <p className={styles.description}>{recipe.description}</p>
        {"visual" in recipe && <RecipeQualityNotice recipe={recipe} />}
        <ul className={styles.tags} aria-label="Категории и етикети">{[recipe.category, ...recipe.tags].map((tag) => <li key={tag}>{tag}</li>)}</ul>
        <Link href={href} onClick={rememberWebRecipe} className={styles.recipeButton} aria-label={`Виж рецептата: ${recipe.title}`}>Виж рецептата<ArrowRight size={17} aria-hidden="true" /></Link>
        {demo ? <p className={styles.sourceNote}>Демо пример · {ai ? "не е генерирана с AI" : "без реален интернет източник"}</p> : recipe.source?.kind === "web" && recipe.source.mode === "live" ? <p className={styles.sourceNote}>Източник: <a href={recipe.source.url} target="_blank" rel="noopener noreferrer">{recipe.source.name}</a></p> : null}
      </div>
    </article>
  );
}
