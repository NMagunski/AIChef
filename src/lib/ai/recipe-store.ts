import { validateRecipe } from "../recipe-quality/validate-recipe.ts";
import { generatedRecipeSchema } from "./recipe-schema.ts";
import { webRecipeSchema } from "../web/schema.ts";
import { z } from "zod";
const storedRecipeSchema = z.union([generatedRecipeSchema, webRecipeSchema]);
import type { ResolvedRecipe } from "../../types/recipe.ts";
export const generatedStoreKey = "aichef:generated:v1";
export const generatedStoreEvent = "aichef:generated-update";
export const generatedStoreTTL = 24 * 60 * 60_000;
export type RecipeStorage = Pick<Storage, "getItem" | "setItem">;
type Entry = { recipe: ResolvedRecipe; queryKey: string; expiresAt: number };
export function readGeneratedEntries(raw: string | null, now = Date.now()): Entry[] {
  if (!raw || raw.length > 2_000_000) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length > 20) return [];
    return parsed.flatMap((item: unknown) => {
      if (!item || typeof item !== "object" || !("recipe" in item) || !("expiresAt" in item) || !("queryKey" in item) || typeof item.expiresAt !== "number" || !Number.isFinite(item.expiresAt) || item.expiresAt <= now || item.expiresAt > now + generatedStoreTTL || typeof item.queryKey !== "string" || item.queryKey.length > 100) return [];
      const recipe = storedRecipeSchema.safeParse(item.recipe);
      return recipe.success && validateRecipe(recipe.data).valid ? [{ recipe: recipe.data, expiresAt: item.expiresAt, queryKey: item.queryKey }] : [];
    });
  } catch { return []; }
}
export function saveGeneratedRecipe(storage: RecipeStorage, recipe: ResolvedRecipe, queryKey: string, now = Date.now()): boolean {
  const valid = storedRecipeSchema.safeParse(recipe);
  if (!valid.success || !validateRecipe(valid.data).valid) return false;
  try {
    const entries = readGeneratedEntries(storage.getItem(generatedStoreKey), now).filter((entry) => entry.recipe.id !== recipe.id && entry.queryKey !== queryKey).slice(-19);
    const lifetime = recipe.source?.kind === "web" ? 10 * 60_000 : generatedStoreTTL;
    const raw = JSON.stringify([...entries, { recipe: valid.data, queryKey, expiresAt: now + lifetime }]);
    if (raw.length > 2_000_000) return false;
    storage.setItem(generatedStoreKey, raw);
    return true;
  } catch { return false; }
}
