# Task 8.1 — Live SerpApi integration verification

## Status

**Live Google discovery verified. Live full-recipe extraction remains restricted by
missing source permissions.** The original configuration blocker was resolved by
the owner; both `SERPAPI_API_KEY` presence and `WEB_SEARCH_PROVIDER=serpapi` were
verified without printing the key or modifying `.env.local`.

Exactly **5 real SerpApi requests** were executed, one first-page request for each
specified dish, through the existing `createSerpApiProvider` implementation.
All five returned HTTP **200** with valid organic result payloads. No retries,
additional Google pages, OpenAI calls, image generation or external recipe-page
fetches were performed. The authorized five-request budget is exhausted; no live
requests were used to verify the subsequent fixes.

A transport wrapper observed response status/time and transient raw metadata while
using the application's endpoint/query/localization/normalizer. It did not change
the request parameters or timeout. Raw provider responses and credential-bearing
pagination URLs were not saved. Only source titles/URLs/attribution, counts and
sanitized metadata-only application pages are retained in the replay fixture.
The initial blocked attempt made zero calls and passed its 167-test offline gate;
that historical outcome is superseded by this resumed live search verification.

## Search quality summary

“Relevant” below means **unique individual text-recipe candidates identified by
source title and URL**, without fetching their pages. Video/social links, recipe
collections and Wikipedia are excluded from that count. Dish variants are included.
This is discovery relevance, not verification of complete ingredients, safety,
JSON-LD availability or reuse permission. Duplicated URLs count only once after the
regression fix. All 38 organic titles were dish-related, but only 23 unique links
met the stricter individual text-recipe criterion.

| Query | Organic results | Relevant unique recipe candidates | Structured recipes found | Authorized recipes | Metadata-only results after fix | Errors/findings |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| Мусака | 7 | 6 | Not inspected | 0 | 7 | No provider error |
| Пиле с ориз | 7 | 4 | Not inspected | 0 | 6 | One tracking-URL duplicate removed; slow response |
| Шкембе чорба | 8 | 3 | Not inspected | 0 | 8 | No provider error |
| Свинско с картофи на фурна | 7 | 5 | Not inspected | 0 | 7 | No provider error |
| Пълнени чушки | 9 | 5 | Not inspected | 0 | 9 | No provider error |

Totals: **38 organic results, 37 unique metadata-only links, 23 recipe candidates,
0 invalid URLs, 1 tracking duplicate, 0 authorized recipes**. All five API calls
succeeded; the duplicate/latency findings are implementation concerns, not provider
HTTP errors. A successful response does not establish how billing/credits were
charged; no account balance endpoint was queried.

## Per-query observations

Image metadata counts use the presence of `thumbnail`, `image`, `images` or
`thumbnail_src` on organic entries. These are **search-result metadata**, not
inspected recipe images or permission grants. Useful descriptions means a provider
snippet of at least 40 trimmed characters; it is a length-based indicator, not a
semantic quality score. Snippets/images are excluded from persisted fixtures.

| Query | HTTP | Wall time (ms) | Provider reported (s) | Duplicate URLs before → after fix | Invalid URLs | With image metadata | Useful descriptions |
| --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| Мусака | 200 | 1012 | 0.44 | 0 → 0 | 0 | 2 | 7 |
| Пиле с ориз | 200 | 26479 | 26.11 | 0 → 1 | 0 | 7 | 7 |
| Шкембе чорба | 200 | 1191 | 0.83 | 0 → 0 | 0 | 3 | 8 |
| Свинско с картофи на фурна | 200 | 863 | 0.44 | 0 → 0 | 0 | 2 | 7 |
| Пълнени чушки | 200 | 888 | 0.63 | 0 → 0 | 0 | 4 | 9 |

“Before → after” reports how many duplicates the normalizer detects/removes in the
same captured data, not a second live search. Eighteen results carried image
metadata, and all 38 carried sufficiently long descriptions. Normalized UI results
continue to use placeholders and never expose unauthorized photos.

Top five source domains **by rank**, preserving repeated domains where observed:

| Query | First five organic domains |
| --- | --- |
| Мусака | www.supichka.com, recepti.gotvach.bg, yoanna.bg, zvezdev.com, bg.wikipedia.org |
| Пиле с ориз | www.supichka.com, recepti.gotvach.bg, zvezdev.com, zvezdev.com, tastyhouse.bg |
| Шкембе чорба | www.youtube.com, zvezdev.com, recepti.gotvach.bg, www.youtube.com, zvezdev.com |
| Свинско с картофи на фурна | recepti.gotvach.bg, tastyhouse.bg, www.soulty.bg, zvezdev.com, www.facebook.com |
| Пълнени чушки | www.supichka.com, recepti.gotvach.bg, zvezdev.com, www.facebook.com, www.youtube.com |

