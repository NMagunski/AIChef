import test from "node:test";
import assert from "node:assert/strict";
import { zodTextFormat } from "openai/helpers/zod";
import { GenerationError, generatedRecipeId, generatedRecipeSchema, modelOutputSchema, normalizeRecipe, querySchema, understandQuery, validateModelRecipe } from "../src/lib/ai/recipe-schema.ts";
import { mapGenerationError } from "../src/lib/ai/errors.ts";
import { generatedStoreKey, generatedStoreTTL, readGeneratedEntries, saveGeneratedRecipe } from "../src/lib/ai/recipe-store.ts";
import { aiRecipe, modelRecipe } from "./helpers/ai-recipe.ts";

test("query validation trims Bulgarian Unicode and rejects empty, wrong shape and overlong input", () => {
  for (const query of ["", "   ", "я".repeat(501)]) assert.equal(querySchema.safeParse({ query }).success, false);
  assert.deepEqual(querySchema.parse({ query: "  Имам картофи, яйца и сирене  " }), { query: "Имам картофи, яйца и сирене" });
  assert.equal(querySchema.safeParse({ query: "я".repeat(500) }).success, true);
  assert.equal(querySchema.safeParse({ query: 9 }).success, false);
  assert.equal(querySchema.safeParse({ query: "Мусака", extra: true }).success, false);
});
test("serving and time extraction supports digits, Bulgarian words, defaults and impossible counts", () => {
  assert.equal(understandQuery("Мусака").servings, 4);
  assert.equal(understandQuery("Пиле за 6 човека").servings, 6);
  assert.equal(understandQuery("за -1 човека").servings, -1);
  assert.equal(understandQuery("до -30 минути").maxMinutes, -30);
  assert.equal(understandQuery("За шест порции").servings, 6);
  assert.equal(understandQuery("за дванадесет души").servings, 12);
  assert.equal(understandQuery("Бърза вечеря до 30 минути").maxMinutes, 30);
  assert.throws(() => validateModelRecipe(modelRecipe(), "за 21 човека"), /CONSTRAINTS/);
});
test("excluded ingredients are rejected even with Bulgarian inflections", () => {
  for (const name of ["Лук", "Гъби печурки", "Гъбен бульон"]) {
    const raw = modelRecipe(); raw.ingredients[0].name = name;
    assert.throws(() => validateModelRecipe(raw, "Рецепта без лук и гъби"), /CONSTRAINTS/);
  }
  assert.doesNotThrow(() => validateModelRecipe(modelRecipe(), "Рецепта без лук и гъби"));
});
test("dietary restrictions and maximum total time cannot silently be ignored", () => {
  assert.throws(() => validateModelRecipe(modelRecipe(), "Веган вечеря"), /CONSTRAINTS/);
  assert.throws(() => validateModelRecipe(modelRecipe(), "Вегетарианско ястие"), /CONSTRAINTS/);
  assert.throws(() => validateModelRecipe(modelRecipe(), "вечеря до 20 минути"), /CONSTRAINTS/);
  for (const [query, name] of [["Без лактоза", "Сметана"], ["Без глутен", "Пшенично брашно"]]) {
    const raw = modelRecipe(); raw.ingredients[0].name = name;
    assert.throws(() => validateModelRecipe(raw, query), /CONSTRAINTS/);
  }
});
test("strict structured output schema has all fields required and rejects missing content", () => {
  assert.equal(zodTextFormat(modelOutputSchema, "recipe").strict, true);
  assert.equal(modelOutputSchema.safeParse({ status: "recipe", recipe: modelRecipe() }).success, false);
  assert.throws(() => validateModelRecipe({ ...modelRecipe(), title: "" }, "Мусака"), /INVALID_OUTPUT/);
  assert.throws(() => validateModelRecipe({ ...modelRecipe(), servings: 0 }, "Мусака"), /INVALID_OUTPUT/);
});
test("missing ingredient quantities are accepted only for seasonings to taste", () => {
  const raw = modelRecipe(); raw.ingredients[0].quantity = null; raw.ingredients[0].unit = null;
  assert.throws(() => validateModelRecipe(raw, "рецепта"), /INVALID_OUTPUT/);
  raw.ingredients[0].name = "Сол";
  assert.doesNotThrow(() => validateModelRecipe(raw, "рецепта"));
  raw.ingredients[0].unit = "g";
  assert.throws(() => validateModelRecipe(raw, "рецепта"), /INVALID_OUTPUT/);
});
test("negative, zero, missing and unsupported quantities/units are rejected", () => {
  for (const amount of [-1, 0, Infinity, NaN, undefined]) {
    const raw = modelRecipe(); Object.assign(raw.ingredients[0], { quantity: amount });
    assert.throws(() => validateModelRecipe(raw, "рецепта"), /INVALID_OUTPUT/);
  }
  const raw = modelRecipe(); Object.assign(raw.ingredients[0], { unit: "cup" });
  assert.throws(() => validateModelRecipe(raw, "рецепта"), /INVALID_OUTPUT/);
});
test("invalid cooking times, timers and temperatures are rejected", () => {
  assert.throws(() => validateModelRecipe(modelRecipe({ cookingTime: -1 }), "рецепта"), /INVALID_OUTPUT/);
  assert.throws(() => validateModelRecipe(modelRecipe({ cookingTime: 0, preparationTime: 0 }), "рецепта"), /INVALID_OUTPUT/);
  for (const durationMinutes of [-1, 0]) { const raw = modelRecipe(); raw.instructions[0].durationMinutes = durationMinutes; assert.throws(() => validateModelRecipe(raw, "рецепта"), /INVALID_OUTPUT/); }
  const raw = modelRecipe(); raw.instructions[0].temperatureC = 1000;
  assert.throws(() => validateModelRecipe(raw, "рецепта"), /INVALID_OUTPUT/);
});
test("instructions must be nonempty, ordered, uniquely numbered and reference valid ingredients", () => {
  assert.throws(() => validateModelRecipe(modelRecipe({ instructions: [] }), "рецепта"), /INVALID_OUTPUT/);
  for (const number of [1, 3]) { const raw = modelRecipe(); raw.instructions[1].number = number; assert.throws(() => validateModelRecipe(raw, "рецепта"), /INVALID_OUTPUT/); }
  for (const ingredientIndices of [[90], [0, 0]]) { const raw = modelRecipe(); raw.instructions[0].ingredientIndices = ingredientIndices; assert.throws(() => validateModelRecipe(raw, "рецепта"), /INVALID_OUTPUT/); }
  const raw = modelRecipe(); raw.instructions.forEach((step) => { step.ingredientIndices = [0]; });
  assert.throws(() => validateModelRecipe(raw, "рецепта"), /INVALID_OUTPUT/);
});
test("normalization uses the canonical type, explicit units, stable IDs and no invented image or nutrition", () => {
  const raw = modelRecipe(); const original = JSON.stringify(raw);
  const recipe = normalizeRecipe(validateModelRecipe(raw, "Пиле с ориз"), "mock-model");
  assert.equal(recipe.minutes, 30); assert.equal(recipe.source?.kind, "ai"); assert.equal(recipe.source?.mode, "live");
  assert.equal(recipe.imageUrl, null); assert.equal(recipe.preparation?.nutrition, undefined);
  assert.equal(recipe.preparation?.ingredients[1].availability, "additional");
  assert.deepEqual(recipe.preparation?.steps.map((step) => step.id), ["step-1", "step-2"]);
  assert.equal(JSON.stringify(raw), original);
  assert.equal(generatedRecipeSchema.safeParse(recipe).success, true);
});
test("recipe IDs are stable, scoped to content and change when quantities change", () => {
  assert.equal(aiRecipe().id, aiRecipe().id); assert.notEqual(aiRecipe(4).id, aiRecipe(6).id);
  assert.match(generatedRecipeId("Пиле"), /^ai-[a-f0-9]{16}$/);
});
test("cached response validation rejects corruption, edited IDs and quantities", () => {
  for (const edit of [{ id: "ai-0000000000000000" }, { servings: 99 }, { title: "Changed" }, { preparation: {} }]) assert.equal(generatedRecipeSchema.safeParse({ ...aiRecipe(), ...edit }).success, false);
  assert.deepEqual(readGeneratedEntries("{bad"), []);
  assert.deepEqual(readGeneratedEntries(JSON.stringify([{ recipe: {} }])), []);
});
test("bounded recipe storage supports refresh, expiration, isolation, corrupt data and denied writes", () => {
  let raw: string | null = null; const storage = { getItem: (key: string) => { assert.equal(key, generatedStoreKey); return raw; }, setItem: (_key: string, value: string) => { raw = value; } };
  for (let index = 0; index < 25; index++) assert.equal(saveGeneratedRecipe(storage, aiRecipe(4, `Ястие ${index}`), `query-${index}`, 1000), true);
  assert.equal(readGeneratedEntries(raw, 1001).length, 20);
  assert.equal(readGeneratedEntries(raw, 1001)[0].recipe.title, "Ястие 5");
  assert.equal(readGeneratedEntries(raw, 1000 + generatedStoreTTL).length, 0);
  assert.equal(saveGeneratedRecipe({ getItem: () => null, setItem: () => { throw Error("Denied"); } }, aiRecipe(), "key"), false);
});
test("error mapping never forwards authentication or upstream secrets", () => {
  assert.equal(mapGenerationError(new SyntaxError("private details")).status, 502);
  assert.equal(mapGenerationError({ status: 429 }).status, 429);
  assert.equal(mapGenerationError({ name: "APIConnectionTimeoutError" }).status, 504);
  assert.equal(mapGenerationError({ status: 401, message: "secret-key" }).code, "AUTHENTICATION_ERROR");
  const known = new GenerationError("CONSTRAINTS", 422); assert.equal(mapGenerationError(known), known);
});

test("regression: tiny timers and timers longer than the entire recipe are rejected before Cooking Mode", () => {
  for (const durationMinutes of [0.000000001, 31]) {
    const raw = modelRecipe(); raw.instructions[0].durationMinutes = durationMinutes;
    assert.throws(() => validateModelRecipe(raw, "Пиле"), /INVALID_OUTPUT/);
  }
});
