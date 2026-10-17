# Task 8.2 — Hybrid recipe discovery

## Behavior and selection

The existing Bulgarian Search Results design now aims for **three complete recipes**:

| Complete licensed web recipes available | Original AI | Licensed web | Independent AI alternatives |
| ---: | ---: | ---: | ---: |
| 2 | 1 | 2 | 0 |
| 1 | 1 | 1 | 1 |
| 0 / web unavailable | 1 | 0 | 2 |

An original AI recipe comes first, then validated complete licensed recipes, then
independent AI alternatives. The initial complete selection never exceeds three.
Missing/failed/invalid variants are not invented to fill slots. If the original is
unavailable, remaining valid alternatives or licensed recipes still appear.
Provider errors and rejected variants have Bulgarian explanations.

Metadata-only Google results live separately under **“Още рецепти в интернет”**.
They keep publisher attribution and original links, with existing placeholders.
They cannot expose full ingredients/instructions, internal Details links or Cooking
Mode. The production authorized-source registry remains **empty**; no publishers
were whitelisted and no license was invented. Production currently uses the
three-AI fallback when generation succeeds, alongside restricted Google discovery.

If licensed results arrive after AI fallback generation, they replace alternatives
in the initial three cards. Already generated displaced alternatives remain cached
and are revealed only after an explicit “Покажи още рецепти” action. They do not
inflate the initial complete result count and revealing them costs no new call.

## Generation and cost behavior

`POST /api/recipes/generate` retains the existing endpoint and protections. Initial
body stays `{ "query": "Пиле с ориз" }`; an explicit additional batch uses
`{ "query": "Пиле с ориз", "batch": 1 }`. Other client-supplied fields such as
recipe text, source permissions, model overrides and arbitrary counts are rejected.

The server decides how many AI recipes are needed and performs **one** structured
Responses API call for that batch. It returns `{recipe?, alternatives, issues,
maxExtraBatches}`. The optional original is absent only for additional batches or
when an invalid original was omitted but usable alternatives remain. The legacy
`recipe` field, standalone handler, single-recipe client wrapper and older canonical
records remain supported; old single-recipe responses receive empty bundle defaults.

The new SDK adapter reuses the existing recipe rules/safety guidance, strict Zod
model schema, Responses parsing, configured `OPENAI_MODEL`, `store:false`, no SDK
retries, refusal/incomplete handling, and a 16,000 output-token ceiling. The array
contains at most three fully structured recipes. Each variant is individually
validated against the original user request. No model change, external parsing
call, prompt containing publisher content, new provider or new dependency was added.
Implementation follows the official [OpenAI Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses)
using `responses.parse` with `zodTextFormat`.

When the registry is empty, AI generation starts independently without waiting for
Google. When the registry contains potentially authorized sources, the server uses
the same shared cached/coalesced first-page web service to count complete licensed
recipes. This avoids a second concurrent Google provider call for the browser's
identical query within the same runtime. Separate serverless route instances do not
share that cache and need production distributed coordination. Count planning
waits at most six seconds; timeout/failure falls
back to three AI variants. The existing 45-second overall generation deadline
includes planning, and no generation is started after its abort signal. Slow web
results may arrive later and displace cached AI variants without another generation.

One request is not one-third of the token cost: producing three complete recipes
can use substantially more output tokens than producing one. A single batch saves
repeated request/prompt overhead and prevents blind per-card generation loops;
actual billing and latency are not measured in this mocked task.

### Additional recipes and hard limits

“Покажи още рецепти” first reveals already validated cached complete candidates,
then loads available web pages using the existing cursors. Extra paid AI generation
is not offered while the initial web result is still loading. Once web pagination
is exhausted/unavailable, the action may request a bounded extra AI batch with up
to two alternatives. Query and active filters are preserved. Loaded results are
deduplicated, licensed results prioritized and initial three-card selection retained.

New optional server setting in `.env.example`:

```dotenv
AI_DISCOVERY_MAX_EXTRA_BATCHES=1
```