- **Мусака:** six text-recipe candidates; Wikipedia is dish-related background,
  not an individual recipe. Variants include keto/carnivore content.
- **Пиле с ориз:** four unique text-recipe candidates, two Facebook video links and
  a duplicated Zvezdev recipe URL carrying `fb_comment_id`.
- **Шкембе чорба:** three text-recipe candidates; three YouTube links (one titled
  in English) and two recipe collections. Bulgarian localization is a preference,
  not a guarantee that every title/page is Bulgarian.
- **Свинско с картофи на фурна:** five text-recipe candidates, one Facebook video
  and one YouTube result. Oven/equipment details cannot be confirmed without a
  permitted page inspection.
- **Пълнени чушки:** five text-recipe candidates, two YouTube results, one Facebook
  video and one recipe collection; vegetarian/meat/sauce variants are mixed.

Source diversity: **14 distinct hostnames** across the captured results, with
repeated recipe publishers, social/video platforms and a reference encyclopedia.
No search ranking is represented as a rating or culinary endorsement.

## Structured extraction and permissions audit

The production registry `src/lib/server/web/authorized-sources.ts` is still empty.
No discovered page was fetched. The existing service correctly checked permission
before invoking page retrieval. It is therefore impossible to report live JSON-LD
availability, ingredients/quantities, steps, prep/cook time, servings or image
metadata **from the recipe pages** without bypassing current access controls.
All those page-level fields remain **not inspected**, rather than “missing” or zero.

Every domain below requires additional licensing research/documented permission.
UNKNOWN is the permission state; METADATA_ONLY is its enforced display access.
“Attribution” means retaining discovered source name/domain/original link, not a
claim that an unknown publisher's legal attribution terms have been established.

| Domain | Permission | Display access | Attribution | Full text / source photos / Cooking Mode |
| --- | --- | --- | --- | --- |
| bg.wikipedia.org | UNKNOWN | METADATA_ONLY | Name + domain + original URL | Not authorized by registry |
| bonapeti.bg | UNKNOWN | METADATA_ONLY | Name + domain + original URL | Not authorized by registry |
| facebook.com | UNKNOWN | METADATA_ONLY | Name + domain + original URL | Not authorized by registry |
| gotvach.bg | UNKNOWN | METADATA_ONLY | Name + domain + original URL | Not authorized by registry |
| gotvi.lidl.bg | UNKNOWN | METADATA_ONLY | Name + domain + original URL | Not authorized by registry |
| nosugar.bg | UNKNOWN | METADATA_ONLY | Name + domain + original URL | Not authorized by registry |
| recepti.gotvach.bg | UNKNOWN | METADATA_ONLY | Name + domain + original URL | Not authorized by registry |
| soulty.bg | UNKNOWN | METADATA_ONLY | Name + domain + original URL | Not authorized by registry |
| supichka.com | UNKNOWN | METADATA_ONLY | Name + domain + original URL | Not authorized by registry |
| tastyhouse.bg | UNKNOWN | METADATA_ONLY | Name + domain + original URL | Not authorized by registry |
| vinoimeze.bg | UNKNOWN | METADATA_ONLY | Name + domain + original URL | Not authorized by registry |
| yoanna.bg | UNKNOWN | METADATA_ONLY | Name + domain + original URL | Not authorized by registry |
| youtube.com | UNKNOWN | METADATA_ONLY | Name + domain + original URL | Not authorized by registry |
| zvezdev.com | UNKNOWN | METADATA_ONLY | Name + domain + original URL | Not authorized by registry |

No website was automatically whitelisted. Public indexing, robots.txt, technical
accessibility and Schema.org markup are not treated as licenses. No unauthorized
full recipe was republished or permanently stored. The actual structured-data
extractor and authorized Details/Cooking path are covered only with existing
synthetic authorized fixtures, not with these live unlicensed discoveries.

## Bugs found and regression fixes

1. **Tracking duplicate:** the same Zvezdev chicken/rice recipe appeared with and
   without `fb_comment_id`. The old normalizer returned both and assigned different
   IDs. Added that known tracking parameter to canonical URL cleanup, yielding one
   stable recipe ID. Original attribution/path are retained; meaningful query
   parameters are not generally discarded. A regression test failed against the
   original behavior (2 results instead of 1), then passed with the fix. The captured
   first page now yields 6 unique links instead of 7 for this query.
