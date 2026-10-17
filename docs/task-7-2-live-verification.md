# Task 7.2 — Live OpenAI verification and error handling

## Live result

**Successful real generation. Exactly one new live request; zero retries.**
The previous Task 7.1 guard/evidence was retained. This separately authorized attempt
used its own exclusive marker, a one-fetch guard, no redirects, disabled SDK logging,
`maxRetries: 0` and the existing 45-second service timeout. No images or web searches.
Environment files and the configured model were not modified.

- Configured/requested/returned model ID: `gpt-5.6-luna`.
- Query: `Рецепта за традиционна българска мусака за 4 порции`.
- Real provider HTTP status: 200; Responses status: `completed`.
- Application handler status: 200.
- Total service duration: **11,062 ms**; provider fetch/body: **11,036 ms**.
- Generated title: **Традиционна българска мусака с картофи и кайма**.
- Canonical recipe ID: `ai-b67a548662bf266c`.

The existing `createGenerateHandler` and `createOpenAIGenerator` were exercised
with an injected official SDK client and the configured environment values. This
used the actual app prompt, Responses API, strict Structured Outputs and both model
and canonical Zod validation, directly in Node. This was not a browser-to-running-
development-server generation request. Browser compatibility was separately verified
by replaying this exact saved provider result; it did not call OpenAI again.

## Validation and culinary sanity check

Valid JSON; original strict output schema, semantic checks and canonical Zod schema
passed. Title/description/instructions are Bulgarian; exactly four servings. Twelve
ingredients, seven sequential steps, stable server-assigned IDs and genuine AI source
metadata. Ten ingredients have positive quantities in supported units; salt and black
pepper intentionally have null quantities/units with “на вкус” notes. No fabricated
web attribution, nutrition or food image; the placeholder is used.

The main products fit Bulgarian potato-and-mince moussaka: 1kg potatoes, 500g ground
meat, onion, 400g tomatoes, oil and spices; topping with 400g yogurt, two eggs and 30g
flour. The portions are generous but plausible. Oven settings are consistently 190°C.
The process browns the mince, combines it with potatoes, bakes, adds the yogurt/egg
mixture and finishes baking. It includes a final thermometer check and explicit
cross-contamination guidance; this is **not professional culinary/safety verification**.

Questionable findings retained transparently in the recording:

- Declared preparation/cooking time: 25 + 60 = **85 minutes**. Step durations add up
  to **100 minutes**; the 15-minute pan stage plus 35+20-minute oven stages alone
  total 70 minutes. Some prep can overlap, but the stated cooking time is still
  optimistic. The original generated data was not silently corrected.
- A 10-minute rest appears in a tip before a final “serving” step with a 10-minute
  timer; the timing label is ambiguous. Timers function technically, but model-assigned
  durations need stronger semantic review.
- The preparation step references every ingredient in its index metadata even though
  its prose mainly covers preheating/hygiene. All indices are structurally valid;
  index validity does not prove that every reference is meaningful.
- Visual changes are mentioned during the intermediate mince stage; a final internal
  thermometer check is provided. Leftover-storage wording is vague and is not a
  complete food-safety procedure.

## Usage and estimated cost

| Metric | Observed value |
| --- | ---: |
| Input tokens | 959 |
| Cached input / cache-write tokens | 0 / 0 |
| Output tokens | 1,540 |
| Reasoning tokens, included in output | 171 |
| Total tokens | 2,499 |

