import test from "node:test";
import assert from "node:assert/strict";
import { formatIngredientAmount, formatQuantity, maximumServings, minimumServings, scaleIngredients, scaleQuantity } from "../src/lib/servings.ts";
import type { Ingredient, IngredientUnit } from "../src/types/recipe.ts";

test("scales up and down from the original serving count", () => {
  assert.equal(scaleQuantity(300, 4, 6), 450);
  assert.equal(scaleQuantity(300, 4, 1), 75);
  assert.equal(scaleQuantity(300, 4, 20), 1500);
  assert.equal(scaleQuantity(300, 4, 4), 300);
  assert.equal(scaleQuantity(Number.MIN_VALUE, 20, 20), Number.MIN_VALUE);
  assert.equal(minimumServings, 1);
  assert.equal(maximumServings, 20);
});

test("preserves precision for fractional quantities without cumulative rounding", () => {
  assert.equal(scaleQuantity(1.5, 4, 6), 2.25);
  assert.equal(scaleQuantity(0.75, 4, 1), 0.1875);
  assert.ok(Math.abs(scaleQuantity(1 / 3, 4, 3)! - 0.25) < 1e-12);
  assert.equal(scaleQuantity(3, 4, 2), 1.5);
});

test("does not mutate input arrays, objects, quantities or units", () => {
  const original = Object.freeze([Object.freeze({ id: "rice", name: "Ориз", quantity: 300, unit: "g" as const })]);
  const scaled = scaleIngredients(original, 4, 6);
  assert.equal(scaled[0].quantity, 450);
  assert.equal(original[0].quantity, 300);
  assert.notEqual(scaled, original);
  assert.notEqual(scaled[0], original[0]);
  assert.equal(scaled[0].unit, "g");
  assert.equal(scaleIngredients(original, 4, 4)[0].quantity, 300);
});

test("supports all seven units while keeping meaningful original units", () => {
  const units: IngredientUnit[] = ["g", "kg", "ml", "l", "piece", "tsp", "tbsp"];
  const ingredients: Ingredient[] = units.map((unit) => ({ id: unit, name: unit, quantity: 0.5, unit }));
  for (const ingredient of scaleIngredients(ingredients, 4, 8)) {
    assert.equal(ingredient.quantity, 1);
    assert.equal(ingredient.unit, ingredient.id);
  }
  assert.equal(formatIngredientAmount({ id: "x", name: "Мляко", quantity: 0.1875, unit: "l" }), "0,1875 л");
  assert.equal(formatIngredientAmount({ id: "x", name: "Месо", quantity: 0.5, unit: "kg" }), "0,5 кг");
});

test("formats Bulgarian decimals and readable kitchen fractions", () => {
  assert.equal(formatQuantity(0.5, "piece"), "½");
  assert.equal(formatQuantity(1.5, "tbsp"), "1 ½");
  assert.equal(formatQuantity(0.25, "tsp"), "¼");
  assert.equal(formatQuantity(1 / 3, "tsp"), "⅓");
  assert.equal(formatQuantity(2 / 3, "piece"), "⅔");
  assert.equal(formatQuantity(0.375, "kg"), "0,375");
  assert.equal(formatIngredientAmount({ id: "x", name: "Ориз", quantity: 75, unit: "g" }), "75 г");
  assert.equal(formatQuantity(0.000001, "g"), "<0,0001");
});

test("preserves unspecified quantities and handles zero", () => {
  assert.equal(scaleQuantity(null, 4, 8), null);
  assert.equal(scaleQuantity(0, 4, 8), 0);
  assert.equal(formatQuantity(0, "g"), "0");
  assert.equal(formatQuantity(-0, "g"), "0");
  assert.equal(formatIngredientAmount({ id: "salt", name: "Сол", quantity: null, unit: null }), "На вкус");
  assert.equal(formatIngredientAmount({ id: "parsley", name: "Магданоз", quantity: null, unit: null, note: "За поръсване" }), "За поръсване");
  assert.deepEqual(scaleIngredients([], 4, 8), []);
});

test("rejects invalid serving counts, including empty ingredient lists", () => {
  for (const value of [0, -1, 21, 1.5, NaN, Infinity]) {
    assert.throws(() => scaleQuantity(1, 4, value), RangeError);
    assert.throws(() => scaleQuantity(1, value, 4), RangeError);
    assert.throws(() => scaleIngredients([], 4, value), RangeError);
  }
});

test("rejects negative, non-finite and overflowing quantities", () => {
  for (const quantity of [-1, NaN, Infinity, -Infinity]) {
    assert.throws(() => scaleQuantity(quantity, 4, 6), RangeError);
    assert.throws(() => formatQuantity(quantity, "g"), RangeError);
  }
  assert.throws(() => scaleQuantity(Number.MAX_VALUE, 1, 20), RangeError);
});
