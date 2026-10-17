import test from "node:test";
import assert from "node:assert/strict";
import { errorMessages, mapGenerationError } from "../src/lib/ai/errors.ts";

for (const value of [
  { status: 429, code: "credit_balance_exhausted", type: "insufficient_quota" },
  { status: 429, error: { code: "insufficient_quota" } },
  { status: 429, error: { error: { type: "insufficient_quota" } } },
]) test("regression: exhausted credit is not a temporary throttle", () => {
  const mapped = mapGenerationError(value);
  assert.equal(mapped.code, "INSUFFICIENT_QUOTA");
  assert.equal(mapped.status, 503);
  assert.equal(mapped.retryable, false);
  assert.match(errorMessages[mapped.code], /кредит|плащан/u);
  assert.doesNotMatch(errorMessages[mapped.code], /минута|Изчакай/u);
});

test("temporary, authentication, service and timeout errors have distinct safe policies", () => {
  for (const [input, code, status, retryable] of [
    [{ status: 429, code: "rate_limit_exceeded" }, "RATE_LIMIT", 429, true],
    [{ status: 401, message: "sk-mock-sensitive" }, "AUTHENTICATION_ERROR", 503, false],
    [{ status: 403 }, "AUTHENTICATION_ERROR", 503, false],
    [{ code: "invalid_api_key" }, "AUTHENTICATION_ERROR", 503, false],
    [{ status: 503 }, "SERVICE_UNAVAILABLE", 503, true],
    [{ name: "APIConnectionTimeoutError" }, "TIMEOUT", 504, true],
  ] as const) {
    const mapped = mapGenerationError(input);
    assert.equal(mapped.code, code); assert.equal(mapped.status, status); assert.equal(mapped.retryable, retryable);
    assert.ok(errorMessages[code]); assert.match(errorMessages[code], /[А-Яа-я]/u);
    assert.equal(errorMessages[code].includes("sk-mock-sensitive"), false);
  }
});
