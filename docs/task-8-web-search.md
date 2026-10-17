# Task 8 — Google web recipe discovery

Implementation and validation report for the existing Bulgarian search experience.
Live SerpApi verification has **not** been performed. No SerpApi or OpenAI credits
are used by routine validation.

## Setup and provider architecture

Keep the existing OpenAI values in `.env.local` unchanged. Add server-only
`SERPAPI_API_KEY` and `WEB_SEARCH_PROVIDER=serpapi`, as documented in `.env.example`.
Restart `npm run dev` (port **4317**) after changing configuration. Open
`/search?q=Пиле%20с%20ориз&mode=ai`; demo mode retains the approved local collection.
There are no `NEXT_PUBLIC_` credentials. Missing configuration is HTTP 503 with a
Bulgarian message and does not suppress independently loaded AI results.

`WebSearchProvider` (`src/lib/web/types.ts`) returns normalized discovery records
and a provider cursor. The SerpApi adapter is isolated from UI, enrichment, cache,
permissions and the canonical `ResolvedRecipe`. Dependency injection permits
mocking transport, provider, source registry, DNS and page retrieval in tests.
No second provider or extra OpenAI parsing request has been introduced.

The adapter uses `GET https://serpapi.com/search.json`, engine `google`, `q` equal to
the complete normalized Bulgarian request plus “рецепта”, `hl=bg`, `gl=bg`,
`google_domain=google.bg`, and bounded `start=0,10,…,90`. Every request retains
ingredients, exclusions, diet, cuisine, equipment and time wording. No negative
search operator discards pages containing “без…”. Returned `next` URLs are never
followed, stored or returned: they can contain credentials. Their presence only
signals the next numeric offset. Provider messages are mapped to safe local text.

