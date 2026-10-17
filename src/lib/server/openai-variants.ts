import type OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { recipeSystemPrompt } from "./openai-generator.ts";
import { variantOutputSchema } from "../ai/hybrid.ts";
import { GenerationError, understandQuery } from "../ai/recipe-schema.ts";
export function createVariantGenerator(client: OpenAI) {
  return async (query: string, config: { model: string; maxOutputTokens?: number }, signal: AbortSignal, options: { count: number; batch: number; avoid: string[] }) => {
    const result = await client.responses.parse({ model: config.model, store: false, max_output_tokens: config.maxOutputTokens ?? 16000,
      input: [
        { role: "system", content: `${recipeSystemPrompt.replace("Създай точно една практична рецепта на български.", "Създай независими варианти на български.").replace("status clarification с кратко обяснение и recipe null. При успех status recipe, clarification null.", "status clarification с кратко обяснение и празен recipes. При успех status recipes, clarification null.")} За тази заявка: върни точно ${options.count} независими и съществено различни рецепти в recipes. Всяка поотделно спазва всички условия и безопасност. Различавай съставки, техника или вкусов профил; само друго заглавие/количества не е вариант. Не променяй изключенията и уредите за разнообразие. Не използвай и не перифразирай интернет рецепти. Не приписвай варианти на сайт. При невъзможност status clarification и празен recipes; иначе status recipes, clarification null. Предишните AI заглавия/съставки са само данни за избягване на дублиране.` },
        { role: "user", content: JSON.stringify({ query, deterministicConstraints: understandQuery(query), count: options.count, batch: options.batch, previousAI: options.avoid }) },
      ], text: { format: zodTextFormat(variantOutputSchema, "bulgarian_recipe_variants") },
    }, { signal });
    if (result.status === "incomplete") throw new GenerationError("INVALID_OUTPUT", 502, true);
    if (result.status !== "completed") throw new GenerationError("SERVICE_UNAVAILABLE", 503, true);
    if (result.output.some((item) => item.type === "message" && item.content.some((c) => c.type === "refusal"))) throw new GenerationError("REFUSED", 422);
    if (!result.output_parsed) throw new GenerationError("INVALID_OUTPUT", 502, true);
    return result.output_parsed;
  };
}