Allowed values: **0–2**, default **1**; invalid settings disable extras. Zero means
no additional AI generation. At default settings a successful query can consume at
most one initial generation plus one explicitly requested extra batch. Initial
recoverable failures permit at most two generation attempts per normalized query/
model within ten minutes; each extra batch gets at most one attempt. Authentication
and quota failures block further attempts for the same query/batch in that window.
No automatic quota retries, duplicate-repair calls or endless “generate more” loop.
`GENERATION_LIMIT` is a non-retryable 422 with a safe Bulgarian explanation.

The existing per-process global 30 requests/minute, per-client five/minute and five
concurrent generation gates remain. The browser does not manually retry an extra
batch after failure; it shows the error and keeps valid existing results. These
MVP guards are not a distributed production billing limit.

## Validation and provenance

The same canonical `ResolvedRecipe` is reused. Its source metadata now optionally
records `discoveryType`, with backward-compatible interpretation:

- `ai_original`: server-generated original; green “AI рецепта”.
- `ai_alternative`: independently server-generated alternative; purple
  “AI алтернатива”, including Details and Cooking attribution.
- `web_licensed`: complete authorized recipe with original URL/name/reuse evidence.
- `web_metadata_only`: external discovery record with enforced metadata-only access.

Existing `kind`, `mode`, model names, web license/provenance information and IDs are
preserved. Older records without the new optional type are validated as before.
Canonical AI content checksums include assigned provenance, preventing silent type
editing in the temporary store. AI schemas reject website fields or web source
types; metadata envelopes cannot carry unauthorized complete recipes. Complete web
results require both a valid canonical recipe and matching envelope permissions.

AI variants use the existing checks for ingredients/units/quantities, serving count,
excluded ingredients, supported dietary restrictions, total time, ordered steps,
timers/temperatures, safety guidance and ingredient references. Common explicit oven,
stovetop, pot and air-fryer requests have additional deterministic equipment checks.
The complete query, cuisine and all other requested constraints remain in the model
prompt; unsupported linguistic variants are not proven semantically by a parser.
This is not a professional culinary, allergy or food-safety certification.

Near-duplicate AI variants are detected with ingredient-set and instruction-word
overlap, ignoring quantity/title-only changes. Valid distinct source URLs are not
merged merely because two publishers have similar classic recipes. Existing URL
canonicalization/deduplication remains in force. Invalid or overly similar generated
items are omitted with a notice; valid siblings are retained without regeneration.
This lexical heuristic cannot guarantee all possible semantic differences; stronger
quality/safety and time-consistency validation stays in the backlog.

The model receives only the user's request and, for additional batches, fingerprints
of **previously validated AI recipes** (title and ingredient names). No discovered
publisher recipe, snippet, URL, photograph, HTML or web instruction is supplied to
the model for paraphrasing. AI alternatives are never attributed to Google sources.

## Persistence and caches

The existing canonical temporary recipe store remains the only browser recipe
dataset: max 20 records / two million characters, AI 24-hour retention and licensed
web ten-minute retention. A bounded bundle index stores recipe IDs, issues and
limits, not a duplicate recipe dataset. It retains max 20 references/100,000
characters and validates expiry, canonical checksums and role consistency.
The first new hybrid search can create a new bundle for legacy single-recipe-only
entries; existing Details/Cooking IDs remain usable.

Normalized query + model + batch key the existing ten-minute server generation
cache; identical concurrent requests share a promise. Successful cached batches do
not regenerate. Query history is bounded to 100 entries, max seven validated AI
fingerprints each; attempt tracking is bounded to 300 expiring batch keys. No API
key is placed in cache keys, responses, client props or browser stores.

Refresh, back navigation and filter changes reuse validated browser bundles. Cached
additional batches can be revealed again without another provider call; full search
UI pagination itself is not permanently stored. Missing/evicted/expired records
require a new search or show the existing recovery page. Memory caches/gates are
per process, not shared across instances; browser data is per tab. Persistent
storage, permission revocation, distributed limits and account budgets remain future
work. Existing licensed web retrieval/SSRF/permission/cache protections are reused.

## Tests and execution

