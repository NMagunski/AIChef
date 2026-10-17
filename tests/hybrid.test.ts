import test from "node:test";
import assert from "node:assert/strict";
import { aiBundleSchema, classifyRecipe, nearDuplicate, normalizeVariant, requiredAIRecipes, selectHybridRecipes, uniqueRecipes, variantOutputSchema } from "../src/lib/ai/hybrid.ts";
import { generatedRecipeSchema } from "../src/lib/ai/recipe-schema.ts";
import { validateEquipment, extraBatchLimit } from "../src/lib/server/hybrid-generator.ts";
import { readAIBundle, saveAIBundle, bundleStoreKey } from "../src/lib/ai/bundle-store.ts";
import { aiRecipe } from "./helpers/ai-recipe.ts";
import { webResult } from "./helpers/web-recipe.ts";
import { hybridBundle, variantModel, variantRecipe } from "./helpers/hybrid-recipe.ts";
test("hybrid classification preserves legacy AI and identifies alternatives/licensed/incomplete web", () => {
  assert.equal(classifyRecipe(aiRecipe()), "ai_original"); assert.equal(classifyRecipe(variantRecipe(1)), "ai_alternative");
  assert.equal(classifyRecipe(webResult().recipe!), "web_licensed");
  const unsafe = { ...webResult().recipe!, source: { kind: "web", mode: "demo" } as const }; assert.equal(classifyRecipe(unsafe), "web_metadata_only");
});
test("provenance is strict and a website cannot be attached to an independent AI alternative", () => {
  const recipe = variantRecipe(1); assert.equal(generatedRecipeSchema.safeParse(recipe).success, true);
  assert.equal(generatedRecipeSchema.safeParse({ ...recipe, source: { ...recipe.source, url: "https://example.org" } }).success, false);
  assert.equal(aiBundleSchema.safeParse({ ...hybridBundle(), alternatives: [aiRecipe()] }).success, false);
});
test("selection prioritizes licensed recipes and caps initial complete results at three", () => {
  const { recipe, alternatives } = hybridBundle();
  const chosen = selectHybridRecipes(recipe, alternatives, [webResult(1), webResult(2)]);
  assert.equal(chosen.initial.length, 3); assert.deepEqual(chosen.initial.map(classifyRecipe), ["ai_original", "web_licensed", "web_licensed"]);
  assert.equal(chosen.additional.length, 2);
});
test("one licensed recipe leaves one independent AI alternative in the initial selection", () => {
  const b = hybridBundle(); assert.deepEqual(selectHybridRecipes(b.recipe, b.alternatives, [webResult()]).initial.map(classifyRecipe), ["ai_original", "web_licensed", "ai_alternative"]);
});
test("no licensed recipes uses three validated AI recipes and separates metadata-only links", () => {
  const b = hybridBundle(); const chosen = selectHybridRecipes(b.recipe, b.alternatives, [webResult(1, false)]);
  assert.equal(chosen.initial.length, 3); assert.equal(chosen.metadata.length, 1); assert.ok(chosen.initial.every((r) => r.source?.kind === "ai"));
});
test("partial/empty results never invent replacements", () => {
  assert.equal(selectHybridRecipes(undefined, [], []).initial.length, 0);
  assert.equal(selectHybridRecipes(undefined, [variantRecipe(1)], []).initial.length, 1);
});
test("meaningful variants are distinct while renamed/quantity-only duplicates are removed", () => {
  const a = variantRecipe(0); const renamed = { ...a, id: "renamed", title: "Друго заглавие", servings: 6 };
  assert.equal(nearDuplicate(a, renamed), true); assert.equal(nearDuplicate(a, variantRecipe(1)), false);
  assert.equal(uniqueRecipes([a, renamed, variantRecipe(1)]).length, 2);
});
test("required AI counts and configurable extra-generation limits are bounded", () => {
  assert.deepEqual([0, 1, 2, 10].map(requiredAIRecipes), [3, 2, 1, 1]);
  assert.equal(extraBatchLimit({}), 1); assert.equal(extraBatchLimit({ AI_DISCOVERY_MAX_EXTRA_BATCHES: "0" }), 0);
  for (const value of ["-1", "10", "NaN", "1.5"]) assert.equal(extraBatchLimit({ AI_DISCOVERY_MAX_EXTRA_BATCHES: value }), 0);
});
test("alternatives preserve excluded ingredients and total cooking time", () => {
  assert.throws(() => normalizeVariant(variantModel(1), "Пиле без лимон", "mock", "ai_alternative"), /CONSTRAINTS/);
  assert.throws(() => normalizeVariant(variantModel(1), "Вечеря до 10 минути", "mock", "ai_alternative"), /CONSTRAINTS/);
  assert.ok(normalizeVariant(variantModel(2), "Пиле без лимон до 30 минути", "mock", "ai_alternative"));
});
test("dietary restrictions are checked on every alternative", () => {
  for (const query of ["Веган вечеря", "Вегетарианска вечеря"]) assert.throws(() => normalizeVariant(variantModel(1), query, "mock", "ai_alternative"), /CONSTRAINTS/);
  const vegan = variantModel(1); vegan.ingredients[0].name = "Боб";
  assert.ok(normalizeVariant(vegan, "Веган вечеря без гъби", "mock", "ai_alternative"));
});
test("requested servings are validated independently for each variant", () => {
  assert.throws(() => normalizeVariant(variantModel(1), "Пиле за 6 порции", "mock", "ai_alternative"), /CONSTRAINTS/);
  assert.equal(normalizeVariant(variantModel(1, 6), "Пиле за 6 порции", "mock", "ai_alternative").servings, 6);
});
test("requested equipment is preserved and cannot be changed for variety", () => {
  const recipe = variantModel(1); recipe.instructions[1].description = "Сготви във фурната.";
  assert.throws(() => validateEquipment(recipe, "Само на котлон, без фурна"), /CONSTRAINTS/);
  assert.throws(() => validateEquipment(variantModel(), "Пиле в тенджера"), /CONSTRAINTS/);
  validateEquipment(recipe, "Пиле на фурна");
});
test("incomplete/unsafe generated variants are rejected before canonical storage", () => {
  assert.throws(() => normalizeVariant({ ...variantModel(), instructions: [] }, "Пиле", "mock", "ai_alternative"));
  const bad = variantModel(); bad.ingredients[0].quantity = -1; assert.throws(() => normalizeVariant(bad, "Пиле", "mock", "ai_alternative"));
  assert.equal(variantOutputSchema.safeParse({ status: "recipes", clarification: null, recipes: [variantModel()] }).success, true);
});
test("bundle references reuse the canonical temporary store with expiry and corruption checks", () => {
  const values = new Map<string, string>(); const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
  const bundle = hybridBundle(); assert.equal(saveAIBundle(storage, bundle, "query", 1000000), true);
  assert.deepEqual(readAIBundle(storage, "query", 1000001), bundle);
  assert.equal(readAIBundle(storage, "other", 1000001), null); assert.equal(readAIBundle(storage, "query", 1000000 + 86400001), null);
  values.set(bundleStoreKey, "{bad"); assert.equal(readAIBundle(storage, "query", 1000001), null);
});
test("metadata-only records are never promoted to complete cards or internal cooking", () => {
  const chosen = selectHybridRecipes(undefined, [], [webResult(1, false)]);
  assert.equal(chosen.initial.length, 0); assert.equal(chosen.metadata[0].recipe, undefined);
});
