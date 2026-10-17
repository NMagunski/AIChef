import { z } from "zod";
export const dimensions = ["ingredients", "instructions", "time", "quantities", "constraints"] as const;
export type Dimension = typeof dimensions[number];
export type QualityIssue = { code: string; severity: "error" | "warning" | "info"; message: string; field: string; dimension: Dimension };
export type QualityResult = { version: 1; valid: boolean; issues: QualityIssue[]; score: number; dimensions: Record<Dimension, number> };
export const qualityResultSchema = z.object({ version: z.literal(1), valid: z.boolean(), issues: z.array(z.object({ code: z.string().max(100), severity: z.enum(["error", "warning", "info"]), message: z.string().max(2000), field: z.string().max(200), dimension: z.enum(dimensions) }).strict()).max(1000), score: z.number().int().min(0).max(100), dimensions: z.object({ ingredients: z.number().min(0).max(20), instructions: z.number().min(0).max(20), time: z.number().min(0).max(20), quantities: z.number().min(0).max(20), constraints: z.number().min(0).max(20) }).strict() }).strict();
/** A projection of the canonical model, not a second recipe dataset or provenance schema.
 * Provider-specific schemas still validate provenance, permissions and checksums first. */
export const qualityInputSchema = z.object({
  title: z.string(), servings: z.number(), minutes: z.number().nullable(),
  preparation: z.object({ preparationMinutes: z.number().nullable(), cookingMinutes: z.number().nullable(),
    ingredients: z.array(z.object({ id: z.string(), name: z.string(), quantity: z.number().nullable(), unit: z.string().nullable(), quantityStatus: z.enum(["parsed", "unparsed"]).optional() })),
    steps: z.array(z.object({ id: z.string(), title: z.string(), description: z.string(), durationMinutes: z.number().optional(), temperatureC: z.number().optional(), tip: z.string().optional() })), tips: z.array(z.string()),
  }),
});
export type QualityRecipe = z.infer<typeof qualityInputSchema>;
export type QualityOptions = { query?: string; excludedIngredients?: readonly string[]; maxMassGramsPerServing?: number; maxVolumeMlPerServing?: number; maxPiecesPerServing?: number };
export function issue(code: string, severity: QualityIssue["severity"], message: string, field: string, dimension: Dimension): QualityIssue { return { code, severity, message, field, dimension }; }
export const normalize = (value: string) => value.normalize("NFKC").toLocaleLowerCase("bg").replace(/\s+/gu, " ").trim();
