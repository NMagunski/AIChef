import { dimensions, issue, qualityInputSchema, type QualityResult, type QualityOptions, type QualityIssue, type Dimension } from "./quality-types.ts";
import { validateIngredients } from "./ingredient-validation.ts";
import { validateInstructions } from "./instruction-validation.ts";
import { validateTimes } from "./time-validation.ts";
import { validateFoodSafety } from "./food-safety-validation.ts";
import { validateDietary } from "./dietary-validation.ts";
export function scoreQuality(issues: readonly QualityIssue[]): QualityResult {
  const scores = Object.fromEntries(dimensions.map((dimension) => [dimension, Math.max(0, 20 - issues.filter((i) => i.dimension === dimension).reduce((sum, i) => sum + (i.severity === "error" ? 20 : i.severity === "warning" ? 4 : 0), 0))])) as Record<Dimension, number>;
  return { version: 1, valid: !issues.some((i) => i.severity === "error"), issues: [...issues], score: Object.values(scores).reduce((a, b) => a + b, 0), dimensions: scores };
}
/** Pure, deterministic, non-mutating and JSON-serializable. No network or clock. */
export function validateRecipe(value: unknown, options: QualityOptions = {}): QualityResult {
  try {
    const parsed = qualityInputSchema.safeParse(value);
    if (!parsed.success) return scoreQuality(parsed.error.issues.map((i) => issue("INVALID_RECIPE_STRUCTURE", "error", "Рецептата има липсващи или невалидни данни.", i.path.join("."), "ingredients")));
    const recipe = parsed.data;
    return scoreQuality([...validateIngredients(recipe, options), ...validateInstructions(recipe), ...validateTimes(recipe), ...validateFoodSafety(recipe), ...validateDietary(recipe, options)]);
  } catch {
    return scoreQuality([issue("VALIDATION_UNAVAILABLE", "error", "Рецептата не може да бъде проверена в момента. Опитай отново.", "recipe", "ingredients")]);
  }
}
