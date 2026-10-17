import test from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import { createHybridGenerateHandler, type VariantGenerator } from "../../src/lib/server/hybrid-generator.ts";
import { createVariantGenerator } from "../../src/lib/server/openai-variants.ts";
import { selectHybridRecipes, aiBundleSchema } from "../../src/lib/ai/hybrid.ts";
import { GenerationError } from "../../src/lib/ai/recipe-schema.ts";
import { webResult } from "../helpers/web-recipe.ts";
import { variantModel } from "../helpers/hybrid-recipe.ts";
const config = () => ({ apiKey: "mock-secret", model: "mock-model" });
const request = (body: unknown = { query: "Пиле" }) => new Request("http://localhost/api/recipes/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const output = (count: number, batch = 0) => ({ status: "recipes", clarification: null, recipes: Array.from({ length: count }, (_, index) => variantModel(index + (batch ? 3 : 0))) });
const generate: VariantGenerator = async (_q, _c, _s, options) => output(options.count, options.batch);
const emptySearch = async () => ({ results: [], nextCursor: null, limitations: [] });
for (const licensed of [2, 1, 0]) test(`hybrid API one original + ${licensed} licensed + ${2 - licensed} alternatives uses one structured call`, async () => {
  const web = Array.from({ length: licensed }, (_, i) => webResult(i + 1)); let calls = 0;
  const handler = createHybridGenerateHandler({ config, generate: async (q, c, s, o) => { calls++; assert.equal(o.count, 3 - licensed); assert.equal(JSON.stringify(o).includes("https://"), false); return generate(q, c, s, o); }, hasAuthorizedSources: () => licensed > 0, search: async () => ({ results: web, nextCursor: null, limitations: [] }), maxExtraBatches: () => 1 });
  const response = await handler(request()); assert.equal(response.status, 200); const body = aiBundleSchema.parse(await response.json());
  assert.equal(body.alternatives.length, 2 - licensed); assert.equal(calls, 1);
  assert.equal(selectHybridRecipes(body.recipe, body.alternatives, web).initial.length, 3);
  assert.equal(body.recipe!.source.kind, "ai"); assert.equal(body.recipe!.source.discoveryType, "ai_original");
});
test("no licensed results and incomplete web data use independent AI fallback", async () => {
  const handler = createHybridGenerateHandler({ config, generate, hasAuthorizedSources: () => true, search: async () => ({ results: [webResult(1, false)], nextCursor: null, limitations: [] }), maxExtraBatches: () => 0 });
  const body = await (await handler(request())).json(); assert.equal(body.alternatives.length, 2); assert.equal(body.alternatives[0].source.discoveryType, "ai_alternative"); assert.equal(body.alternatives[0].source.url, undefined);
});
test("web provider unavailable does not prevent a valid AI bundle", async () => {
  const handler = createHybridGenerateHandler({ config, generate, hasAuthorizedSources: () => true, search: async () => { throw Error("SerpApi unavailable"); }, maxExtraBatches: () => 1 });
  const response = await handler(request()); assert.equal(response.status, 200); assert.equal((await response.json()).alternatives.length, 2);
});
for (const webFails of [false, true]) test(`AI provider unavailable returns safe error with independent web failure=${webFails}`, async () => {
  const handler = createHybridGenerateHandler({ config, generate: async () => { throw Error("private upstream detail"); }, hasAuthorizedSources: () => true, search: webFails ? async () => { throw Error("private web detail"); } : emptySearch, maxExtraBatches: () => 1 });
  const response = await handler(request()); assert.equal(response.status, 503); const body = await response.json(); assert.equal(body.error.code, "SERVICE_UNAVAILABLE"); assert.equal(JSON.stringify(body).includes("private"), false);
});
test("duplicate alternatives are omitted without regeneration or fabricated replacements", async () => {
  let calls = 0;
  const handler = createHybridGenerateHandler({ config, generate: async () => { calls++; return { ...output(1), recipes: [variantModel(), variantModel(), variantModel()] }; }, hasAuthorizedSources: () => false, search: emptySearch, maxExtraBatches: () => 1 });
  const body = await (await handler(request())).json(); assert.ok(body.recipe); assert.equal(body.alternatives.length, 0); assert.ok(body.issues.length); assert.equal(calls, 1);
});
test("invalid alternatives leave available valid recipes visible; all invalid output is rejected", async () => {
  for (const allInvalid of [false, true]) {
    const handler = createHybridGenerateHandler({ config, generate: async () => ({ status: "recipes", clarification: null, recipes: [allInvalid ? {} : variantModel(), {}, {}] }), hasAuthorizedSources: () => false, search: emptySearch, maxExtraBatches: () => 0 });
    const response = await handler(request()); assert.equal(response.status, allInvalid ? 502 : 200);
    const body = await response.json(); if (!allInvalid) { assert.equal(body.alternatives.length, 0); assert.ok(body.issues.length); }
  }
});
test("normalized query cache coalesces concurrent calls and reuses validated variants", async () => {
  let calls = 0;
  const handler = createHybridGenerateHandler({ config, generate: async (q, c, s, o) => { calls++; return generate(q, c, s, o); }, search: emptySearch, hasAuthorizedSources: () => false, maxExtraBatches: () => 1 });
  const responses = await Promise.all([handler(request()), handler(request({ query: " ПИЛЕ " }))]);
  assert.equal(responses[0].status, 200); assert.deepEqual(await responses[0].json(), await responses[1].json()); assert.equal(calls, 1);
  assert.equal((await handler(request())).status, 200); assert.equal(calls, 1);
});
test("extra generations are capped, cached and receive only validated prior AI fingerprints", async () => {
  let calls = 0;
  const handler = createHybridGenerateHandler({ config, generate: async (q, c, s, o) => { calls++; if (o.batch) assert.equal(o.avoid.length, 3); return generate(q, c, s, o); }, search: emptySearch, hasAuthorizedSources: () => false, maxExtraBatches: () => 1 });
  await handler(request()); const extra = await handler(request({ query: "Пиле", batch: 1 })); assert.equal(extra.status, 200); const body = await extra.json(); assert.equal(body.recipe, undefined); assert.equal(body.alternatives.length, 2);
  await handler(request({ query: "Пиле", batch: 1 })); assert.equal(calls, 2);
  assert.equal((await handler(request({ query: "Пиле", batch: 2 }))).status, 422); assert.equal(calls, 2);
});
test("recoverable generation failures have a bounded per-query attempt budget", async () => {
  let calls = 0;
  const handler = createHybridGenerateHandler({ config, generate: async () => { calls++; throw new GenerationError("SERVICE_UNAVAILABLE", 503, true); }, search: emptySearch, hasAuthorizedSources: () => false, maxExtraBatches: () => 0 });
  await handler(request()); await handler(request());
  const response = await handler(request()); assert.equal(response.status, 422); assert.equal((await response.json()).error.code, "GENERATION_LIMIT"); assert.equal(calls, 2);
});
test("quota/authentication errors are not repeatedly charged for the same query batch", async () => {
  for (const code of ["INSUFFICIENT_QUOTA", "AUTHENTICATION_ERROR"]) {
    let calls = 0;
    const handler = createHybridGenerateHandler({ config, generate: async () => { calls++; throw new GenerationError(code, 503); }, search: emptySearch, hasAuthorizedSources: () => false, maxExtraBatches: () => 1 });
    await handler(request()); const response = await handler(request()); assert.equal((await response.json()).error.code, code); assert.equal(calls, 1);
  }
});
test("client cannot supply recipe text, permissions, model or unbounded generation counts", async () => {
  let calls = 0; const handler = createHybridGenerateHandler({ config, generate: async (q, c, s, o) => { calls++; return generate(q, c, s, o); }, search: emptySearch, hasAuthorizedSources: () => false, maxExtraBatches: () => 1 });
  for (const body of [{ query: "Пиле", batch: 99 }, { query: "Пиле", sourceText: "Unlicensed recipe" }, { query: "Пиле", count: 100 }, { query: "Пиле", model: "override" }]) assert.equal((await handler(request(body))).status, 400);
  assert.equal(calls, 0);
});
test("variants use official SDK Responses structured output with one bounded request", async () => {
  let calls = 0;
  const client = new OpenAI({ apiKey: "synthetic-key", maxRetries: 0, fetch: async (_url, init) => {
    calls++; const body = JSON.parse(String(init?.body)); assert.equal(body.model, "mock-model"); assert.equal(body.store, false); assert.equal(body.text.format.strict, true); assert.equal(body.text.format.name, "bulgarian_recipe_variants"); assert.ok(body.input[0].content.includes("независими"));
    return Response.json({ id: "resp_mock", object: "response", created_at: 1000, model: "mock-model", status: "completed", output: [{ id: "msg_mock", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: JSON.stringify(output(3)), annotations: [] }] }] });
  } });
  const parsed = await createVariantGenerator(client)("Пиле без гъби", config(), new AbortController().signal, { count: 3, batch: 0, avoid: [] });
  assert.equal(parsed.recipes.length, 3); assert.equal(calls, 1);
});
