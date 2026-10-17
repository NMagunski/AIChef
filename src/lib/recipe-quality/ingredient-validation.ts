import { issue, normalize, type QualityRecipe, type QualityOptions, type QualityIssue } from "./quality-types.ts";
import { ingredientKey, seasoning } from "./ingredients.ts";
export function validateIngredients(recipe: QualityRecipe, options: QualityOptions): QualityIssue[] {
  const result: QualityIssue[] = [], ids = new Set<string>(), names = new Set<string>();
  if (!Number.isInteger(recipe.servings) || recipe.servings < 1 || recipe.servings > 20) result.push(issue("INVALID_SERVINGS", "error", "Броят порции трябва да е между 1 и 20.", "servings", "quantities"));
  if (!recipe.preparation.ingredients.length) result.push(issue("MISSING_INGREDIENTS", "error", "Липсва списък с продукти.", "preparation.ingredients", "ingredients"));
  recipe.preparation.ingredients.forEach((item, index) => {
    const field = `preparation.ingredients[${index}]`, key = ingredientKey(item.name);
    if (!item.name.trim()) result.push(issue("MISSING_INGREDIENT_NAME", "error", "Продуктът няма име.", `${field}.name`, "ingredients"));
    if (!item.id.trim() || ids.has(item.id)) result.push(issue("DUPLICATE_INGREDIENT_ID", "error", "Продуктите трябва да имат различни идентификатори.", `${field}.id`, "ingredients"));
    ids.add(item.id);
    // Exact names or a small unambiguous synonym set; different cuts/forms are not duplicates.
    const duplicateKey = ["mushrooms", "rice", "potatoes", "salt"].includes(key) ? key : normalize(item.name);
    if (names.has(duplicateKey)) result.push(issue("DUPLICATE_INGREDIENT", "warning", "Възможно е продукт да е добавен два пъти; провери количествата.", field, "ingredients"));
    names.add(duplicateKey);
    if (item.quantity !== null && (!Number.isFinite(item.quantity) || item.quantity <= 0)) result.push(issue("INVALID_INGREDIENT_QUANTITY", "error", "Количеството трябва да е положително число.", `${field}.quantity`, "quantities"));
    if (item.unit !== null && !["g", "kg", "ml", "l", "piece", "tsp", "tbsp"].includes(item.unit)) result.push(issue("UNSUPPORTED_UNIT", "error", "Мерната единица не се поддържа.", `${field}.unit`, "quantities"));
    if ((item.quantity === null) !== (item.unit === null)) result.push(issue("INCOMPLETE_QUANTITY", "error", "Количеството и мерната единица трябва да са посочени заедно.", field, "quantities"));
    if (item.quantity === null && !seasoning(item.name)) result.push(issue("MISSING_QUANTITY", item.quantityStatus === "unparsed" ? "warning" : "error", "Липсва измеримо количество за основен продукт.", `${field}.quantity`, "ingredients"));
    const perServing = (item.quantity ?? 0) / Math.max(1, recipe.servings);
    const mass = item.unit === "kg" ? perServing * 1000 : item.unit === "g" ? perServing : 0;
    const volume = item.unit === "l" ? perServing * 1000 : item.unit === "ml" ? perServing : 0;
    if (mass > (options.maxMassGramsPerServing ?? 1000) || volume > (options.maxVolumeMlPerServing ?? 2000) || (item.unit === "piece" && perServing > (options.maxPiecesPerServing ?? 20))) result.push(issue("UNUSUAL_QUANTITY", "warning", "Количеството на порция изглежда необичайно голямо; провери го.", `${field}.quantity`, "quantities"));
    if ((item.unit === "piece" && /мляко|вода|олио|брашно/u.test(normalize(item.name))) || (["ml", "l"].includes(item.unit ?? "") && /яйц|картоф/u.test(normalize(item.name)))) result.push(issue("SUSPICIOUS_UNIT", "warning", "Провери дали мерната единица е подходяща за този продукт.", `${field}.unit`, "quantities"));
  });
  return result;
}
