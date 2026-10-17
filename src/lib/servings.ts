import type { Ingredient, IngredientUnit } from "@/types/recipe";

export const minimumServings = 1;
export const maximumServings = 20;

export function parseServings(value: string | string[] | undefined): number | undefined {
  const text = (Array.isArray(value) ? value[0] : value)?.trim();
  if (!text || !/^\d{1,2}$/.test(text)) return undefined;
  const number = Number(text);
  return number >= minimumServings && number <= maximumServings ? number : undefined;
}

function validateServings(value: number) {
  if (!Number.isInteger(value) || value < minimumServings || value > maximumServings) throw new RangeError("Servings must be an integer from 1 to 20.");
}

export function scaleQuantity(quantity: number | null, baseServings: number, targetServings: number): number | null {
  validateServings(baseServings);
  validateServings(targetServings);
  if (quantity === null) return null;
  if (!Number.isFinite(quantity) || quantity < 0) throw new RangeError("Quantity must be finite and non-negative.");
  const result = quantity * (targetServings / baseServings);
  if (!Number.isFinite(result)) throw new RangeError("Scaled quantity exceeds the supported range.");
  return result;
}

/** Always derives from base quantities and returns new objects; units never change. */
export function scaleIngredients(ingredients: readonly Ingredient[], baseServings: number, targetServings: number): Ingredient[] {
  validateServings(baseServings);
  validateServings(targetServings);
  return ingredients.map((ingredient) => ({ ...ingredient, quantity: scaleQuantity(ingredient.quantity, baseServings, targetServings) }));
}

const units: Record<IngredientUnit, string> = { g: "г", kg: "кг", ml: "мл", l: "л", piece: "бр.", tsp: "ч.л.", tbsp: "с.л." };
const fractions: [number, string][] = [[1 / 8, "⅛"], [1 / 4, "¼"], [1 / 3, "⅓"], [1 / 2, "½"], [2 / 3, "⅔"], [3 / 4, "¾"], [7 / 8, "⅞"]];
const formatter = new Intl.NumberFormat("bg-BG", { maximumFractionDigits: 4 });

export function formatQuantity(quantity: number, unit: IngredientUnit | null): string {
  if (!Number.isFinite(quantity) || quantity < 0) throw new RangeError("Quantity must be finite and non-negative.");
  if (quantity === 0) return "0";
  if (quantity > 0 && quantity < 0.0001) return "<0,0001";
  if (unit === "piece" || unit === "tsp" || unit === "tbsp") {
    const whole = Math.floor(quantity);
    const fraction = fractions.find(([value]) => Math.abs(quantity - whole - value) < 1e-8);
    if (fraction) return `${whole ? `${whole} ` : ""}${fraction[1]}`;
  }
  return formatter.format(quantity);
}

export function formatIngredientAmount(ingredient: Ingredient): string {
  if (ingredient.quantity === null) return ingredient.quantityStatus === "unparsed" ? "Количество по оригинала · не се преизчислява" : ingredient.note ?? "На вкус";
  return `${formatQuantity(ingredient.quantity, ingredient.unit)}${ingredient.unit ? ` ${units[ingredient.unit]}` : ""}`;
}
