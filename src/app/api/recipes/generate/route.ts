import { getSecurityController } from "@/lib/server/security/runtime";
import "server-only";
import { readAIConfig } from "@/lib/server/generate-handler";
import { generateVariantsWithOpenAI } from "@/lib/server/openai-client";
import { createHybridGenerateHandler, extraBatchLimit } from "@/lib/server/hybrid-generator";
import { searchWebRecipes } from "@/lib/server/web/search-runtime";
import { authorizedSources } from "@/lib/server/web/authorized-sources";

export const runtime = "nodejs";
export const maxDuration = 60;
export const POST = createHybridGenerateHandler({ security: getSecurityController, config: () => readAIConfig(process.env), generate: generateVariantsWithOpenAI, search: searchWebRecipes, hasAuthorizedSources: () => authorizedSources.length > 0, maxExtraBatches: () => extraBatchLimit(process.env) });
