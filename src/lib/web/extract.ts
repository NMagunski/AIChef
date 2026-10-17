import { load } from "cheerio";
import { z } from "zod";
import type { Ingredient, RecipeStep, ResolvedRecipe } from "../../types/recipe.ts";
import type { ContentPermission } from "./permissions.ts";
import type { WebSearchResult } from "./types.ts";
import { webRecipeId } from "./url.ts";
import { publicRecipeUrl } from "./url.ts";
const clean = (input: string) => load(`<div>${input}</div>`)("div").first().text().trim().replace(/\s+/gu, " ").slice(0, 3000);
const text = z.string().min(1).max(10000);
const jsonRecipeSchema = z.object({
  name: text, description: z.string().max(10000).optional(),
  recipeIngredient: z.array(z.union([text, z.object({ name: text, value: z.union([z.string(), z.number()]), unitCode: z.string().optional() }).passthrough()])).min(1).max(80).optional(),
  recipeInstructions: z.unknown().optional(), prepTime: z.string().optional(), cookTime: z.string().optional(), totalTime: z.string().optional(),
  recipeYield: z.union([z.string(), z.number(), z.array(z.string()).max(5)]).optional(), recipeCuisine: z.union([z.string(), z.array(z.string()).max(10)]).optional(), recipeCategory: z.union([z.string(), z.array(z.string()).max(10)]).optional(),
  image: z.union([z.string(), z.object({ url: z.string().optional(), contentUrl: z.string().optional() }).passthrough(), z.array(z.union([z.string(), z.object({ url: z.string().optional(), contentUrl: z.string().optional() }).passthrough()])).max(10)]).optional(),
}).passthrough();
export function isoMinutes(input: unknown): number | null {
  if (typeof input !== "string") return null;
  const match = input.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!match || !match.slice(1).some((item) => item !== undefined)) return null;
  const value = Number(match[1] ?? 0) * 1440 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0) + Number(match[4] ?? 0) / 60;
  return Number.isFinite(value) && value >= 0 && value <= 10080 ? value : null;
}
const fractions: Record<string, number> = { "¼": .25, "½": .5, "¾": .75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": .125, "⅜": .375, "⅝": .625, "⅞": .875 };
function amount(input: string) {
  const value = input.replace(",", ".").trim();
  const unicode = value.match(/^(\d+)?\s*([¼½¾⅓⅔⅛⅜⅝⅞])$/u);
  if (unicode) return Number(unicode[1] ?? 0) + fractions[unicode[2]];
  const fraction = value.match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (fraction) return Number(fraction[1] ?? 0) + Number(fraction[2]) / Number(fraction[3]);
  return Number(value);
}
export function parseWebIngredient(input: string, index = 0): Ingredient {
  const originalText = clean(input);
  const fallback: Ingredient = { id: `ingredient-${index + 1}`, name: originalText, quantity: null, unit: null, originalText, quantityStatus: "unparsed" };
  const match = originalText.match(/^((?:\d+\s+)?\d+\/\d+|\d*\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:[.,]\d+)?)\s*(kg|кг|килограма?|g|grams?|гр\.?|г|ml|мл|l|л|liters?|бр\.?|броя?|pieces?|ч\.?\s*л\.?|с\.?\s*л\.?|tsp|tbsp)\s+(.+)$/iu);
  const egg = originalText.match(/^(\d+)\s+(яйца|яйце|eggs?)(.*)$/iu);
  if (!match && !egg) return fallback;
  const quantity = amount((match ?? egg)![1]);
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000) return fallback;
  const token = match?.[2].toLowerCase().replace(/[.\s]/g, "");
  const unit = token && /^(kg|кг|килограм)/u.test(token) ? "kg" : token && /^(g|г|гр|gram)/u.test(token) ? "g" : token && /^(ml|мл)$/u.test(token) ? "ml" : token && /^(l|л|liter)/u.test(token) ? "l" : token && /^(tsp|чл)$/u.test(token) ? "tsp" : token && /^(tbsp|сл)$/u.test(token) ? "tbsp" : "piece";
  return { id: fallback.id, name: match ? match[3] : `${egg![2]}${egg![3]}`, quantity, unit, originalText, quantityStatus: "parsed" };
}
function object(input: unknown): Record<string, unknown> | null { return input && typeof input === "object" && !Array.isArray(input) ? input as Record<string, unknown> : null; }
const typeIs = (node: Record<string, unknown>, type: string) => (Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]]).some((value) => typeof value === "string" && value.split(/[\/#]/).pop() === type);
export function extractInstructions(value: unknown, depth = 0): Omit<RecipeStep, "id">[] {
  if (depth > 10) return [];
  if (typeof value === "string") return value.split(/\n+/u).map(clean).filter(Boolean).map((description) => ({ title: "", description }));
  if (Array.isArray(value)) return value.slice(0, 100).flatMap((item) => extractInstructions(item, depth + 1));
  const node = object(value); if (!node) return [];
  if (typeIs(node, "HowToSection") || typeIs(node, "ItemList")) return extractInstructions(node.itemListElement, depth + 1);
  if (typeof node.text === "string") {
    const duration = isoMinutes(node.duration);
    return [{ title: typeof node.name === "string" ? clean(node.name) : "", description: clean(node.text), ...(duration !== null && duration >= 1 / 60 && duration <= 1440 ? { durationMinutes: duration } : {}) }];
  }
  return [];
}
export function extractRecipe(html: string) {
  if (Buffer.byteLength(html) > 1_000_000) return null;
  const $ = load(html); const nodes: Record<string, unknown>[] = [];
  function visit(value: unknown, depth = 0) {
    if (depth > 10 || nodes.length >= 300) return;
    if (Array.isArray(value)) { value.slice(0, 100).forEach((item) => visit(item, depth + 1)); return; }
    const node = object(value); if (!node) return;
    nodes.push(node);
    for (const key of ["@graph", "mainEntity"]) if (node[key]) visit(node[key], depth + 1);
  }
  $("script").each((_index, element) => {
    if (nodes.length >= 300 || ($(element).attr("type") ?? "").split(";")[0].trim().toLowerCase() !== "application/ld+json") return;
    const raw = $(element).text();
    if (raw.length > 500000) return;
    try { visit(JSON.parse(raw)); } catch { /* Invalid JSON-LD never executes. */ }
  });
  for (const node of nodes) {
    if (!typeIs(node, "Recipe")) continue;
    const parsed = jsonRecipeSchema.safeParse(node); if (!parsed.success) continue;
    const data = parsed.data;
    const ingredients = (data.recipeIngredient ?? []).map((item, index) => parseWebIngredient(typeof item === "string" ? item : `${item.value} ${item.unitCode === "GRM" ? "g" : item.unitCode === "KGM" ? "kg" : item.unitCode ?? ""} ${item.name}`, index));
    function dereference(value: unknown, depth = 0): unknown {
      if (depth > 10) return null;
      if (Array.isArray(value)) return value.slice(0, 100).map((v) => dereference(v, depth + 1));
      const item = object(value); if (!item) return value;
      if (typeof item["@id"] === "string" && !item.text && !item.itemListElement) { const found = nodes.find((n) => n !== item && n["@id"] === item["@id"] && (n.text || n.itemListElement)); if (found) return dereference(found, depth + 1); }
      return { ...item, ...(item.itemListElement ? { itemListElement: dereference(item.itemListElement, depth + 1) } : {}) };
    }
    const steps = extractInstructions(dereference(data.recipeInstructions)).filter((step) => step.description).slice(0, 80).map((step, index) => ({ ...step, id: `step-${index + 1}`, title: step.title || `Стъпка ${index + 1}` }));
    const yieldText = String(Array.isArray(data.recipeYield) ? data.recipeYield[0] : data.recipeYield ?? "");
    const yieldMatch = yieldText.match(/^(?:serves\s*)?(\d+)\s*(?:порци[ия]|servings?|човека|души)?$/iu);
    const servings = yieldMatch && Number(yieldMatch[1]) >= 1 && Number(yieldMatch[1]) <= 20 ? Number(yieldMatch[1]) : null;
    const preparationMinutes = isoMinutes(data.prepTime), cookingMinutes = isoMinutes(data.cookTime), total = isoMinutes(data.totalTime);
    const minutes = total ?? (preparationMinutes !== null && cookingMinutes !== null ? preparationMinutes + cookingMinutes : null);
    const firstText = (value: string | string[] | undefined) => clean(Array.isArray(value) ? value[0] ?? "" : value ?? "");
    const image = Array.isArray(data.image) ? data.image[0] : data.image;
    let imageUrl: string | null = null;
    try { const candidate = typeof image === "string" ? image : image?.contentUrl ?? image?.url; if (candidate) imageUrl = publicRecipeUrl(candidate); } catch { /* Images remain optional; never fetch them here. */ }
    return { title: clean(data.name), description: clean(data.description ?? ""), ingredients, steps, servings, preparationMinutes, cookingMinutes, minutes, imageUrl, cuisine: firstText(data.recipeCuisine), category: firstText(data.recipeCategory) };
  }
  return null;
}
export function normalizeAuthorizedRecipe(discovery: WebSearchResult, extracted: NonNullable<ReturnType<typeof extractRecipe>>, permission: ContentPermission): ResolvedRecipe | null {
  if (permission.contentPermission !== "authorized" || !extracted.servings || !extracted.ingredients.length || !extracted.steps.length || !extracted.title) return null;
  return {
    id: webRecipeId(discovery.url), title: extracted.title, description: extracted.description,
    servings: extracted.servings, minutes: extracted.minutes, difficulty: null, category: extracted.category || "Рецепта от интернет", tags: [], cuisine: extracted.cuisine || undefined,
    source: { kind: "web", mode: "live", name: discovery.sourceName, url: discovery.url, reuse: permission, discoveryType: "web_licensed" }, visual: { kind: "placeholder", name: "recipe" }, imageUrl: null,
    preparation: { preparationMinutes: extracted.preparationMinutes, cookingMinutes: extracted.cookingMinutes, ingredients: extracted.ingredients, steps: extracted.steps, tips: [] },
  };
}
