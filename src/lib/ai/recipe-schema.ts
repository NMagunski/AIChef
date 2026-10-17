import { validateRecipe } from "../recipe-quality/validate-recipe.ts";
import { z } from "zod";
import type { ResolvedRecipe } from "../../types/recipe.ts";

export const querySchema = z.object({ query: z.string().trim().min(1).max(500) }).strict();
const text = z.string().trim().min(1).max(2000);
const unit = z.enum(["g", "kg", "ml", "l", "piece", "tsp", "tbsp"]);
const ingredient = z.object({ name: text, quantity: z.number().positive().max(100000).nullable(), unit: unit.nullable(), note: text.nullable(), availability: z.enum(["available", "additional", "unspecified"]) }).strict();
const step = z.object({ number: z.number().int().min(1).max(30), title: text, description: text, durationMinutes: z.number().min(1 / 60).max(1440).nullable(), temperatureC: z.number().min(30).max(300).nullable(), tip: text.nullable(), ingredientIndices: z.array(z.number().int().min(0).max(39)).max(40) }).strict();
export const modelRecipeSchema = z.object({
  title: text, description: text, servings: z.number().int().min(1).max(20),
  preparationTime: z.number().int().min(0).max(1440), cookingTime: z.number().int().min(0).max(1440),
  difficulty: z.enum(["Лесна", "Средна"]), cuisine: text, category: text,
  ingredients: z.array(ingredient).min(1).max(40), instructions: z.array(step).min(1).max(30), cookingTips: z.array(text).max(10), tags: z.array(text).max(10),
}).strict();
export const modelOutputSchema = z.object({ status: z.enum(["recipe", "clarification"]), clarification: text.nullable(), recipe: modelRecipeSchema.nullable() }).strict();
export type ModelRecipe = z.infer<typeof modelRecipeSchema>;

export class GenerationError extends Error {
  code: string; status: number; retryable: boolean; retryAfter: number; explanation?: string;
  constructor(code: string, status: number, retryable = false, explanation?: string, retryAfter = 0) { super(code); this.code = code; this.status = status; this.retryable = retryable; this.explanation = explanation; this.retryAfter = retryAfter; }
}

export function understandQuery(query: string) {
  const normalized = query.toLocaleLowerCase("bg");
  const numberWords: Record<string, number> = { един: 1, една: 1, двама: 2, две: 2, два: 2, три: 3, четири: 4, пет: 5, шест: 6, седем: 7, осем: 8, девет: 9, десет: 10, единадесет: 11, дванадесет: 12, тринадесет: 13, четиринадесет: 14, петнадесет: 15, шестнадесет: 16, седемнадесет: 17, осемнадесет: 18, деветнадесет: 19, двадесет: 20 };
  const expanded = normalized.replace(new RegExp(`(${Object.keys(numberWords).sort((a, b) => b.length - a.length).join("|")})(?=\\s+(?:порци|човека|души))`, "gu"), (word) => String(numberWords[word]));
  const serving = expanded.match(/(?:за\s+)?(-?\d+)\s*(?:порци[ия]|човека|души)/u);
  const limit = normalized.match(/до\s+(-?\d+)\s*мин/u);
  const excluded = [...normalized.matchAll(/без\s+([^.!?;]+)/gu)].flatMap((match) => match[1].split(/\s+и\s+|,|\s+за\s+|\s+до\s+/u).slice(0, 6)).map((name) => name.trim()).filter(Boolean);
  return { servings: serving ? Number(serving[1]) : 4, maxMinutes: limit ? Number(limit[1]) : null, excluded };
}
const key = (text: string) => text.normalize("NFKC").toLocaleLowerCase("bg");


export function validateModelRecipe(value: unknown, query: string): ModelRecipe {
  const result = modelRecipeSchema.safeParse(value);
  if (!result.success) throw new GenerationError("INVALID_OUTPUT", 502, true);
  const recipe = result.data;
  const intent = understandQuery(query);
  if (recipe.servings !== intent.servings || (intent.maxMinutes !== null && recipe.preparationTime + recipe.cookingTime > intent.maxMinutes)) throw new GenerationError("CONSTRAINTS", 422);
  const used = new Set<number>();
  if (recipe.preparationTime + recipe.cookingTime <= 0) throw new GenerationError("INVALID_OUTPUT", 502, true);
  recipe.ingredients.forEach((item) => {
    if ((item.quantity === null) !== (item.unit === null) || (item.quantity === null && !/сол|пипер|подправ|магданоз|копър/u.test(key(item.name)))) throw new GenerationError("INVALID_OUTPUT", 502, true);
  });
  recipe.instructions.forEach((item, index) => {
    if ((item.durationMinutes !== null && item.durationMinutes > recipe.preparationTime + recipe.cookingTime) || item.number !== index + 1 || new Set(item.ingredientIndices).size !== item.ingredientIndices.length || item.ingredientIndices.some((i) => i >= recipe.ingredients.length)) throw new GenerationError("INVALID_OUTPUT", 502, true);
    item.ingredientIndices.forEach((i) => used.add(i));
  });
  if (used.size !== recipe.ingredients.length) throw new GenerationError("INVALID_OUTPUT", 502, true);
  if (!validateRecipe(normalizeRecipe(recipe, "validation"), { query }).valid) throw new GenerationError("CONSTRAINTS", 422);
  return recipe;
}

