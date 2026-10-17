import { modelRecipe } from "./ai-recipe.ts";
import { normalizeVariant } from "../../src/lib/ai/hybrid.ts";
export function variantModel(index = 0, servings = 4) {
  const flavors = ["класическо", "с лимон", "с моркови", "с тиквички", "с чушки", "със спанак", "с грах"];
  const extra = ["", "Лимон", "Моркови", "Тиквички", "Чушки", "Спанак", "Грах"];
  const raw = modelRecipe({ servings, title: `Пиле с ориз ${flavors[index]}` });
  if (index) {
    raw.ingredients.push({ name: extra[index], quantity: 100, unit: "g", note: null, availability: "additional" });
    raw.instructions[1].description += ` Добави ${extra[index].toLocaleLowerCase("bg")} за различен вкус.`;
    raw.instructions[1].ingredientIndices.push(2);
  }
  return raw;
}
export function variantRecipe(index = 0, servings = 4) { return normalizeVariant(variantModel(index, servings), `Пиле с ориз за ${servings} порции`, "mock-model", index === 0 ? "ai_original" : "ai_alternative"); }
export function hybridBundle(count = 3, maxExtraBatches = 1) {
  return { recipe: variantRecipe(0), alternatives: Array.from({ length: count - 1 }, (_, i) => variantRecipe(i + 1)), issues: [], maxExtraBatches };
}
