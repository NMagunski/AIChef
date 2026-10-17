import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { generatedRecipeSchema, modelOutputSchema, normalizeRecipe, validateModelRecipe } from "../src/lib/ai/recipe-schema.ts";
import { scaleIngredients } from "../src/lib/servings.ts";
import { createCookingSession, transitionSession, validateCookingSession } from "../src/lib/cooking-session.ts";
const recording = JSON.parse(readFileSync(new URL("./fixtures/live-moussaka.json", import.meta.url), "utf8"));
const output = modelOutputSchema.parse(recording.output);
const raw = validateModelRecipe(output.recipe, "Рецепта за традиционна българска мусака за 4 порции");
const recipe = generatedRecipeSchema.parse(normalizeRecipe(raw, recording.model));

test("single live recipe recording passes original schemas and immutable serving/session calculations", () => {
  assert.equal(recipe.id, recording.canonicalRecipeId);
  assert.match(recipe.title, /мусака/u); assert.equal(recipe.servings, 4);
  assert.equal(recipe.source.kind, "ai"); assert.equal(recipe.source.mode, "live");
  const original = JSON.stringify(recipe);
  const scaled = scaleIngredients(recipe.preparation.ingredients, 4, 6);
  assert.equal(scaled[0].quantity, 1500); assert.equal(scaled[1].quantity, 750);
  assert.equal(scaled.find((item) => item.name === "яйца")?.quantity, 3);
  let session = createCookingSession(recipe, 1000, 6);
  session = transitionSession(session, recipe, { type: "check", id: "ingredient-1" }, 1000);
  session = transitionSession(session, recipe, { type: "timer", id: "step-1", action: "start" }, 1000);
  session = transitionSession(session, recipe, { type: "next" }, 1000);
  const restored = validateCookingSession(JSON.parse(JSON.stringify(session)), recipe, 2000);
  assert.equal(restored?.servings, 6); assert.deepEqual(restored?.checkedIngredients, ["ingredient-1"]);
  assert.equal(restored?.timers["step-1"].deadline, 601000);
  for (let index = 1; index < recipe.preparation.steps.length; index++) session = transitionSession(session, recipe, { type: "next" }, 2000);
  assert.equal(session.status, "completed"); assert.equal(JSON.stringify(recipe), original);
});

test("live recording keeps culinary timing inconsistency visible instead of equating schema validity with safety", () => {
  const stepMinutes = recipe.preparation.steps.reduce((sum, step) => sum + (step.durationMinutes ?? 0), 0);
  assert.equal(recipe.minutes, 85); assert.equal(stepMinutes, 100);
  assert.notEqual(stepMinutes, recipe.minutes);
  assert.equal(recipe.preparation.ingredients.filter((item) => item.quantity === null).length, 2);
  assert.ok(recipe.preparation.ingredients.filter((item) => item.quantity !== null).every((item) => item.quantity! > 0));
  assert.deepEqual(recipe.preparation.steps.map((step) => step.id), ["step-1", "step-2", "step-3", "step-4", "step-5", "step-6", "step-7"]);
});
