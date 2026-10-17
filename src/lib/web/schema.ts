import { qualityResultSchema } from "../recipe-quality/quality-types.ts";
import { z } from "zod";
import { permissionSchema } from "./permissions.ts";
import { publicRecipeUrl, webIdPattern, webRecipeId } from "./url.ts";
const text = z.string().trim().min(1).max(3000);
const url = z.string().max(2048).refine((value) => { try { publicRecipeUrl(value); return true; } catch { return false; } });
const minutes = z.number().min(0).max(10080).nullable();
export const webRecipeSchema = z.object({
  id: z.string().regex(webIdPattern), title: text, description: z.string().max(3000), servings: z.number().int().min(1).max(20), minutes, difficulty: z.enum(["Лесна", "Средна"]).nullable(), category: text, tags: z.array(text).max(20), cuisine: text.optional(),
  source: z.object({ kind: z.literal("web"), mode: z.literal("live"), name: text, url, reuse: permissionSchema, discoveryType: z.literal("web_licensed").optional() }).strict(),
  visual: z.object({ kind: z.literal("placeholder"), name: z.literal("recipe") }).strict(), imageUrl: z.null(),
  preparation: z.object({ preparationMinutes: minutes, cookingMinutes: minutes,
    ingredients: z.array(z.object({ id: text, name: text, quantity: z.number().positive().max(100000).nullable(), unit: z.enum(["g", "kg", "ml", "l", "piece", "tsp", "tbsp"]).nullable(), originalText: text, quantityStatus: z.enum(["parsed", "unparsed"]) }).strict()).min(1).max(80),
    steps: z.array(z.object({ id: text, title: text, description: text, durationMinutes: z.number().min(1 / 60).max(1440).optional() }).strict()).min(1).max(80), tips: z.array(text).max(20),
  }).strict(),
}).strict().superRefine((recipe, ctx) => {
  const p = recipe.source.reuse;
  if (recipe.id !== webRecipeId(recipe.source.url) || p.contentPermission !== "authorized" || !p.licenseReference || !p.evidenceReference || !p.reviewedAt || (p.expiresAt !== null && p.expiresAt <= Date.now()) || recipe.preparation.ingredients.some((i, index) => i.id !== `ingredient-${index + 1}` || (i.quantity === null) !== (i.unit === null) || (i.quantityStatus === "parsed") !== (i.quantity !== null)) || recipe.preparation.steps.some((s, index) => s.id !== `step-${index + 1}`)) ctx.addIssue({ code: "custom", message: "Invalid authorized recipe" });
});
export const discoverySchema = z.object({ id: z.string().regex(webIdPattern), title: text, url, domain: text, sourceName: text, description: z.string().max(3000), imageUrl: z.null(), rank: z.number().int().positive().max(1000), discoveredAt: z.iso.datetime() }).strict().refine((r) => r.id === webRecipeId(r.url) && new URL(r.url).hostname.replace(/^www\./, "") === r.domain);
export const webResultSchema = discoverySchema.safeExtend({ quality: qualityResultSchema.optional(), permission: permissionSchema, access: z.enum(["complete", "metadata_only"]), discoveryType: z.enum(["web_licensed", "web_metadata_only"]).optional(), recipe: webRecipeSchema.optional(), limitations: z.array(text).max(10) }).superRefine((r, ctx) => {
  if (r.discoveryType && r.discoveryType !== (r.access === "complete" ? "web_licensed" : "web_metadata_only")) ctx.addIssue({ code: "custom", message: "Invalid discovery type" });
  if ((r.access === "complete") !== !!r.recipe || (r.recipe && (r.permission.contentPermission !== "authorized" || r.recipe.id !== r.id || r.recipe.source.url !== r.url || JSON.stringify(r.recipe.source.reuse) !== JSON.stringify(r.permission)))) ctx.addIssue({ code: "custom", message: "Invalid access" });
});
export const webPageSchema = z.object({ results: z.array(webResultSchema).max(10), nextCursor: z.string().regex(/^\d{1,3}:\d{1,2}$/).nullable(), limitations: z.array(text).max(10) }).strict();