2. **Deadline enforcement:** chicken/rice took **26,479 ms** despite the previous
   8-second abort-signal setup. A deterministic transport that ignores abort
   reproduces the absence of a firm deadline. The adapter now races the **entire
   fetch/read/parse operation** against an 8-second deadline and aborts the transport
   without retrying. A short configurable deadline is injectable for tests only;
   it is not accepted from API input. Regressions cover uncooperative transports,
   stalled response bodies and safe HTTP 504 mapping. The initial regression failed
   before the fix with “Missing expected rejection”, then passed. Native cancellation
   remains best effort; caller response time is bounded even if transport ignores it.
   This fix is **not live-reverified**, because all five authorized calls were used.
   A future cold query may now produce a controlled timeout rather than waiting
   26 seconds; increasing budgets requires a separate product decision.

No additional provider was introduced, no retry behavior was loosened, and no
existing tests were disabled or weakened. Missing key/authentication/quota/rate
limit/network timeout/invalid response/empty response/blocked page/missing JSON-LD/
unauthorized-content handling remains exercised deterministically. None of those
error states occurred as a live HTTP provider error in these five calls.

## Application compatibility

`tests/fixtures/live-web-search.json` contains sanitized source metadata, safe
counts and metadata-only pages generated by replaying captured first-page discovery
through the current application service with an empty authorized registry. It has
no API credentials, provider pagination URLs, snippets, image URLs or full recipes.
Post-fix normalization/service replay made **zero provider calls**. Application
within-page cursors reveal this captured page only; additional live Google result
pages were deliberately not requested or verified.

New Playwright replay scenarios exercise all five queries on desktop and mobile:
independent AI/web results, correct source badges/attribution, original-source
links, no unauthorized internal recipe links/images, pagination without duplicates,
exhausted state, preserved single mocked AI request, and no horizontal overflow.
Existing full AI and synthetic authorized web journeys cover Details, portions,
checklists, timers, Cooking completion, refresh/back/forward. All regression traffic
is mocked; test server keys are explicitly cleared. Real metadata-only links are
not fetched by the test browser.

## Validation

Executed `npm run validate` against the final code; exit status **0**:

| Suite | Executed | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: |
| Unit | 70 | 70 | 0 | 0 |
| Server API | 41 | 41 | 0 | 0 |
| Full Playwright functional/E2E | 70 | 70 | 0 | 0 |
| **Total** | **181** | **181** | **0** | **0** |

ESLint: passed without warnings. TypeScript: passed. Production build: passed.
Final Playwright: **0 retries, 0 flaky tests**, including all previous 60 scenarios
and ten new recorded-live-result desktop/mobile replays. Full AI and synthetic
licensed web cooking journeys remain passing. All automated provider traffic was
mocked; real server keys were cleared by the existing E2E configuration.

Also executed focused original-failure regressions (both failed before the fix),
their successful reruns, unit/API/lint/TypeScript/build checks, and focused recorded
browser replays. An initial replay selector assumed unique titles; two separate
publishers legitimately use “Мусака”. It now identifies cards by canonical source
URL and still asserts the title and attribution; no coverage was removed. The
focused ten-test replay and the complete final gate then passed cleanly.

Diagnostic HTML report: `playwright-report/index.html`. Failure screenshot/trace
configuration is preserved. No test was skipped, disabled or weakened.

The live-search portion is verified. Live extraction/full source recipe reuse
remains **unverified/restricted**, and the extraction objective is incomplete until
permission-backed source inspections are possible. This is not hidden among the
zero skipped automated tests. The deadline fix has only mocked verification after
all five real calls were consumed.

## Files changed in this resumed task

- `src/lib/web/url.ts` — canonicalize the observed comment tracking parameter.
- `src/lib/server/web/serpapi.ts` — enforce a whole-operation deadline.
- `tests/web-search.test.ts` — tracking duplicate and sanitized fixture regressions.
- `tests/server/web-search-api.test.ts` — transport/body deadline regressions.
- `tests/fixtures/live-web-search.json` — sanitized recorded discovery metadata.
- `tests/e2e/live-web-search.spec.ts` — desktop/mobile recorded-result replay.
- `docs/task-8-1-live-search.md` and `docs/PROJECT_BACKLOG.md` — findings/status.
- `README.md` — link to the current live discovery status.

Existing `.env.local`, Home design, OpenAI configuration and authorized registry
were not modified. Previously added Task 8.1 missing-configuration tests are retained.

## Remaining production blockers

Full recipe/image reuse needs actual documented publisher permissions. Live
structured extraction and full web journeys cannot be claimed verified from these
sources. Cold-query latency may exceed the caller deadline; runtime instances do
not share caches/limiters. Distributed cost/rate controls, recipe quality/safety,
persistent storage/revocation, CI/deployment and development dependency advisories
remain tracked in `docs/PROJECT_BACKLOG.md`. Task 8.1's live extraction objective
remains unverified; search discovery success does not make reuse production-ready.
