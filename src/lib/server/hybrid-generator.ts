import { z } from "zod";
import { createGenerateHandler, type GenerateDependencies } from "./generate-handler.ts";
import { GenerationError, type ModelRecipe } from "../ai/recipe-schema.ts";
import { validateAIBundle, normalizeVariant, nearDuplicate, requiredAIRecipes, isLicensedResult, type AIBundle } from "../ai/hybrid.ts";
import type { ResolvedRecipe } from "../../types/recipe.ts";
import type { WebSearchPage } from "../web/types.ts";
import { mapGenerationError } from "../ai/errors.ts";
const envelope = z.object({ status: z.enum(["recipes", "clarification"]), clarification: z.string().max(2000).nullable(), recipes: z.array(z.unknown()).max(3) }).strict();
export function extraBatchLimit(env: Record<string, string | undefined>) { const value = env.AI_DISCOVERY_MAX_EXTRA_BATCHES ?? "1"; return /^[0-2]$/.test(value) ? Number(value) : 0; }
export function validateEquipment(recipe: ModelRecipe, query: string) {
  const q = query.toLocaleLowerCase("bg"), instructions = recipe.instructions.map((s) => s.description).join(" ").toLocaleLowerCase("bg");
  const noOven = /без\s+фурна|само\s+(?:на\s+)?котлон|вместо\s+(?:във?\s+)?фурна/u.test(q);
  if ((noOven && /фурн/u.test(instructions)) || (!noOven && /(?:във?|на)\s+фурна/u.test(q) && !/фурн/u.test(instructions)) || (/в\s+тенджера/u.test(q) && !/тенджер/u.test(instructions)) || (/еър\s*фрай|air\s*fryer/u.test(q) && !/еър\s*фрай|air\s*fryer/u.test(instructions))) throw new GenerationError("CONSTRAINTS", 422);
}
export type VariantGenerator = (query: string, config: { apiKey: string; model: string }, signal: AbortSignal, options: { count: number; batch: number; avoid: string[] }) => Promise<unknown>;
/** Server decides count/limits. No publisher text, snippets, URLs or recipes enter
 * the generator; avoid contains only previously validated AI fingerprints. */
export function createHybridGenerateHandler(options: {
  security?: GenerateDependencies["security"]; config: GenerateDependencies["config"]; generate: VariantGenerator;
  search: (query: string) => Promise<WebSearchPage>; hasAuthorizedSources: () => boolean;
  maxExtraBatches: () => number; now?: () => number; timeoutMs?: number;
}) {
  const history = new Map<string, { until: number; recipes: ResolvedRecipe[] }>();
  const attempts = new Map<string, { until: number; count: number; blocked?: GenerationError }>();
  const now = options.now ?? Date.now;
  const historyKey = (query: string, model: string) => JSON.stringify([model, query.normalize("NFKC").trim().replace(/\s+/gu, " ").toLocaleLowerCase("bg")]);
  return createGenerateHandler({ security: options.security, config: options.config, maxExtraBatches: options.maxExtraBatches, now, timeoutMs: options.timeoutMs,
    generate: async (query, config, signal, batch = 0) => {
      const key = historyKey(query, config.model);
      for (const [id, value] of attempts) if (value.until <= now()) attempts.delete(id);
      const attemptKey = `${key}:${batch}`;
      const attempt: { until: number; count: number; blocked?: GenerationError } = attempts.get(attemptKey) ?? { until: now() + 600000, count: 0 };
      if (attempt.blocked) throw attempt.blocked;
      if (attempt.count >= (batch ? 1 : 2)) throw new GenerationError("GENERATION_LIMIT", 422);
      if (attempts.size >= 300) throw new GenerationError("RATE_LIMIT", 429, true);
      let licensed = 0;
      if (!batch && options.hasAuthorizedSources()) {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try { const page = await Promise.race([options.search(query), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("WEB_BUDGET")), 6000); })]); licensed = page.results.filter(isLicensedResult).length; } catch { /* Web failure does not prevent independent AI fallback. */ }
        finally { if (timer) clearTimeout(timer); }
      }
      signal.throwIfAborted();
      attempt.count++; attempts.set(attemptKey, attempt);
      for (const [id, value] of history) if (value.until <= now()) history.delete(id);
      const prior = history.get(key)?.recipes ?? [];
      const count = batch ? 2 : requiredAIRecipes(licensed);
      let output: unknown;
      try { output = await options.generate(query, config, signal, { count, batch, avoid: prior.map((r) => JSON.stringify({ title: r.title.slice(0, 160), ingredients: r.preparation?.ingredients.slice(0, 40).map((i) => i.name.slice(0, 80)) })).slice(0, 7) }); }
      catch (error) { const mapped = mapGenerationError(error); if (["INSUFFICIENT_QUOTA", "AUTHENTICATION_ERROR"].includes(mapped.code)) attempt.blocked = mapped; throw mapped; }
      return { output, count };
    },
    decode: (value, query, model, batch): AIBundle => {
      const wrapped = z.object({ output: z.unknown(), count: z.number().int().min(1).max(3) }).parse(value);
      const parsed = envelope.safeParse(wrapped.output);
      if (!parsed.success) throw new GenerationError("INVALID_OUTPUT", 502, true);
      if (parsed.data.status === "clarification") throw new GenerationError("CONSTRAINTS", 422, false, parsed.data.clarification ?? undefined);
      const key = historyKey(query, model), prior = history.get(key)?.recipes ?? [];
      const bundle: AIBundle = { alternatives: [], issues: [], maxExtraBatches: options.maxExtraBatches() };
      const accepted: ResolvedRecipe[] = [];
      for (const [index, raw] of parsed.data.recipes.slice(0, wrapped.count).entries()) {
        try {
          const recipe = normalizeVariant(raw, query, model, batch === 0 && index === 0 ? "ai_original" : "ai_alternative");
          validateEquipment(raw as ModelRecipe, query);
          if ([...prior, ...accepted].some((r) => nearDuplicate(r, recipe))) { bundle.issues.push("Пропуснат е прекалено сходен AI вариант."); continue; }
          accepted.push(recipe);
          if (!batch && index === 0) bundle.recipe = recipe; else bundle.alternatives.push(recipe);
        } catch { bundle.issues.push("AI вариант не спази формата или условията и не е показан."); }
      }
      if (!accepted.length) throw new GenerationError("INVALID_OUTPUT", 502, true);
      if (accepted.length < wrapped.count && !bundle.issues.length) bundle.issues.push("Получени са по-малко валидни AI варианти от заявените.");
      if (history.size >= 100) history.delete(history.keys().next().value!);
      history.set(key, { recipes: [...prior, ...accepted].slice(0, 7), until: now() + 600000 });
      return validateAIBundle(bundle, query);
    },
  });
}
