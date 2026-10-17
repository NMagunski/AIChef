import { issue, normalize, type QualityRecipe, type QualityIssue } from "./quality-types.ts";
import { foodGroups, seasoning } from "./ingredients.ts";
export function validateInstructions(recipe: QualityRecipe): QualityIssue[] {
  const result: QualityIssue[] = [], steps = recipe.preparation.steps, ids = new Set<string>();
  if (!steps.length) result.push(issue("MISSING_STEPS", "error", "Липсват стъпки за приготвяне.", "preparation.steps", "instructions"));
  const instructionText = normalize(steps.map((s) => `${s.title} ${s.description}`).join(" "));
  const listed = new Set(recipe.preparation.ingredients.flatMap((i) => foodGroups(i.name)));
  const mentioned = new Set(foodGroups(instructionText));
  recipe.preparation.ingredients.forEach((ingredient, index) => {
    const groups = foodGroups(ingredient.name);
    if (!seasoning(ingredient.name) && groups.length && !groups.some((group) => mentioned.has(group))) result.push(issue("INGREDIENT_NOT_REFERENCED", "warning", `„${ingredient.name}“ не е ясно споменат в стъпките; провери начина на употреба.`, `preparation.ingredients[${index}]`, "instructions"));
  });
  for (const group of mentioned) {
    if (!listed.has(group) && !(group === "meat" && (listed.has("poultry") || listed.has("ground"))) && group !== "salt") result.push(issue("UNLISTED_INGREDIENT", "warning", "Стъпките вероятно споменават продукт, който не е в списъка; провери продуктите.", "preparation.steps", "instructions"));
  }
  steps.forEach((step, index) => {
    const field = `preparation.steps[${index}]`;
    if (!step.title.trim() || !step.description.trim()) result.push(issue("INCOMPLETE_STEP", "error", "Стъпката трябва да има заглавие и описание.", field, "instructions"));
    if (!step.id.trim() || ids.has(step.id)) result.push(issue("DUPLICATE_STEP_ID", "error", "Стъпките трябва да имат различни идентификатори.", `${field}.id`, "instructions"));
    ids.add(step.id);
    const text = normalize(step.description);
    // Warning only: preparation can legitimately be implicit or use pre-cut produce.
    for (const group of foodGroups(text)) if (/добави|сложи/u.test(text) && steps.slice(index + 1).some((later) => /нарежи|обели/u.test(normalize(later.description)) && foodGroups(later.description).includes(group))) result.push(issue("POSSIBLE_PREPARATION_ORDER", "warning", "Провери реда на добавяне и подготовка на продуктите.", field, "instructions"));
  });
  return result;
}
