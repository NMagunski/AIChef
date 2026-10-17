"use client";

import { RecipeQualityNotice } from "./recipe-quality-notice";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { useCookingSession } from "@/hooks/use-cooking-session";
import type { ResolvedRecipe } from "@/types/recipe";
import { RecipeHeader } from "./recipe-header";
import { IngredientList } from "./ingredient-list";
import { RecipeInstructions } from "./recipe-instructions";
import { CookingTips } from "./cooking-tips";
import { RecipeAssistant } from "./recipe-assistant";
import { NutritionInfo } from "./nutrition-info";
import { RecipeSource } from "./recipe-source";
import styles from "./recipe-details.module.css";

export function RecipeDetails({ recipe }: { recipe: ResolvedRecipe }) {
  const { session, dispatch, notice } = useCookingSession(recipe);
  const servings = session?.servings ?? recipe.servings;
  const setServings = (value: number) => dispatch({ type: "servings", value });
  return <article data-recipe className={styles.page}>
    <nav className={styles.breadcrumbs} aria-label="Път до страницата"><Link href="/">Начало</Link><ChevronRight size={13} aria-hidden="true" /><Link href="/search">Резултати</Link><ChevronRight size={13} aria-hidden="true" /><span aria-current="page">{recipe.title}</span></nav>
    {notice && <p role="status">{notice}</p>}
    <RecipeHeader recipe={recipe} servings={servings} />
    <RecipeQualityNotice recipe={recipe} />
    {recipe.preparation ? <div className={styles.columns}>
      <div className={styles.ingredientsColumn}><IngredientList ingredients={recipe.preparation.ingredients} baseServings={recipe.servings} servings={servings} onServingsChange={setServings} checked={session?.checkedIngredients ?? []} onCheck={(id) => dispatch({ type: "check", id })} /></div>
      <div className={styles.instructionsColumn}><RecipeInstructions steps={recipe.preparation.steps} /></div>
      <aside className={styles.sidebar} aria-label="Помощ и допълнителна информация"><RecipeAssistant /><CookingTips tips={recipe.preparation.tips} /><NutritionInfo nutrition={recipe.preparation.nutrition} /><RecipeSource source={recipe.source} /></aside>
    </div> : <div className={styles.missingPreparation}><p>Все още няма добавени продукти и инструкции за тази рецепта.</p><RecipeSource source={recipe.source} /></div>}
  </article>;
}
