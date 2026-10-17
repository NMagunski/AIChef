import { z } from "zod";
import { discoverySchema } from "../../web/schema.ts";
import { WebSearchError } from "../../web/errors.ts";
import type { WebSearchProvider } from "../../web/types.ts";
import { normalizeWebQuery } from "../../web/query.ts";
import type { SecurityController } from "./controller.ts";
const pageSchema = z.object({ results: z.array(discoverySchema).max(10), nextCursor: z.string().regex(/^[1-9]0$/u).nullable() }).strict();
export function protectWebProvider(provider: WebSearchProvider, security: () => SecurityController): WebSearchProvider {
  return { async searchRecipes(query, options = {}) {
    const protection = security(), start = options.start ?? 0;
    if (!Number.isInteger(start) || start < 0 || start % 10 !== 0 || start >= protection.config.webMaxPages * 10) throw new WebSearchError("INVALID_REQUEST", 400);
    const client = protection.currentClient();
    const result = await protection.execute("web", client, JSON.stringify([normalizeWebQuery(query), start]), 1, 0, () => provider.searchRecipes(query, options), (data): data is z.infer<typeof pageSchema> => pageSchema.safeParse(data).success);
    return { ...result, nextCursor: result.nextCursor && Number(result.nextCursor) < protection.config.webMaxPages * 10 ? result.nextCursor : null };
  } };
}
