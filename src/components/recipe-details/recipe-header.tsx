"use client";

import Link from "next/link";
import { useState } from "react";
import { Clock3, CookingPot, Heart, Play, Timer, Users } from "lucide-react";
import type { RecipeVisual, ResolvedRecipe } from "@/types/recipe";
import { useFavorites } from "@/components/recipes/favorites-provider";
import { RecipePhoto } from "./recipe-photo";
import { RecipeSource } from "./recipe-source";
import styles from "./recipe-details.module.css";

export function RecipeHeader({ recipe, servings }: { recipe: ResolvedRecipe; servings: number }) {
  const { ids, toggle } = useFavorites();
  const saved = ids.includes(recipe.id);
  const [selected, setSelected] = useState(0);
  const gallery: RecipeVisual[] = recipe.id === "pile-s-oriz" ? [recipe.visual, { kind: "details", name: "finish" }, { kind: "details", name: "oven" }, { kind: "search", name: "rice" }] : [recipe.visual];
  return <section className={styles.recipeHeader} aria-labelledby="recipe-title">
    <div className={styles.gallery}>
      <div className={styles.mainPhoto} role="img" aria-label={recipe.title}><RecipePhoto visual={gallery[selected]} /></div>
      <button type="button" className={`${styles.photoFavorite} ${saved ? styles.saved : ""}`} onClick={() => toggle(recipe.id)} aria-label={`${saved ? "Премахни от" : "Добави в"} любими: ${recipe.title}`} aria-pressed={saved}><Heart size={28} fill={saved ? "currentColor" : "none"} aria-hidden="true" /></button>
      {gallery.length > 1 && <div className={styles.thumbnails} role="group" aria-label="Снимки на рецептата">{gallery.map((photo, index) => <button key={`${photo.kind}-${photo.name}`} type="button" aria-label={`Снимка ${index + 1}: ${recipe.title}`} aria-pressed={index === selected} onClick={() => setSelected(index)}><RecipePhoto visual={photo} /></button>)}</div>}
    </div>
    <div className={styles.headerInfo}>
      <div className={styles.headerBadges}><RecipeSource source={recipe.source} badge /><span>{recipe.category}</span></div>
      <h1 id="recipe-title">{recipe.title}</h1>
      <p className={styles.description}>{recipe.description}</p>
      <ul className={styles.headerMeta} aria-label="Информация за рецептата">
        <li><Clock3 size={20} aria-hidden="true" /><span>{(recipe.preparation ? recipe.preparation.cookingMinutes : recipe.minutes) === null ? "Неуточнено" : `${recipe.preparation?.cookingMinutes ?? recipe.minutes} мин`}<small>{recipe.preparation ? "Готвене" : "Общо време"}</small></span></li>
        {recipe.preparation && <li><Timer size={20} aria-hidden="true" /><span>{recipe.preparation.preparationMinutes === null ? "Неуточнено" : `${recipe.preparation.preparationMinutes} мин`}<small>Подготовка</small></span></li>}
        <li><Users size={20} aria-hidden="true" /><span>{servings} {servings === 1 ? "порция" : "порции"}</span></li>
        <li><CookingPot size={20} aria-hidden="true" /><span>{recipe.difficulty ?? "Неуточнена"}</span></li>
      </ul>
      <ul className={styles.headerTags} aria-label="Категории">{[...new Set([recipe.category, ...recipe.tags])].map((tag) => <li key={tag}>{tag}</li>)}</ul>
      <div className={styles.headerActions}>
        <Link href={`/recipes/${recipe.id}/cook`} className={styles.startCooking}><Play size={21} aria-hidden="true" />Започни да готвиш</Link>
        <button type="button" className={styles.favoriteButton} onClick={() => toggle(recipe.id)} aria-pressed={saved}><Heart size={24} fill={saved ? "currentColor" : "none"} aria-hidden="true" />{saved ? "В любими" : "Добави в любими"}</button>
      </div>
      {recipe.source?.kind === "ai" && recipe.source.mode === "live" && <p className={styles.demoNotice}>AI генерирана рецепта · Форматът е проверен автоматично. Рецептата не е професионално проверена.</p>}
      {(!recipe.source || recipe.source.mode === "demo") && <p className={styles.demoNotice}>Демо рецепта · Примерни количества и инструкции.</p>}
    </div>
  </section>;
}
