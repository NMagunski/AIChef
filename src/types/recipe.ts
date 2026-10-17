import type { ContentPermission } from "@/lib/web/permissions";
import type { SearchPhotoName } from "@/lib/search-photos";
import type { ReferencePhotoName } from "@/lib/reference-photos";

export type RecipeDifficulty = "Лесна" | "Средна";
export type RecipeDiscoveryType = "ai_original" | "ai_alternative" | "web_licensed" | "web_metadata_only";
export type IngredientUnit = "g" | "kg" | "ml" | "l" | "piece" | "tsp" | "tbsp";
export type Ingredient = { id: string; name: string; quantity: number | null; unit: IngredientUnit | null; icon?: string; originalText?: string; quantityStatus?: "parsed" | "unparsed"; availability?: "available" | "additional" | "unspecified"; note?: string };
export type RecipeVisual =
  | { kind: "placeholder"; name: "recipe" }
  | { kind: "home"; name: ReferencePhotoName }
  | { kind: "search"; name: SearchPhotoName }
  | { kind: "details"; name: "rice" | "prepare" | "saute" | "chicken" | "addRice" | "liquid" | "oven" | "finish" };
export type RecipeStep = { id: string; title: string; description: string; durationMinutes?: number; temperatureC?: number; image?: RecipeVisual; tip?: string };
export type RecipeNutrition = { basis: string; calories?: number; proteinGrams?: number; carbohydrateGrams?: number; fatGrams?: number; fiberGrams?: number };
export type RecipePreparation = { preparationMinutes: number | null; cookingMinutes: number | null; ingredients: Ingredient[]; steps: RecipeStep[]; tips: string[]; nutrition?: RecipeNutrition };

/** Stable fields shared by home, discovery and future recipe details. */
export type RecipeSummary = {
  id: string;
  title: string;
  description: string;
  minutes: number | null;
  servings: number;
  difficulty: RecipeDifficulty | null;
  category: string;
  tags: string[];
  preparation?: RecipePreparation;
};

/** Demo web recipes deliberately cannot contain external attribution. */
export type RecipeSource =
  | { kind: "ai"; mode: "demo" | "live"; model?: string; discoveryType?: "ai_original" | "ai_alternative" }
  | { kind: "web"; mode: "demo" }
  | { kind: "web"; mode: "live"; name: string; url: string; reuse?: ContentPermission; discoveryType?: "web_licensed" };

export type SearchRecipe = RecipeSummary & {
  minutes: number;
  difficulty: RecipeDifficulty;
  source: RecipeSource;
  cuisine: string;
  ingredients: string[];
  keywords: string[];
  featured: boolean;
  photo: SearchPhotoName;
};

export type ResolvedRecipe = RecipeSummary & { source?: RecipeSource; visual: RecipeVisual; cuisine?: string; imageUrl?: string | null };
