import type { ResolvedRecipe } from "../../types/recipe.ts";
import type { SearchFilters } from "../recipe-search.ts";
export function matchesLiveFilters(recipe: ResolvedRecipe | undefined, filters: SearchFilters) {
  if (!recipe) return Object.values(filters).every((value) => value === "all");
  const time = recipe.minutes;
  return (filters.time === "all" || (time !== null && ((filters.time === "quick" && time <= 30) || (filters.time === "medium" && time >= 30 && time <= 60) || (filters.time === "long" && time > 60)))) && (filters.difficulty === "all" || recipe.difficulty === filters.difficulty) && (filters.cuisine === "all" || recipe.cuisine === filters.cuisine) && (filters.category === "all" || recipe.category === filters.category);
}