Primary references consulted for implementation:
[SerpApi Search API](https://serpapi.com/search-api),
[organic result fields](https://serpapi.com/organic-results),
[Google Recipe structured data](https://developers.google.com/search/docs/appearance/structured-data/recipe),
[Schema.org Recipe](https://schema.org/Recipe).

## Application API

`POST /api/recipes/search-web`, `Content-Type: application/json`:

```json
{ "query": "Паста без гъби до 30 минути", "cursor": null }
```

Strict body: 1–500 query characters, optional opaque cursor, at most 4096 bytes.
Cross-origin browser requests are rejected. Responses use `Cache-Control: no-store`.
The server never accepts URLs, credentials or source permissions from this body.

Success 200:

```text
{ results: WebRecipeResult[], nextCursor: string | null, limitations: string[] }
```

Each discovery record has stable `web-<16 hex>` ID, title, canonical source URL,
domain, source name, short provider description, null image, rank and discovery
timestamp. URL-derived IDs survive pagination and can be reused by future storage.
Rank is never presented as a rating. Tracking parameters, fragments, common AMP/
print forms, protocol/www aliases are deduplicated; distinct recipe paths remain.
This does not guarantee that all publisher-specific aliases are detected.

The envelope adds `permission`, `access` (`complete` or `metadata_only`), optional
canonical `recipe`, and limitations. Metadata-only envelopes cannot carry full
recipes. All returned/persisted external shapes are checked with Zod; React renders
source text without HTML injection. Invalid internal records are not published.

Safe error shape: `{error:{code,message,retryable}}`:

| HTTP | Code |
| --- | --- |
| 400 | INVALID_REQUEST (including malformed/oversized input/cursor) |
| 403/415 | INVALID_REQUEST (origin/content type) |
| 429 | RATE_LIMIT, with Retry-After: 60 |
| 502 | INVALID_RESPONSE / UNAVAILABLE |
| 503 | CONFIGURATION / AUTHENTICATION / QUOTA |
| 504 | TIMEOUT |

Quota, credentials and configuration errors have no automatic/manual retry loop.
Recoverable errors expose an explicit retry. Pagination errors keep prior results.
The browser uses local messages, never provider stack traces or raw error text.

## Permissions and extraction boundary

**The production authorized-source registry starts empty**:
`src/lib/server/web/authorized-sources.ts`. Therefore newly discovered sources are
metadata-only until documented permissions have been added and reviewed. This is
an intentional product restriction, not evidence that those publishers are licensed.
Google indexing, a public webpage and JSON-LD never constitute permission.

To add an authorized source, record its exact public `origin`, permitted
`pathPrefix` (segment bounded), publisher `sourceName`, `licenseReference`, actual
`evidenceReference` (retained agreement/license review), attribution requirement,
explicit image permission, `reviewedAt` and optional expiry. Review the scope and
evidence manually; the code cannot establish legal permission itself. No production
entry is derived from popularity, structured data or the synthetic test registry.
Revoke/remove entries when evidence expires or scope changes. Cache hits recheck
current authorization/expiry before releasing full content.

Unknown sources are **not fetched**. Cards display the source title, domain/name,
limitation and an accessible `noopener noreferrer` original-source link. They do
not expose full instructions, scaled quantities, internal Details/Cooking links or
unauthorized pictures. Provider snippets are retained as short discovery metadata,
not treated as complete recipes or shown as verified instructions.

Only authorized pages are fetched. The HTML parser never executes scripts. JSON-LD
supports root Recipe objects/arrays, `@graph`, `mainEntity`, Recipe type arrays,
graph step references, text/HowToStep/HowToSection/ItemList instructions, ISO day/
hour/minute/second durations, recipe yield, cuisine, category and optional image
metadata. Units supported: g, kg, ml, l, pieces, teaspoons and tablespoons, including
Bulgarian decimals and fractions. Unsupported cups/ranges/unknown quantities retain
the original text and explicitly do not rescale. Missing times remain null, with
“Неуточнено” in the existing components. Missing data is never silently zero.
Only an explicit known integer yield of 1–20, ingredients and ordered source steps
make a complete recipe eligible for internal Cooking Mode. No AI fills omissions.
Nutrition/ratings are not fabricated. Currently all web photos use the existing
placeholder even where image permission is recorded; direct photo proxying is future work.

Authorized source attribution and permission reference appear in Details, source
name/link on cards, and name in Cooking Mode. Preparation quantities, instructions,
timers, serving controls, checklists and sessions reuse the same canonical model
and components as existing recipes. Full web records use the existing temporary
recipe store, up to 10 minutes in the current tab; AI retention remains 24 hours.
The browser store is not a legal evidence database or a trust boundary. No permanent
content storage has been introduced. In-memory views may remain open past TTL;
refresh/navigation validates stored expiry. Permission revocations are not pushed
to already-open browser sessions; persistent delivery requires server revalidation.

## Network protections

Only public HTTP(S), no credentials/nonstandard ports or sensitive credential query
parameters. Reject localhost/internal/single-label domains, private, loopback,
link-local, reserved, mapped private IPv6 and non-unicast addresses. DNS resolves
all answers; any non-public answer blocks the request. A vetted address is pinned
into the actual socket lookup, preserving TLS hostname verification and avoiding a
DNS-rebinding check/connect gap. Every redirect is revalidated and reauthorized.
Up to 3 redirects, 6-second total page timeout, 1 MB HTML cap, HTML content types
only, no compressed bodies. Search transport uses an 8-second timeout, a fixed
SerpApi endpoint, no redirects and a 1 MB body cap. There is no arbitrary URL-fetch
endpoint. Provider metadata links undergo syntax/public-IP checks; DNS pinning is
applied when the application actually fetches a page, not when a user navigates
externally to the original publisher.

## Pagination, filtering and caching

Initially one AI card plus at most two web cards. Complete authorized records are
prioritized before metadata links, then original rank. “Покажи още рецепти” requests
two more normalized records, preserving query and client filters. Numeric
application cursors encode provider page and within-page position; at the boundary,
the provider adapter loads its next real Google results page. No recipes are
duplicated to fill a grid, and AI generation is not restarted. Exhaustion disables
the button. Client deduplication also handles overlap across provider pages.

Time/difficulty/cuisine/category filters apply to loaded canonical recipes, not to
unverified snippet guesses. Unknown fields/metadata-only links are excluded under
active filters. Search wording constraints are retained upstream; known excluded
ingredient/diet/time conflicts with structured data downgrade the result to an
external link. **This is conservative lexical checking, not semantic, allergy or
culinary verification**. Cuisine/diet/ingredient completeness cannot be guaranteed
from indexing. The UI explicitly asks users to check the original and does not
claim that an external link satisfies their constraints.

Server cache: normalized full query + provider offset + registry version content,
5-minute TTL, at most 40 pages / 5 million serialized characters. Store only
normalized discovery and authorized recipe data; raw fetched HTML is transient.
Credentials/provider URLs are not cache keys or values. Concurrent identical
requests share one promise; at most 20 unique in-flight pages. API handler has a
bounded **per-process** 30 requests/minute gate. Client page cache: 1 minute,
20 entries / 2 million characters, concurrent request deduplication. Existing
temporary canonical store remains capped at 20 records / 2 million characters.
Normal repeat queries/navigation avoid new provider/AI calls where cached.

**In-memory caches/rate gates are per process and not shared across serverless
instances, regions or restarts.** Registry changes create a new key; stale entries
age out. Future persistent caching must revalidate permissions/expiry, avoid storing
raw unauthorized content, and include a provider/registry version. Distributed rate
limits, user budgets and billing caps remain production blockers.

## Changed files and testing

New code: `src/lib/web/{types,url,query,permissions,schema,errors,cache,extract,filters,search-client}.ts`;
`src/lib/server/web/{serpapi,search-service,search-handler,secure-fetch,authorized-sources}.ts`;
`src/app/api/recipes/search-web/route.ts`; `src/components/search/web-recipe-card.tsx`.
Modified: canonical types; temporary recipe store; combined AI search/results/card/
CSS; dynamic Details/Cook routing and recovery; source/header/quantity/total-time/
cooking attribution rendering. No Home layout changes or OpenAI configuration changes.
Configuration: `.env.example`, package/package-lock (Cheerio, ipaddr.js), Playwright
key isolation. Shared E2E fixture defaults web requests to deterministic empty data;
web integration specs override it explicitly. Existing tests are preserved.
The existing AI loading test now scopes its status assertions to the AI region:
combined search intentionally adds a second independent web loading status. Both
original assertions and the duplicate-request check are retained.

New tests: `tests/web-search.test.ts`, `tests/server/web-search-api.test.ts`,
`tests/e2e/web-search.spec.ts`, `tests/helpers/web-recipe.ts` (explicitly synthetic
content/permission, never production). Tests cover parsing, SSRF, permissions,
provenance, empty/error/partial outcomes, real provider page offsets, dedup/cache,
mobile controls and full authorized web Details/servings/checklist/Cooking/timer/
completion/history/refresh journeys. Existing AI journey regressions remain.

Run `npm run validate`: ESLint → TypeScript → units → server API → production build
→ full Chromium Playwright suite. All external responses are mocked. Detailed final
counts and status are recorded below after the gate completes. HTML reports are
in `playwright-report/index.html`; failure artifacts in `test-results/` are ignored.

## Validation results

Final `npm run validate` exited 0 against the final implementation:

| Check | Executed | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: |
| Unit | 68 | 68 | 0 | 0 |
| Server API | 39 | 39 | 0 | 0 |
| Full Chromium Playwright regression | 58 | 58 | 0 | 0 |
| **Total** | **165** | **165** | **0** | **0** |

ESLint: passed without warnings. TypeScript: passed. Production build: passed
(44 generated pages plus dynamic search/API/generated recipe routes). Final
Playwright run: **0 retries, 0 flaky tests**, including all 43 existing regressions
and 15 new Task 8 scenarios. Added 22 unit and 20 server API tests. No tests deleted
or disabled. Earlier iterations exposed two new-test synchronization/selector
issues and the old unscoped loading status; these were corrected and focused
reruns passed before the final complete gate. The initial sandbox browser-server
binding restriction was resolved through the approved local test execution.

Additional commands executed: `npm run test:unit`, `npm run test:api`,
`npm run lint`, `npm run typecheck`, `npm run build`, focused
`npm run test:e2e -- --grep ...`, and dependency audits. Full dependency audit:
5 high advisories in the development ESLint/Next plugin chain; production-only
audit: 0 advisories. A compatible remediation is tracked in the backlog rather
than applying the proposed unrelated major downgrade.

**Not live-verified.** No paid SerpApi/OpenAI generation calls were made for Task 8.
Production blockers and future work: `docs/PROJECT_BACKLOG.md`.

## File manifest

Created:

```text
.env.example
docs/task-8-web-search.md
docs/PROJECT_BACKLOG.md
src/app/api/recipes/search-web/route.ts
src/lib/web/types.ts
src/lib/web/url.ts
src/lib/web/query.ts
src/lib/web/permissions.ts
src/lib/web/schema.ts
src/lib/web/errors.ts
src/lib/web/cache.ts
src/lib/web/extract.ts
src/lib/web/filters.ts
src/lib/web/search-client.ts
src/lib/server/web/serpapi.ts
src/lib/server/web/search-service.ts
src/lib/server/web/search-handler.ts
src/lib/server/web/secure-fetch.ts
src/lib/server/web/authorized-sources.ts
src/components/search/web-recipe-card.tsx
tests/helpers/web-recipe.ts
tests/web-search.test.ts
tests/server/web-search-api.test.ts
tests/e2e/web-search.spec.ts
```

Modified:

```text
README.md
package.json
package-lock.json
playwright.config.ts
src/types/recipe.ts
src/lib/ai/recipe-store.ts
src/lib/servings.ts
src/app/recipes/[id]/page.tsx
src/app/recipes/[id]/cook/page.tsx
src/components/recipes/generated-recipe.tsx
src/components/search/ai-search-results.tsx
src/components/search/search-results.tsx
src/components/search/search-results.module.css
src/components/search/search-recipe-card.tsx
src/components/search/search-recipe-card.module.css
src/components/recipe-details/recipe-header.tsx
src/components/recipe-details/recipe-source.tsx
src/components/recipe-details/recipe-details.module.css
src/components/cooking/cooking-mode.tsx
src/components/cooking/cooking-completion.tsx
tests/e2e/fixtures.ts
tests/e2e/ai-generation.spec.ts
```

`.env.example` was absent on initial inspection and has been restored with blank
credentials and the existing central OpenAI default. `.env.local`, existing
OpenAI integration settings, Home design and AGENTS.md were not changed.
