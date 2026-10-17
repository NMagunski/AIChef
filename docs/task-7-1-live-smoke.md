# Task 7.1 — Live OpenAI smoke test

Status: **INCOMPLETE — live generation blocked by provider quota/billing.**
No application UI, production service code or environment files were changed.

## Single authorized live attempt

- Configured model ID: `gpt-5.6-luna`, read from the existing `.env.local` through
  Next.js environment loading. The API key and explicit model were both configured.
- Responses API and Structured Outputs compatibility is documented for this model:
  https://developers.openai.com/api/docs/models/gpt-5.6-luna
- Exact query: `Рецепта за традиционна българска мусака за 4 порции`.
- Existing application functions were invoked: `createGenerateHandler` and
  `createOpenAIGenerator`, with an injected official OpenAI SDK client using the
  configured key/model. This exercised the same server handler, prompt, strict Zod
  output helper and validation path as the application, directly in a Node process.
  It was not a browser-to-development-server HTTP smoke test.
- Exactly **one** outbound `POST https://api.openai.com/v1/responses` was attempted.
  SDK retries were zero, timeout 45 seconds, logging disabled. A fetch guard forbade
  a second outbound request; an exclusive attempt marker prevented script reruns.
- OpenAI HTTP status: **429**.
- Provider error code: `credit_balance_exhausted`.
- Provider error type: `insufficient_quota`.
- Total application-service duration: **1,989 ms**; provider fetch/body duration:
  **1,977 ms**.
- Existing application response: HTTP 429, sanitized error `RATE_LIMIT`.
- Live testing stopped immediately after that failure; there were no live retries,
  image calls or web-search calls. The remaining checks used mocks only.

The endpoint was reachable, but **recipe generation did not succeed**. The provider
returned no generated recipe and no resolved model identifier in the error response.
The configured/requested model ID is known; live generation compatibility is not
proven by this failed request.

## Validation, quality and compatibility

There was no returned recipe to validate with Zod or inspect for Bulgarian language,
four servings, ingredients, quantities/units, instructions, time/temperature,
AI provenance or culinary plausibility. Those live-result checks are **blocked**, not
passed. No substitute recipe was generated or presented as this live result.

The existing mocked regression suite still passes recipe cards, Details, serving
math, ingredient checklists, timers, persistence and completion. This demonstrates
existing application behavior with deterministic fixtures, not compatibility or
culinary correctness of an actual live-generated moussaka.

## Usage and cost

Input tokens: unavailable. Output tokens: unavailable. Total tokens: unavailable.
Provider usage was absent from the failed response. **No request-cost estimate is
possible from the available evidence**; a zero charge is not asserted.

## Security verification

- The key stayed in the server-side Node process and SDK authorization header.
  It was not printed, included in the application response or copied into fixtures.
- SDK logging was explicitly disabled for the live attempt.
- An exact-value exposure scan of **137 files** found **zero occurrences** of the
  configured key in source, tests, docs, public/client bundles and controlled smoke
  artifacts/logs. The secret-bearing `.env.local` and dependencies were excluded.
  This is a scoped scan, not an audit of all external/system logs.
- `.gitignore` contains `.env*` with only `.env.example` excepted, so `.env.local`
  is covered by the ignore rule. Environment files were not modified.
- No Git repository was found in this workspace/ancestors. There is therefore no
  repository commit history to audit; no Git commit was created by this task.

## Automated checks actually executed

`npm run validate` completed successfully after the single live attempt. The
Playwright server explicitly receives an empty API key; browser generation endpoints
are intercepted, and server/SDK tests inject mocks. No regression test calls OpenAI.

| Suite | Executed | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: |
| Unit | 40 | 40 | 0 | 0 |
| Server API | 15 | 15 | 0 | 0 |
| Playwright functional + E2E/regression | 35 | 35 | 0 | 0 |
| Automated total | 90 | 90 | 0 | 0 |
| Separate live generation smoke attempt | 1 | 0 | 1 | 0 |

No flaky passes or retries in the final automated run. ESLint, TypeScript validation
and production build all passed. Existing regression scenarios are retained.

Two new Playwright scenarios replay the sanitized 429 recording at 1440px and 375px.
They check controlled failure, absent recipe cards/storage, no internal provider-code
leak, no overflow and **no automatic retry after advancing the browser clock by a
minute**. They do not click Retry or contact the live service.

## Remaining issues / next action

1. The provider credit balance must be restored or the associated API billing/project
   configuration corrected before a successful live smoke test can be performed.
   A new live attempt requires a new explicit user instruction; none was retried.
2. The current error mapper treats quota exhaustion as a temporary `RATE_LIMIT` and
   offers a minute-wait/retry message. This is misleading for a billing failure and
   should be handled separately in a follow-up fix. The verification task did not
   change existing UI or production behavior.
3. Actual live recipe schema, culinary quality and application compatibility remain
   unverified because no recipe was returned. The existing distributed rate-limiting
   production blocker from Task 7 also remains.

Files added by this verification task:

- `tests/fixtures/live-smoke-quota.json`: sanitized failed-response recording.
- `tests/e2e/live-smoke-quota.spec.ts`: deterministic desktop/mobile failure replay.
- `docs/task-7-1-live-smoke.md`: this report.

Private temporary evidence: `/private/tmp/aichef-task71/report.json`,
`security.json`, `validation.log` and the one-attempt guard/script. These contain no
API key and are outside the project. They are not a permanent production log.
