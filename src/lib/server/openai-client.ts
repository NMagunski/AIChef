import { getSecurityController } from "./security/runtime";
import "server-only";
import OpenAI from "openai";
import { createOpenAIGenerator } from "./openai-generator";
import { REQUEST_TIMEOUT_MS } from "./generate-handler";
import { createVariantGenerator } from "./openai-variants";
export async function generateVariantsWithOpenAI(query: string, config: { apiKey: string; model: string }, signal: AbortSignal, options: { count: number; batch: number; avoid: string[] }) {
  const client = new OpenAI({ apiKey: config.apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
  return createVariantGenerator(client)(query, { ...config, maxOutputTokens: getSecurityController().config.maxOutputTokens }, signal, options);
}
export async function generateWithOpenAI(query: string, config: { apiKey: string; model: string }, signal: AbortSignal) {
  const client = new OpenAI({ apiKey: config.apiKey, timeout: REQUEST_TIMEOUT_MS, maxRetries: 0 });
  return createOpenAIGenerator(client)(query, { ...config, maxOutputTokens: Math.min(8000, getSecurityController().config.maxOutputTokens) }, signal);
}
