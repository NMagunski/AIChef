import test from "node:test";
import assert from "node:assert/strict";
import OpenAI from "openai";
import { createGenerateHandler, readAIConfig } from "../../src/lib/server/generate-handler.ts";
import { createOpenAIGenerator } from "../../src/lib/server/openai-generator.ts";
import { GenerationError, generatedRecipeSchema } from "../../src/lib/ai/recipe-schema.ts";
import { modelRecipe } from "../helpers/ai-recipe.ts";
const config = () => ({ apiKey: "mock-secret-not-for-browser", model: "mock-model" });
const output = () => ({ status: "recipe", clarification: null, recipe: modelRecipe() });
const request = (body: unknown = { query: "Пиле с ориз" }) => new Request("http://localhost/api/recipes/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("actual HTTP handler returns canonical recipe and no credentials", async () => {
  const POST = createGenerateHandler({ config, generate: async () => output() });
  const response = await POST(request()); assert.equal(response.status, 200); assert.equal(response.headers.get("Cache-Control"), "no-store");
  const body = await response.json(); assert.equal(generatedRecipeSchema.safeParse(body.recipe).success, true); assert.equal(JSON.stringify(body).includes(config().apiKey), false);
});
test("actual HTTP handler rejects malformed JSON, shape, size, content type and cross-origin requests", async () => {
  const POST = createGenerateHandler({ config, generate: async () => { throw Error("Must not call"); } });
  for (const body of [{ query: " " }, { query: "я".repeat(501) }, { query: 10 }, { query: "ok", extra: true }]) assert.equal((await POST(request(body))).status, 400);
  const make = (body: string, headers: Record<string, string> = { "Content-Type": "application/json" }) => new Request("http://localhost/api/recipes/generate", { method: "POST", body, headers });
  assert.equal((await POST(make("{"))).status, 400);
  assert.equal((await POST(make("a".repeat(8193)))).status, 413);
  assert.equal((await POST(make("{}", { "Content-Type": "text/plain" }))).status, 415);
  assert.equal((await POST(make("{}", { "Content-Type": "application/json", Origin: "https://other.example" } as Record<string, string>))).status, 403);
});
test("missing configuration is controlled; configured default is central", async () => {
  assert.throws(() => readAIConfig({}), /CONFIGURATION/);
  assert.equal(readAIConfig({ OPENAI_API_KEY: "mock" }).model, "gpt-5-mini");
  assert.equal(readAIConfig({ OPENAI_API_KEY: "mock", OPENAI_MODEL: "custom" }).model, "custom");
  const POST = createGenerateHandler({ config: () => readAIConfig({}), generate: async () => { throw Error("Must not call"); } });
  const response = await POST(request()); assert.equal(response.status, 503); assert.equal((await response.json()).error.code, "CONFIGURATION");
});
for (const [name, error, status, code] of [
  ["authentication", { status: 401, message: "mock-secret-not-for-browser" }, 503, "AUTHENTICATION_ERROR"],
  ["rate limit", { status: 429 }, 429, "RATE_LIMIT"],
  ["timeout", { name: "APIConnectionTimeoutError" }, 504, "TIMEOUT"],
  ["service unavailable", { status: 503 }, 503, "SERVICE_UNAVAILABLE"],
  ["unexpected failure", new Error("secret internal trace"), 503, "SERVICE_UNAVAILABLE"],
  ["refusal", new GenerationError("REFUSED", 422), 422, "REFUSED"],
] as const) test(`HTTP handler maps ${name} with sanitized response`, async () => {
  const POST = createGenerateHandler({ config, generate: async () => { throw error; } });
  const response = await POST(request()); const body = await response.json(); assert.equal(response.status, status); assert.equal(body.error.code, code); assert.equal(JSON.stringify(body).includes("secret"), false);
  if (status === 429) assert.equal(response.headers.get("Retry-After"), "60");
});
test("invalid structured response, impossible constraints and clarification are not recipes", async () => {
  for (const value of [null, { status: "recipe", clarification: null, recipe: {} }]) {
    const POST = createGenerateHandler({ config, generate: async () => value });
    assert.equal((await POST(request())).status, 502);
  }
  const POST = createGenerateHandler({ config, generate: async () => ({ status: "clarification", clarification: "Нужни са повече от 2 минути. Уточни времето.", recipe: null }) });
  const response = await POST(request()); assert.equal(response.status, 422); assert.match((await response.json()).error.message, /Уточни/);
});
test("timeout aborts the injected upstream and returns 504 without unbounded waiting", async () => {
  let signal: AbortSignal | undefined;
  const POST = createGenerateHandler({ config, timeoutMs: 10, generate: async (_query, _config, upstreamSignal) => { signal = upstreamSignal; return new Promise(() => {}); } });
  const response = await POST(request()); assert.equal(response.status, 504); assert.equal(signal?.aborted, true);
});
test("successful queries are deduplicated and cached; expired entries and failures are not reused", async () => {
  let count = 0, time = 1000;
  const POST = createGenerateHandler({ config, now: () => time, generate: async () => { count++; await new Promise((resolve) => setTimeout(resolve, 5)); return output(); } });
  const [first, second] = await Promise.all([POST(request()), POST(request())]); assert.equal(first.status, 200); assert.equal(second.status, 200); assert.equal(count, 1);
  assert.equal((await POST(request())).status, 200); assert.equal(count, 1);
  time += 10 * 60_000 + 1; assert.equal((await POST(request())).status, 200); assert.equal(count, 2);
  let failures = 0;
  const fail = createGenerateHandler({ config, generate: async () => { failures++; throw new Error("unavailable"); } });
  await fail(request()); await fail(request()); assert.equal(failures, 2);
});
test("per-client rate limits are bounded and recover after their window", async () => {
  let time = 1000; const POST = createGenerateHandler({ config, now: () => time, generate: async () => output() });
  for (let index = 0; index < 5; index++) assert.equal((await POST(request())).status, 200);
  assert.equal((await POST(request())).status, 429); time += 60001; assert.equal((await POST(request())).status, 200);
});
test("official SDK Responses parsing uses strict Zod schema; refusal/incomplete handled without live calls", async () => {
  for (const outcome of ["success", "refused", "incomplete", "failed"]) {
    const client = new OpenAI({ apiKey: "mock-only", maxRetries: 0, fetch: async (_url, init) => {
      const payload = JSON.parse(String(init?.body)); assert.equal(payload.text.format.strict, true); assert.equal(payload.store, false); assert.equal(payload.model, "mock-model");
      const content = outcome === "refused" ? [{ type: "refusal", refusal: "Cannot comply" }] : [{ type: "output_text", text: JSON.stringify(output()), annotations: [] }];
      return Response.json({ id: "resp_mock", object: "response", created_at: 1000, model: "mock-model", status: outcome === "incomplete" ? "incomplete" : outcome === "failed" ? "failed" : "completed", output: [{ id: "msg_mock", type: "message", role: "assistant", status: "completed", content }], incomplete_details: outcome === "incomplete" ? { reason: "max_output_tokens" } : null });
    } });
    const generator = createOpenAIGenerator(client);
    if (outcome === "success") assert.deepEqual(await generator("Пиле", config(), new AbortController().signal), output());
    else await assert.rejects(generator("Пиле", config(), new AbortController().signal), outcome === "refused" ? /REFUSED/ : outcome === "failed" ? /SERVICE_UNAVAILABLE/ : /INVALID_OUTPUT/);
  }
});