export const safetyTip = "Проверявай с кухненски термометър вътрешната температура: птиче месо 74°C; кайма и ястия с яйца 71°C; риба 63°C; цели парчета свинско, говеждо и агнешко 63°C и 3 минути почивка. Цветът сам по себе си не доказва безопасност. Избягвай кръстосано замърсяване от сурови продукти.";
export const safetySource = "https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart";

export function generatedRecipeId(value: unknown): string {
  const input = JSON.stringify(value);
  let first = 2166136261, second = 5381;
  for (let index = 0; index < input.length; index++) { first = Math.imul(first ^ input.charCodeAt(index), 16777619); second = Math.imul(second, 33) ^ input.charCodeAt(index); }
  return `ai-${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}
export const generatedIdPattern = /^ai-[a-f0-9]{16}$/;

export function normalizeRecipe(raw: ModelRecipe, model: string): ResolvedRecipe {
  const recipe: ResolvedRecipe = {
    id: "", title: raw.title, description: raw.description, servings: raw.servings, minutes: raw.preparationTime + raw.cookingTime,
    difficulty: raw.difficulty, category: raw.category, cuisine: raw.cuisine, tags: raw.tags,
    source: { kind: "ai", mode: "live", model }, visual: { kind: "placeholder", name: "recipe" }, imageUrl: null,
    preparation: {
      preparationMinutes: raw.preparationTime, cookingMinutes: raw.cookingTime,
      ingredients: raw.ingredients.map((item, index) => ({ id: `ingredient-${index + 1}`, name: item.name, quantity: item.quantity, unit: item.unit, ...(item.note ? { note: item.note } : {}), availability: item.availability })),
      steps: raw.instructions.map((item) => ({ id: `step-${item.number}`, title: item.title, description: item.description, ...(item.durationMinutes !== null ? { durationMinutes: item.durationMinutes } : {}), ...(item.temperatureC !== null ? { temperatureC: item.temperatureC } : {}), ...(item.tip ? { tip: item.tip } : {}) })),
      tips: [...raw.cookingTips, safetyTip],
    },
  };
  recipe.id = generatedRecipeId({ ...recipe, id: "" });
  return recipe;
}

const cachedIngredient = z.object({ id: text, name: text, quantity: z.number().positive().max(100000).nullable(), unit: unit.nullable(), note: text.optional(), availability: z.enum(["available", "additional", "unspecified"]) }).strict();
export const generatedRecipeSchema = z.object({
  id: z.string().regex(generatedIdPattern), title: text, description: text, servings: z.number().int().min(1).max(20), minutes: z.number().positive().max(2880), difficulty: z.enum(["Лесна", "Средна"]), category: text, cuisine: text, tags: z.array(text).max(10),
  source: z.object({ kind: z.literal("ai"), mode: z.literal("live"), model: text, discoveryType: z.enum(["ai_original", "ai_alternative"]).optional() }).strict(), visual: z.object({ kind: z.literal("placeholder"), name: z.literal("recipe") }).strict(), imageUrl: z.null(),
  preparation: z.object({ preparationMinutes: z.number().int().min(0).max(1440), cookingMinutes: z.number().int().min(0).max(1440), ingredients: z.array(cachedIngredient).min(1).max(40), steps: z.array(z.object({ id: text, title: text, description: text, durationMinutes: z.number().min(1 / 60).max(1440).optional(), temperatureC: z.number().min(30).max(300).optional(), tip: text.optional() }).strict()).min(1).max(30), tips: z.array(text).min(1).max(11) }).strict(),
}).strict().superRefine((recipe, context) => {
  if (recipe.id !== generatedRecipeId({ ...recipe, id: "" }) || recipe.minutes !== recipe.preparation.preparationMinutes + recipe.preparation.cookingMinutes || !recipe.preparation.tips.includes(safetyTip) || recipe.preparation.ingredients.some((item, index) => item.id !== `ingredient-${index + 1}` || (item.quantity === null) !== (item.unit === null)) || recipe.preparation.steps.some((item, index) => item.id !== `step-${index + 1}`)) context.addIssue({ code: "custom", message: "Invalid canonical recipe" });
});
