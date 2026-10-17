# Task 7 — OpenAI recipe generation

## Behavior and setup

The default search mode now generates **one** Bulgarian recipe through the official
OpenAI Node SDK's Responses API (`responses.parse`, strict `zodTextFormat`). The
server adapts the transport schema to the existing `ResolvedRecipe` canonical type;
there is no competing recipe interface. The app brand remains Вкусно. Home layout,
recipe details, serving calculations and Cooking Mode are reused.

Create `.env.local` using `.env.example`, then set:

```dotenv
OPENAI_API_KEY=your-server-only-key
OPENAI_MODEL=gpt-5-mini
RECIPE_SEARCH_MODE=ai
```

The key is read only by the server. `.env.local` is ignored, never copied to client
props or included in errors, URLs, recipe stores or logs. No key is supplied in this
repository. Missing configuration returns a controlled 503, never a fake AI recipe.
Restart the local server after changing environment variables.

`OPENAI_MODEL` overrides a single central default, `gpt-5-mini`. This is a smaller,
cost-efficient model for a bounded text task and supports both Responses and
Structured Outputs. This choice is configurable, not an assertion that it is the
newest model. References:

- [OpenAI Structured Outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [GPT-5 mini model capabilities](https://developers.openai.com/api/docs/models/gpt-5-mini)

Use `/search?q=Пиле%20с%20ориз` for AI generation and append `&mode=demo` for the
existing deterministic demo collection. Search has visible mode links. Explicit URL
mode wins over the browser mode cookie, then `RECIPE_SEARCH_MODE`; any non-demo
selection uses AI. The cookie is a display preference, never an access control.
Web recipes remain coming soon in AI mode; demo records remain clearly labeled.

## HTTP endpoint

`POST /api/recipes/generate` runs on the Node.js server:

```json
{ "query": "Пиле с ориз за 6 човека" }
```

Requires `Content-Type: application/json`. The strict body has only `query`, trimmed,
1–500 characters; request body is capped at 8 KiB. Cross-origin browser requests are
rejected. Success is HTTP 200 with `{ "recipe": <canonical ResolvedRecipe> }`.
The source is assigned by the server as `{kind:"ai",mode:"live",model:...}` only after
a successful provider response and validation. IDs are deterministic content hashes
(`ai-` plus 16 hex characters); ingredient and step IDs are assigned server-side.
The model does not invent IDs, photos, web attribution, ratings or nutrition.
`imageUrl` is null and the existing icon placeholder is reused.

Errors always use this shape:

```json
{ "error": { "code": "TIMEOUT", "message": "Генерирането отне твърде дълго. Опитай отново.", "retryable": true } }
```

| Status | Codes/meaning |
| --- | --- |
| 400 | INVALID_REQUEST, MALFORMED_JSON |
| 403 | Cross-origin INVALID_REQUEST |
| 413 | TOO_LARGE |
| 415 | Unsupported content type |
| 422 | CONSTRAINTS (clarification), REFUSED |
| 429 | RATE_LIMIT; Retry-After: 60 |
| 502 | INVALID_OUTPUT, including malformed/refused-to-parse provider content |
| 503 | CONFIGURATION, INSUFFICIENT_QUOTA, AUTHENTICATION_ERROR (non-retryable), SERVICE_UNAVAILABLE (retryable) |
| 504 | TIMEOUT |

Responses use `Cache-Control: no-store`. Provider exceptions, credentials and stack
traces are not exposed. Model clarifications may be shown as escaped text; other
upstream error messages are replaced by Bulgarian messages. The UI offers a manual
retry only for recoverable errors. No automatic client retry loop or SDK retries.

## Intent, structure and food safety

The prompt handles requested dish, ingredients, exclusions, cuisine, dietary needs,
equipment and time. It distinguishes explicitly available ingredients from extra
requirements; ingredient rows show those labels. Defaults are four servings.
Deterministic checks extract common Bulgarian serving counts (digits or number
words), time limits and exclusions, and reject mismatched portions, excess total
time, known excluded products and common dietary violations. Unclear/impossible
conditions may return a clarification instead of a recipe.

Zod and semantic checks reject missing fields, unknown keys/units, invalid amounts,
missing quantities for non-seasonings, invalid servings, negative/zero total times,
empty/out-of-order/duplicate steps, invalid ingredient indices and unused listed
products. Units remain g/kg/ml/l/piece/tsp/tbsp; quantities are immutable. Timers
must be at least one second and cannot exceed the entire recipe's time, preventing
invalid timers from reaching the existing cooking-session logic.

**Structural and basic constraint validation are not culinary safety certification.**
Lexical dietary/exclusion checks cannot prove semantic compliance for every synonym,
allergen or compound ingredient. The model is instructed to clarify conflicts and
avoid unsafe raw/undercooked meat, fish and eggs, but generated instructions remain
unverified. The UI explicitly says the recipe is not professionally verified.
A fixed, source-backed thermometer/cross-contamination tip is attached to every
recipe. It distinguishes internal temperatures from oven settings and never relies
only on appearance. Reference:
[USDA safe minimum temperatures](https://www.fsis.usda.gov/food-safety/safe-food-handling-and-preparation/food-safety-basics/safe-temperature-chart).
No generated nutrition is displayed.

## Temporary persistence

The sessionStorage store holds at most 20 validated canonical recipes, up to 2 million
JSON characters total, with a 24-hour TTL. Successful-query keys are hashes, not full
query strings. Reads validate schema, checksum, expiry and stable IDs. Broken/expired
entries are ignored and missing recipes show a Bulgarian recovery page. A denied
write produces an error rather than a card leading to a missing recipe.

Details and `/recipes/[id]/cook` load generated recipes from that shared store after
hydration. Refresh, Back/Forward, checklists, servings, timers and completion reuse
existing components/session persistence. No full JSON is put in URLs. Generated
favorites work during the existing in-memory Favorites session.

This is **not permanent storage**: closing the browser session, clearing storage,
TTL expiry or eviction can lose a recipe. A new browser/device cannot resolve the
same direct link. Missing generated data is discovered client-side and therefore
shows a recovery page with HTTP 200; truly invalid IDs retain HTTP 404. IDs/checksums
are not signatures or a security proof of browser-local provenance. Cooking progress
in localStorage is separate from temporary recipe content and cannot reconstruct a
lost recipe. Firebase is not implemented.

## Cost control and production blockers

- 45-second abort deadline, 8,000 output-token cap, one recipe, SDK maxRetries: 0.
- Client request timeout: 55 seconds. Identical in-flight queries share one promise;
  successful identical queries reuse validated sessionStorage content.
- Server deduplicates identical in-flight requests and limits concurrent generations
  to five. Successful results only are cached: max 100 entries, 10-minute TTL. Keys
  are query/model hashes; raw queries and credentials are not cached. The prompt
  excludes personal data from recipe content. Failures are never cached.
- **In-memory** rate limits: five requests/client/minute, 30 requests/process/minute.
  Client buckets are bounded; expired buckets are removed. Forwarded IPs are only a
  coarse hint and can be spoofed unless a trusted proxy sanitizes them. The global
  process cap also applies to changed identities.
- These limits/cache reset on restart and are not shared across serverless instances.
  **A persistent/shared, trusted deployment-wide limiter and abuse/budget controls
  are a production blocker before public deployment.** No Firebase or Redis added.
- Live provider output quality and account/model access have **not** been verified
  with a live call. All automated checks use mock provider transport or browser API
  interception; no actual API credits are spent. An authorized live smoke test and
  broader culinary/dietary safety evaluation remain deployment prerequisites.

## Automated verification

`npm run validate` executes ESLint, TypeScript, unit tests, server API tests, production
build and the complete Playwright suite. `npm run test:api` separately exercises the
same Web Request/Response handler used by the route with injected provider behavior.
Official SDK parsing is tested with a mocked fetch transport, not just fabricated
final objects. The real running HTTP route is also checked for invalid requests and
missing configuration. Playwright explicitly empties the server API key, defaults
old regressions to demo mode, and new AI tests use a preference cookie plus intercepted
`/api/recipes/generate` responses. No routine tests can bill OpenAI.

Coverage includes natural-language query variants, loading, source labels, quantities,
serving scaling, additional products, retries, error statuses, corrupted/expired
storage, favorites, query cache, duplicate submissions, desktop/mobile full cooking
journeys, refresh, Back/Forward and all previous regressions. Existing tests are not
deleted, weakened or skipped. The existing HTML report/failure screenshots/retry
traces remain enabled. Only Chromium is currently automated.

## Task 7 file manifest

New:

- `.env.example`, `docs/task-7-openai.md`
- `src/app/api/recipes/generate/route.ts`
- `src/lib/ai/recipe-schema.ts`, `src/lib/ai/errors.ts`
- `src/lib/ai/recipe-store.ts`, `src/lib/ai/generate-client.ts`
- `src/lib/server/generate-handler.ts`, `src/lib/server/openai-client.ts`
- `src/lib/server/openai-generator.ts`
- `src/hooks/use-generated-recipes.ts`
- `src/components/recipes/generated-recipe.tsx`
- `src/components/search/ai-search-results.tsx`
- `tests/ai-recipe.test.ts`, `tests/helpers/ai-recipe.ts`
- `tests/server/generate.test.ts`, `tests/e2e/ai-generation.spec.ts`

Modified:

- `AGENTS.md`, `README.md`, `package.json`, `package-lock.json`, `playwright.config.ts`
- `src/types/recipe.ts`, `src/app/search/page.tsx`
- `src/app/recipes/[id]/page.tsx`, `src/app/recipes/[id]/cook/page.tsx`
- `src/components/home/search-form.tsx`
- `src/components/search/search-results.tsx`, `src/components/search/search-results.module.css`
- `src/components/search/search-recipe-card.tsx`
- `src/components/recipe-details/recipe-header.tsx`
- `src/components/recipe-details/recipe-photo.tsx`
- `src/components/recipe-details/recipe-source.tsx`
- `src/components/recipe-details/ingredient-list.tsx`
- `src/components/recipe-details/recipe-details.module.css`
- `src/components/cooking/cooking-mode.tsx`, `src/components/cooking/cooking-ingredients.tsx`
- `src/components/recipes/favorites-list.tsx`

## Final executed validation results

The final `npm run validate` run completed successfully against the final source.

| Suite | Executed | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: |
| Unit | 40 | 40 | 0 | 0 |
| Server API / mocked SDK transport | 15 | 15 | 0 | 0 |
| Playwright Chromium | 33 | 33 | 0 | 0 |
| Total | 88 | 88 | 0 | 0 |

Playwright includes 18 new functional scenarios, two full generated-recipe journeys
(desktop/mobile), one real HTTP route configuration/validation scenario, and all 12
previous regression scenarios. No retries/flaky passes or skipped tests in the final
run. ESLint, TypeScript generation/checking and production build all passed. Visual
screenshots of AI search/details at 375 and 1440px were also inspected.

`npm audit --omit=dev --audit-level=high` reported **0 production vulnerabilities**.
The dependency install still reported the existing five high development-dependency
advisories; no unrelated breaking dependency upgrades were attempted. Native Node
TypeScript stripping and terminal color warnings do not affect the passing results.
There are no blocked automated checks. Live OpenAI verification and the deployment
blockers listed above remain explicitly outstanding; these mock-based results are
not a claim of live provider verification or public-production readiness.


## Task 7.2 follow-up

The original Task 7 validation above was mock-only. Task 7.2 subsequently completed
one successful live generation using the configured `gpt-5.6-luna`, and corrected
quota/authentication/service classification. See [the live verification report](task-7-2-live-verification.md)
for actual usage, cost estimate, recorded-result browser checks and culinary caveats.
The earlier unverified-live statements describe Task 7's historical status, not the
current Task 7.2 outcome. Distributed rate limiting remains a production blocker.
