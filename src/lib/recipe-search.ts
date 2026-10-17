import type { RecipeDifficulty, SearchRecipe } from "@/types/recipe";

export type SearchFilters = {
  time: "all" | "quick" | "medium" | "long";
  difficulty: RecipeDifficulty | "all";
  cuisine: string;
  category: string;
};
export type RecipeSort = "recommended" | "time-asc" | "time-desc";
export const defaultFilters: SearchFilters = { time: "all", difficulty: "all", cuisine: "all", category: "all" };
export const initialAdditionalCount = 8;

const stopWords = new Set(["какво", "мога", "може", "можеш", "приготвя", "приготвим", "направя", "готвя", "сготвя", "имам", "рецепта", "рецепти", "днес", "искам", "дай", "нещо", "ми", "за", "с", "със", "и", "да", "на", "от", "до", "ли"]);

function stem(word: string) {
  if (word.startsWith("пиле")) return "пиле";
  if (word.startsWith("картоф")) return "картоф";
  if (word.startsWith("бърз")) return "бърз";
  if (word.startsWith("салат")) return "салат";
  if (word.startsWith("суп")) return "суп";
  if (word.startsWith("гъб")) return "гъб";
  if (word.startsWith("зеленч")) return "зеленч";
  return word;
}

function tokens(text: string) {
  return (text.normalize("NFKC").toLocaleLowerCase("bg").match(/[\p{L}\p{N}]+/gu) ?? []).filter((word) => !stopWords.has(word)).map(stem);
}

/** Local keyword matching only: every meaningful query word must match. */
export function matchRecipes(recipes: SearchRecipe[], query: string): SearchRecipe[] {
  if (!query.trim()) return recipes;
  const queryWords = tokens(query);
  if (!queryWords.length) return [];
  return recipes.filter((recipe) => {
    const words = tokens([recipe.title, recipe.description, recipe.cuisine, recipe.category, ...recipe.ingredients, ...recipe.tags, ...recipe.keywords].join(" "));
    return queryWords.every((queryWord) => words.some((word) => word === queryWord));
  });
}

export function filterRecipes(recipes: SearchRecipe[], filters: SearchFilters): SearchRecipe[] {
  return recipes.filter((recipe) => {
    const timeMatches = filters.time === "all"
      || (filters.time === "quick" && recipe.minutes <= 30)
      || (filters.time === "medium" && recipe.minutes >= 30 && recipe.minutes <= 60)
      || (filters.time === "long" && recipe.minutes > 60);
    return timeMatches
      && (filters.difficulty === "all" || recipe.difficulty === filters.difficulty)
      && (filters.cuisine === "all" || recipe.cuisine === filters.cuisine)
      && (filters.category === "all" || recipe.category === filters.category);
  });
}

export function sortRecipes(recipes: SearchRecipe[], sort: RecipeSort): SearchRecipe[] {
  if (sort === "recommended") return recipes;
  return [...recipes].sort((a, b) => sort === "time-asc" ? a.minutes - b.minutes : b.minutes - a.minutes);
}
