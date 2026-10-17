import { normalizeRecipe, type ModelRecipe } from "../../src/lib/ai/recipe-schema.ts";
export function modelRecipe(overrides: Partial<ModelRecipe> = {}): ModelRecipe {
  return { title: "Пиле с ориз", description: "Пилешко и ориз в тиган.", servings: 4, preparationTime: 10, cookingTime: 20, difficulty: "Лесна", cuisine: "Българска кухня", category: "Основни ястия", tags: ["Бърза вечеря"],
    ingredients: [{ name: "Пилешко месо", quantity: 800, unit: "g", note: null, availability: "unspecified" }, { name: "Ориз", quantity: 300, unit: "g", note: null, availability: "additional" }],
    instructions: [{ number: 1, title: "Подготви продуктите", description: "Нарежи месото и изплакни ориза.", durationMinutes: null, temperatureC: null, tip: null, ingredientIndices: [0, 1] }, { number: 2, title: "Сготви ястието", description: "Сготви продуктите и провери пилешкото с термометър до вътрешни 74°C.", durationMinutes: 20, temperatureC: null, tip: null, ingredientIndices: [0, 1] }], cookingTips: [], ...overrides };
}
export function aiRecipe(servings = 4, title = "Пиле с ориз") {
  const raw = modelRecipe({ servings, title });
  raw.ingredients[0].quantity = 200 * servings;
  raw.ingredients[1].quantity = 75 * servings;
  return normalizeRecipe(raw, "mock-model");
}
