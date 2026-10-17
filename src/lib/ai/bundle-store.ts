import { z } from "zod";
import { aiBundleSchema, type AIBundle } from "./hybrid.ts";
import { generatedStoreKey, readGeneratedEntries, saveGeneratedRecipe, type RecipeStorage } from "./recipe-store.ts";
export const bundleStoreKey = "aichef:ai-bundles:v1";
const entrySchema = z.object({ key: z.string().max(100), recipeId: z.string().optional(), alternativeIds: z.array(z.string()).max(2), issues: z.array(z.string().max(2000)).max(6), maxExtraBatches: z.number().int().min(0).max(2), until: z.number().finite() }).strict();
function entries(storage: RecipeStorage, now: number) {
  try { const raw = storage.getItem(bundleStoreKey); if (!raw || raw.length > 100000) return []; const parsed = z.array(entrySchema).max(20).safeParse(JSON.parse(raw)); return parsed.success ? parsed.data.filter((e) => e.until > now && e.until <= now + 86400000) : []; } catch { return []; }
}
export function readAIBundle(storage: RecipeStorage, key: string, now = Date.now()): AIBundle | null {
  const entry = entries(storage, now).find((e) => e.key === key); if (!entry) return null;
  const saved = readGeneratedEntries(storage.getItem(generatedStoreKey), now);
  const recipe = saved.find((r) => r.recipe.id === entry.recipeId)?.recipe;
  const alternatives = entry.alternativeIds.flatMap((id) => { const found = saved.find((r) => r.recipe.id === id); return found ? [found.recipe] : []; });
  if ((entry.recipeId && !recipe) || alternatives.length !== entry.alternativeIds.length) return null;
  const parsed = aiBundleSchema.safeParse({ ...(recipe ? { recipe } : {}), alternatives, issues: entry.issues, maxExtraBatches: entry.maxExtraBatches });
  return parsed.success ? parsed.data : null;
}
export function saveAIBundle(storage: RecipeStorage, bundle: AIBundle, key: string, now = Date.now()) {
  const parsed = aiBundleSchema.safeParse(bundle); if (!parsed.success) return false;
  try {
    if (bundle.recipe && !saveGeneratedRecipe(storage, bundle.recipe, key, now)) return false;
    for (const recipe of bundle.alternatives) if (!saveGeneratedRecipe(storage, recipe, `${key}:${recipe.id}`, now)) return false;
    const record = { key, ...(bundle.recipe ? { recipeId: bundle.recipe.id } : {}), alternativeIds: bundle.alternatives.map((r) => r.id), issues: bundle.issues, maxExtraBatches: bundle.maxExtraBatches, until: now + 86400000 };
    storage.setItem(bundleStoreKey, JSON.stringify([...entries(storage, now).filter((e) => e.key !== key).slice(-19), record])); return true;
  } catch { return false; }
}