Using the published standard text rates of $0.20/1M input and $1.20/1M output for
[this configured model](https://developers.openai.com/api/docs/models/gpt-5.6-luna):

`959 × 0.20 / 1,000,000 + 1540 × 1.20 / 1,000,000 = $0.0020398`

**Estimated request cost: $0.00204 USD (about 0.204 US cents).** This is a token-rate
estimate, not a billing receipt. Reasoning tokens are not counted twice.

## Corrected error contract

| Public code | App HTTP status | Manual retry offered | Meaning |
| --- | ---: | --- | --- |
| RATE_LIMIT | 429 | Yes | Temporary throttling; Retry-After: 60 |
| INSUFFICIENT_QUOTA | 503 | No | Exhausted API credit / billing issue |
| AUTHENTICATION_ERROR | 503 | No | Invalid/unauthorized server API credentials |
| SERVICE_UNAVAILABLE | 503 | Yes | Temporary upstream/network service failure |
| TIMEOUT | 504 | Yes | Request deadline exceeded |

The mapper checks SDK top-level and nested provider code/type fields before generic
HTTP 429 handling. `credit_balance_exhausted` / `insufficient_quota` now become
`INSUFFICIENT_QUOTA`. The Bulgarian message explains exhausted credit or payment
configuration and directs the administrator to review billing; it does **not** say
wait a minute. Upstream 401/403 becomes a non-retryable server-configuration issue,
not an end-user login challenge, hence application HTTP 503. Quota/auth responses
carry no Retry-After. Provider messages, keys and stack traces are never forwarded.

The client independently suppresses quota/auth retry buttons even if an erroneous
response marks them retryable. Genuine temporary errors preserve manual retry. SDK
and client automatic retries remain disabled. The old UNAVAILABLE display message
is retained as a compatibility alias, but new server failures emit SERVICE_UNAVAILABLE.

Three new regression cases were executed against the original mapper and failed with
RATE_LIMIT instead of INSUFFICIENT_QUOTA; the unchanged assertions passed after the
fix. Existing auth/service assertions were updated to the deliberately changed public
contract, not removed. The Task 7.1 recording remains historical evidence; its browser
replay now runs those provider codes through the corrected mapper.

## Application compatibility

The recorded result is replayed at 1440px and 375px through Home → Search → existing
RecipeCard → Details → Cooking Mode → Completion. Tests verify initial four servings,
scaling to six (potatoes 1000→1500g, meat 500→750g, eggs 2→3), immutable base data,
checkboxes/servings after refresh, multiple timers across steps, refreshed cooking
progress, returning to Details, all seven steps and the correct completion title.
No second live generation is used. The fixed recording makes subsequent tests fully
deterministic and credit-free.

## Security

- Key stayed server-side; not present in the provider recipe/application response.
- SDK logging was disabled for the single live attempt.
- Development HTTP GET `/.env.local` returned 404 without the key or environment-file
  contents. Automated production-server checks also deny `.env`, `.env.local` and
  `.env.example` URLs.
- Exact-value exposure scan covers source, tests, docs, public/client bundles and
  controlled Task 7.2 logs/evidence; the actual secret file/dependencies are excluded.
  See the final scan result recorded below. It does not audit unrelated system logs.
- Existing `.env*` ignore rule covers `.env.local`; no environment file was edited.
- No Git repository was found in this workspace/ancestors, so commit history cannot
  be audited here. No commit was created by this task.

## Files changed

Production: `src/lib/ai/errors.ts`, `src/lib/ai/generate-client.ts`,
`src/lib/server/openai-generator.ts`. No UI layout/design changes.

Tests: `tests/quota-errors.test.ts`, `tests/live-moussaka.test.ts`,
`tests/fixtures/live-moussaka.json`, `tests/e2e/live-moussaka.spec.ts`,
`tests/ai-recipe.test.ts`, `tests/server/generate.test.ts`,
`tests/e2e/ai-generation.spec.ts`, `tests/e2e/live-smoke-quota.spec.ts`.

Docs: this report, `docs/task-7-openai.md`, `README.md`.

## Remaining limitations

One successful request establishes live connectivity, model access and this result's
schema compatibility, not general recipe accuracy or production readiness. The timing
and instruction-quality findings above need a future quality-focused improvement.
The existing shared/distributed rate-limiting production blocker and temporary
sessionStorage limitations remain. No additional live calls were attempted to tune
the model or resolve culinary findings.

## Final executed QA results

The final `npm run validate` completed successfully against the final implementation:

| Suite | Executed | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: |
| Unit (including actual recorded recipe and error regressions) | 46 | 46 | 0 | 0 |
| Server API / injected SDK | 19 | 19 | 0 | 0 |
| Playwright functional + full E2E regression | 43 | 43 | 0 | 0 |
| Mock-based automated total | 108 | 108 | 0 | 0 |
| Separate newly authorized live generation | 1 | 1 | 0 | 0 |

No retries/flaky passes in the final automated run. ESLint, TypeScript and production
build all passed. Existing regressions were retained; error-contract assertions were
updated for the intended behavior change. All routine API/browser checks use mocks
or the fixed single-result recording and cannot make further real provider calls.

The final exact-key scan inspected **149 files**, finding **0 secret exposures** in
its documented scope. The `.env*` ignore rule is present; environment files remain
unchanged. HTTP privacy checks passed. The full log and sanitized request/security
metadata are under `/private/tmp/aichef-task72/` (outside the workspace); generated
browser reports/screenshots remain in the existing ignored test output folders.
