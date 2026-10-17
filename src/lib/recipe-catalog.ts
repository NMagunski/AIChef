import { recipes } from "./recipes";
import { mockSearchRecipes } from "./mock-search-recipes";
import type { ResolvedRecipe } from "@/types/recipe";

export function getRecipeIds(): string[] {
  return [...new Set([...recipes, ...mockSearchRecipes].map((recipe) => recipe.id))];
}

/** Resolves existing records by stable ID; the shared rice record uses its search summary. */
export function getRecipeById(id: string): ResolvedRecipe | undefined {
  const search = mockSearchRecipes.find((recipe) => recipe.id === id);
  if (search) return { ...search, visual: id === "pile-s-oriz" ? { kind: "details", name: "rice" } : { kind: "search", name: search.photo } };
  const home = recipes.find((recipe) => recipe.id === id);
  if (home) return { ...home, visual: { kind: "home", name: home.photo } };
  return undefined;
}
