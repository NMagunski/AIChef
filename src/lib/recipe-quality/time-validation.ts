import { issue, type QualityRecipe, type QualityIssue } from "./quality-types.ts";
export function validateTimes(recipe: QualityRecipe): QualityIssue[] {
  const result: QualityIssue[] = [], p = recipe.preparation;
  for (const [field, value] of [["minutes", recipe.minutes], ["preparation.preparationMinutes", p.preparationMinutes], ["preparation.cookingMinutes", p.cookingMinutes]] as const) {
    if (value !== null && (!Number.isFinite(value) || value < 0)) result.push(issue("INVALID_TIME", "error", "Времето трябва да е неотрицателно число.", field, "time"));
    if (value === null) result.push(issue("UNKNOWN_TIME", "info", "Част от времената не са уточнени от източника.", field, "time"));
  }
  if (recipe.minutes === 0) result.push(issue("ZERO_TOTAL_TIME", "warning", "Общото време е нула; провери времето за приготвяне.", "minutes", "time"));
  if (recipe.minutes !== null && p.preparationMinutes !== null && p.cookingMinutes !== null && Math.abs(recipe.minutes - p.preparationMinutes - p.cookingMinutes) > .01) result.push(issue("INCONSISTENT_TOTAL_TIME", "warning", "Общото време се различава от подготовката и готвенето; възможно е застъпване.", "minutes", "time"));
  p.steps.forEach((step, index) => {
    if (step.durationMinutes !== undefined && (!Number.isFinite(step.durationMinutes) || step.durationMinutes <= 0 || step.durationMinutes > 1440)) result.push(issue("INVALID_STEP_DURATION", "error", "Таймерът трябва да е между 1 секунда и 24 часа.", `preparation.steps[${index}].durationMinutes`, "time"));
    if (step.durationMinutes !== undefined && step.durationMinutes < 1 / 60) result.push(issue("INVALID_TIMER_DURATION", "error", "Таймерът трябва да е поне една секунда.", `preparation.steps[${index}].durationMinutes`, "time"));
    if (recipe.minutes !== null && (step.durationMinutes ?? 0) > recipe.minutes) result.push(issue("STEP_EXCEEDS_TOTAL", "warning", "Една стъпка е по-дълга от общото време; провери времената.", `preparation.steps[${index}].durationMinutes`, "time"));
  });
  // Never sum steps: preparation and cooking operations can run concurrently.
  return result;
}
