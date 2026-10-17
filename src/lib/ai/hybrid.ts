import { validateRecipe } from "../recipe-quality/validate-recipe.ts";
import { qualityResultSchema, type QualityResult } from "../recipe-quality/quality-types.ts";
import { z } from "zod";
import type { RecipeDiscoveryType, ResolvedRecipe } from "../../types/recipe.ts";
import { GenerationError, generatedRecipeId, generatedRecipeSchema, modelRecipeSchema, normalizeRecipe, validateModelRecipe } from "./recipe-schema.ts";
import { webRecipeSchema, webResultSchema } from "../web/schema.ts";
import type { WebRecipeResult } from "../web/types.ts";
export const variantOutputSchema = z.object({ status: z.enum(["recipes", "clarification"]), clarification: z.string().min(1).max(2000).nullable(), recipes: z.array(modelRecipeSchema).max(3) }).strict();
export const hybridRequestSchema = z.object({ query: z.string().trim().min(1).max(500), batch: z.number().int().min(0).max(2).optional() }).strict();
export type AIBundle = { recipe?: ResolvedRecipe; alternatives: ResolvedRecipe[]; issues: string[]; maxExtraBatches: number; quality?: Record<string, QualityResult> };
export const aiBundleSchema = z.object({ quality: z.record(z.string().max(100), qualityResultSchema).optional(), recipe: generatedRecipeSchema.optional(), alternatives: z.array(generatedRecipeSchema).max(2).default([]), issues: z.array(z.string().max(2000)).max(6).default([]), maxExtraBatches: z.number().int().min(0).max(2).default(0) }).strict().superRefine((data, ctx) => {
  if ((data.recipe?.source.discoveryType === "ai_alternative") || data.alternatives.some((r) => r.source.discoveryType !== "ai_alternative")) ctx.addIssue({ code: "custom", message: "Invalid AI provenance" });
});
export function classifyRecipe(recipe: ResolvedRecipe): RecipeDiscoveryType {
  if (recipe.source?.kind === "ai") return recipe.source.discoveryType ?? "ai_original";
  return webRecipeSchema.safeParse(recipe).success ? "web_licensed" : "web_metadata_only";
}
const normalizeText = (value: string) => value.normalize("NFKC").toLocaleLowerCase("bg").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
function words(value: string) { return new Set(normalizeText(value).split(" ").filter((v) => v.length > 2)); }
function overlap(a: Set<string>, b: Set<string>) { const union = new Set([...a, ...b]); return union.size ? [...a].filter((v) => b.has(v)).length / union.size : 1; }
/** Quantity changes and renamed titles alone are not meaningful alternatives. */
export function nearDuplicate(a: ResolvedRecipe, b: ResolvedRecipe) {
  if (a.id === b.id) return true;
  const ingredients = (r: ResolvedRecipe) => new Set(r.preparation?.ingredients.map((v) => normalizeText(v.name)).sort() ?? []);
  const instructions = (r: ResolvedRecipe) => words(r.preparation?.steps.map((s) => s.description).join(" ") ?? "");
  return overlap(ingredients(a), ingredients(b)) >= .85 && overlap(instructions(a), instructions(b)) >= .8;
}
export function uniqueRecipes<T extends ResolvedRecipe>(recipes: T[]): T[] { const result: T[] = []; for (const recipe of recipes) if (!result.some((old) => old.id === recipe.id || (old.source?.kind === "ai" && recipe.source?.kind === "ai" && nearDuplicate(old, recipe)))) result.push(recipe); return result; }
export function normalizeVariant(value: unknown, query: string, model: string, role: "ai_original" | "ai_alternative") {
  const recipe = normalizeRecipe(validateModelRecipe(value, query), model);
  recipe.source = { kind: "ai", mode: "live", model, discoveryType: role };
  recipe.id = generatedRecipeId({ ...recipe, id: "" });
  const canonical = generatedRecipeSchema.parse(recipe);
  if (!validateRecipe(canonical, { query }).valid) throw new GenerationError("INVALID_OUTPUT", 502, true);
  return canonical;
}
export function requiredAIRecipes(licensed: number) { return 1 + Math.max(0, 2 - Math.min(2, licensed)); }
export function isLicensedResult(result: WebRecipeResult) { return result.access === "complete" && webResultSchema.safeParse(result).success && !!result.recipe; }
export function selectHybridRecipes(original: ResolvedRecipe | undefined, alternatives: ResolvedRecipe[], web: WebRecipeResult[]) {
  const licensed = uniqueRecipes(web.flatMap((r) => isLicensedResult(r) ? [r.recipe!] : []));
  const ai = alternatives.filter((r) => generatedRecipeSchema.safeParse(r).success && classifyRecipe(r) === "ai_alternative");
  const complete = uniqueRecipes([...(original && generatedRecipeSchema.safeParse(original).success ? [original] : []), ...licensed, ...ai]);
  return { initial: complete.slice(0, 3), additional: complete.slice(3), metadata: web.filter((r) => r.access === "metadata_only" && !r.recipe) };
}

/** Defense at response and cache boundaries: do not trust a supplied quality score. */
export function validateAIBundle(bundle: AIBundle, query: string): AIBundle {
  const quality: Record<string, QualityResult> = {};
  const accepted = (recipe: ResolvedRecipe) => {
    const result = validateRecipe(recipe, { query });
    if (!result.valid) return false;
    quality[recipe.id] = result; return true;
  };
  const recipe = bundle.recipe && accepted(bundle.recipe) ? bundle.recipe : undefined;
  const alternatives = bundle.alternatives.filter(accepted);
  const rejected = !!bundle.recipe && !recipe || alternatives.length < bundle.alternatives.length;
  return { ...(recipe ? { recipe } : {}), alternatives, issues: [...new Set([...bundle.issues, ...(rejected ? ["Рецепта не премина проверките за данни и ограничения и не е показана."] : [])])].slice(0, 6), maxExtraBatches: bundle.maxExtraBatches, quality };
}