test("regression: spoofed client headers cannot bypass the anonymous client cap", async () => {
  const POST = createGenerateHandler({ config, now: () => 1000, generate: async () => output() });
  for (let index = 0; index < 5; index++) {
    const req = request(); req.headers.set("x-forwarded-for", `client-${index}`);
    assert.equal((await POST(req)).status, 200);
  }
  const next = request(); next.headers.set("x-forwarded-for", "another-client");
  assert.equal((await POST(next)).status, 429);
  const invalid = createGenerateHandler({ config, generate: async () => { throw Error("Must not call"); } });
  for (const query of ["Пиле за -1 човека", "Пиле за 0 човека", "Вечеря до -30 минути", "Вечеря до 0 минути"]) assert.equal((await invalid(request({ query }))).status, 422);
});

for (const [provider, code, retryable] of [
  [{ status: 429, code: "credit_balance_exhausted", type: "insufficient_quota" }, "INSUFFICIENT_QUOTA", false],
  [{ status: 429, error: { code: "insufficient_quota" } }, "INSUFFICIENT_QUOTA", false],
  [{ status: 401, code: "invalid_api_key" }, "AUTHENTICATION_ERROR", false],
  [{ status: 503 }, "SERVICE_UNAVAILABLE", true],
] as const) test(`server error contract: ${code} (no provider leakage or automatic retries)`, async () => {
  let calls = 0;
  const POST = createGenerateHandler({ config, generate: async () => { calls++; throw { ...provider, message: config().apiKey }; } });
  const response = await POST(request()); const body = await response.json();
  assert.equal(response.status, 503); assert.equal(body.error.code, code); assert.equal(body.error.retryable, retryable);
  assert.equal(response.headers.get("Retry-After"), null); assert.equal(calls, 1);
  assert.equal(JSON.stringify(body).includes(config().apiKey), false);
  assert.equal(JSON.stringify(body).includes("credit_balance_exhausted"), false);
  if (code === "INSUFFICIENT_QUOTA") { assert.match(body.error.message, /кредит/u); assert.doesNotMatch(body.error.message, /минута/u); }
});