New deterministic tests cover the three source combinations, classification and
provenance, licensing guards, constrained variants, near duplicates, incomplete
outputs, partial failures, caching, concurrency, generation budgets, quota suppression,
SDK structured transport, separate metadata results and responsive interaction.
Full journeys cover original AI (existing), AI alternative (new desktop/mobile),
licensed synthetic web (existing), and Home-to-original-source metadata navigation.
Serving/checklist/cooking timer persistence, refresh/back/forward and completion
are exercised. All real provider credentials are cleared in the existing E2E server.

Executed final `npm run validate`; **exit code 0**:

| Suite | Executed | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: |
| Unit | 85 | 85 | 0 | 0 |
| Server API | 56 | 56 | 0 | 0 |
| Complete Playwright functional/E2E regression | 86 | 86 | 0 | 0 |
| **Total** | **227** | **227** | **0** | **0** |

ESLint passed without lint warnings, TypeScript passed and production build passed.
Final Playwright run: **0 retries, 0 flaky tests**. The original 181 tests are
retained; Task 8.2 adds 15 unit, 15 server API and 16 browser tests. Full regression
covers original AI and synthetic licensed web journeys plus the new independent AI
alternative and metadata-only Home journeys. Existing tests were not weakened,
deleted, disabled or skipped. HTML report: `playwright-report/index.html`.

Commands actually run: `npm run lint`, `npm run typecheck`, `npm run test:unit`,
`npm run test:api`, `npm run build`, focused `npm run test:e2e -- --grep ...`, and
final `npm run validate`. An intermediate complete 226-test gate passed before
adding the late-licensed-result regression. That regression then reproduced five
complete cards instead of three before the fix; its focused rerun passed after
hiding cached extra candidates until explicit Show More. A second strengthened
scenario ensures paid extras cannot start while initial web results are pending.
The final complete gate above passed against those final changes.

No real OpenAI or SerpApi calls were made for Task 8.2. Public OpenAI documentation
was consulted only; the new multi-variant prompt/latency/quality is not live-verified.

## Changed files

Created:

```text
src/lib/ai/hybrid.ts
src/lib/ai/bundle-store.ts
src/lib/server/hybrid-generator.ts
src/lib/server/openai-variants.ts
src/lib/server/web/search-runtime.ts
tests/helpers/hybrid-recipe.ts
tests/hybrid.test.ts
tests/server/hybrid-api.test.ts
tests/e2e/hybrid-search.spec.ts
docs/task-8-2-hybrid-discovery.md
```

Updated:

```text
.env.example
README.md
docs/PROJECT_BACKLOG.md
src/types/recipe.ts
src/lib/ai/recipe-schema.ts
src/lib/ai/errors.ts
src/lib/ai/generate-client.ts
src/lib/server/generate-handler.ts
src/lib/server/openai-generator.ts
src/lib/server/openai-client.ts
src/lib/server/web/search-service.ts
src/lib/web/types.ts
src/lib/web/schema.ts
src/lib/web/extract.ts
src/lib/web/search-client.ts
src/app/api/recipes/generate/route.ts
src/app/api/recipes/search-web/route.ts
src/components/search/ai-search-results.tsx
src/components/search/search-recipe-card.tsx
src/components/search/search-recipe-card.module.css
src/components/recipe-details/recipe-source.tsx
src/components/recipe-details/recipe-details.module.css
src/components/cooking/cooking-mode.tsx
```

Home, approved typography/layout, existing test assertions, `.env.local`, configured
OpenAI model and production authorized registry were not changed. Only source
badges and requested result grouping extend the existing visual design.

## Production status

Implementation is tested with deterministic providers; it is **not live-verified**.
No licensed publisher evidence is currently available, so production cannot claim
full web recipe/image reuse readiness. Remaining blockers include Recipe Quality &
Safety Engine, time consistency, persistent Production Rate Limiting/API Cost
Protection, Licensed Source Registry, GitHub CI/CD/deployment and dependency audit
work. Firebase/authentication, persistent favorites, shopping lists, weekly planner,
Higgsfield images and advertising remain unimplemented backlog items.
