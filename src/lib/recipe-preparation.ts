import type { IngredientUnit, RecipePreparation, RecipeStep } from "@/types/recipe";

type IngredientSpec = readonly [name: string, quantity: number | null, unit: IngredientUnit | null, icon?: string];
type StepSpec = readonly [title: string, description: string];

/** Constructs preparation fields on the existing mock records, not a second recipe collection. */
export function demoPreparation(preparationMinutes: number, cookingMinutes: number, ingredients: readonly IngredientSpec[], steps: readonly StepSpec[], tips: string[] = []): RecipePreparation {
  return {
    preparationMinutes, cookingMinutes,
    ingredients: ingredients.map(([name, quantity, unit, icon], index) => ({ id: `ingredient-${index + 1}`, name, quantity, unit, icon })),
    steps: steps.map(([title, description], index) => ({ id: `step-${index + 1}`, title, description })),
    tips,
  };
}

// Quantities and illustrated steps transcribed from the supplied approved details mockup.
// No nutritional values or real source attribution are present in the underlying data.
export const ricePreparation: RecipePreparation = {
  preparationMinutes: 15,
  cookingMinutes: 45,
  ingredients: [
    { id: "chicken", name: "Пилешки бутчета", quantity: 800, unit: "g", icon: "🍗" },
    { id: "rice", name: "Ориз", quantity: 300, unit: "g", icon: "🍚" },
    { id: "onion", name: "Лук", quantity: 2, unit: "piece", icon: "🧅" },
    { id: "carrot", name: "Моркови", quantity: 2, unit: "piece", icon: "🥕" },
    { id: "garlic", name: "Чесън", quantity: 3, unit: "piece", icon: "🧄", note: "скилидки" },
    { id: "tomato", name: "Доматено пюре", quantity: 2, unit: "tbsp", icon: "🍅" },
    { id: "oil", name: "Олио", quantity: 3, unit: "tbsp", icon: "🫒" },
    { id: "water", name: "Вода или бульон", quantity: 750, unit: "ml", icon: "🥛" },
    { id: "black-pepper", name: "Черен пипер", quantity: 1, unit: "tsp", icon: "🧂" },
    { id: "red-pepper", name: "Червен пипер", quantity: 1, unit: "tsp", icon: "🌶️" },
    { id: "salt", name: "Сол", quantity: 1.5, unit: "tsp", icon: "🧂", note: "на вкус" },
    { id: "parsley", name: "Магданоз", quantity: null, unit: null, icon: "🌿", note: "За поръсване" },
  ],
  steps: [
    { id: "prepare", title: "Подготви продуктите", description: "Нарежи лука и морковите на ситно. Подготви пилешките бутчета и ги овкуси със сол и черен пипер.", image: { kind: "details", name: "prepare" } },
    { id: "saute", title: "Запържи зеленчуците", description: "В голяма тава загрей олиото и запържи лука и морковите, докато омекнат.", durationMinutes: 5, image: { kind: "details", name: "saute" } },
    { id: "chicken", title: "Добави пилешкото", description: "Постави пилешките бутчета в тавата и ги запечатай от двете страни.", image: { kind: "details", name: "chicken" } },
    { id: "rice", title: "Добави ориза и подправките", description: "Изсипи ориза, разбъркай и добави доматеното пюре, червения пипер и останалите подправки.", image: { kind: "details", name: "addRice" } },
    { id: "liquid", title: "Налей течността", description: "Добави водата или бульона. Разбъркай леко и подреди бутчетата отгоре.", image: { kind: "details", name: "liquid" } },
    { id: "oven", title: "Печи във фурната", description: "В демонстрационния макет тавата се покрива с фолио и се поставя в предварително загрята фурна. Фолиото се маха в края за запичане.", durationMinutes: 45, temperatureC: 180, image: { kind: "details", name: "oven" } },
    { id: "finish", title: "Финални щрихи", description: "Поръси с нарязан магданоз и сервирай по предпочитания от теб начин.", image: { kind: "details", name: "finish" } },
  ] satisfies RecipeStep[],
  tips: ["За по-богат вкус използвай домашен бульон.", "Добави гъби или праз за разнообразие.", "Поръси с пресен магданоз непосредствено преди сервиране."],
};
