"use client";
import { useGeneratedRecipes } from "@/hooks/use-generated-recipes";
import Link from "next/link";
import { recipes } from "@/lib/recipes";
import { mockSearchRecipes } from "@/lib/mock-search-recipes";
import { SearchRecipeCard } from "@/components/search/search-recipe-card";
import { useFavorites } from "./favorites-provider";
import { RecipeCard } from "./recipe-card";
import styles from "@/components/home/home.module.css";

export function FavoritesList() {
  const { recipes: generated } = useGeneratedRecipes();
  const { ids } = useFavorites();
  const savedGenerated = generated.filter((recipe) => ids.includes(recipe.id));
  const saved = recipes.filter((recipe) => ids.includes(recipe.id));
  const savedSearch = mockSearchRecipes.filter((recipe) => ids.includes(recipe.id) && !saved.some((homeRecipe) => homeRecipe.id === recipe.id));
  return saved.length + savedSearch.length + savedGenerated.length ? <div className={styles.recipeGrid}>{saved.map((recipe) => <RecipeCard key={recipe.id} recipe={recipe} />)}{savedSearch.map((recipe) => <SearchRecipeCard key={recipe.id} recipe={recipe} />)}{savedGenerated.map((recipe) => <SearchRecipeCard key={recipe.id} recipe={recipe} />)}</div> : <div className={styles.empty}><p>Твоите любими рецепти ще се появят тук. Натисни сърцето върху някоя рецепта, за да я добавиш.</p><Link className={styles.textLink} href="/search">Открий рецепти →</Link></div>;
}
