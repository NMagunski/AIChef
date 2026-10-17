# AI Cooking Companion

Bulgarian-language recipe application, built directly in this workspace.

**Current functionality:** hybrid discovery targets three complete recipes: one
original AI recipe, licensed web recipes when available, and independent AI
alternatives for missing slots. See [Task 8.2 selection, costs, limits and tests](docs/task-8-2-hybrid-discovery.md).
Google discovery remains independent, with restricted links grouped separately.
See [Task 8 setup, API,
permissions, pagination, caching and tests](docs/task-8-web-search.md). The authorized
publisher registry starts empty: unknown sources open their originals, while
complete explicitly authorized recipes reuse Details and Cooking Mode.
Live SerpApi discovery was verified with five first-page queries; full source
extraction remains restricted by missing permissions. See the [Task 8.1 live
findings and limitations](docs/task-8-1-live-search.md). See [Task 7 endpoint, safety and production
blockers](docs/task-7-openai.md). Copy `.env.example` to `.env.local` and supply
`OPENAI_API_KEY`; `OPENAI_MODEL` defaults to `gpt-5-mini`. Without a key AI mode
shows a controlled configuration error. Explicit `mode=demo` keeps the mock collection.
Add server-only `SERPAPI_API_KEY` and `WEB_SEARCH_PROVIDER=serpapi` to enable web
discovery. Existing `.env.local` OpenAI settings must remain unchanged.
`AI_DISCOVERY_MAX_EXTRA_BATCHES=0..2` bounds optional extra AI batches (default 1).
Hybrid multi-variant generation has only mocked verification; no new live calls
were made for Task 8.2.
Earlier task sections below document the previous demo implementation.

## Local development

Use Node.js 22.14+ and npm for the application and native TypeScript test runner.

```sh
npm install
npm run dev
```

Open http://localhost:4317. Both development and production servers use port 4317.

```sh
npm run lint
npm run typecheck
npm run build
npm start
```

`npm start` serves the production build after `npm run build`.

## Home page

The home page uses local mock recipes from `src/lib/recipes.ts`. Search, suggestion chips,
categories, and the surprise button navigate to local routes. Favorites are kept in memory
for the current session; refreshing clears them. The menu route remains a placeholder.
Seasonal recipes use an accessible, horizontally scrollable collection.

The home page follows `design-references/home-page.png`, including the “Вкусно” brand,
desktop photo categories, recipe descriptions, and the mobile bottom navigation,
round categories, and horizontally scrollable recommendations.

The supplied reference's food photography is displayed through SVG viewports of a local copy
(`public/images/approved-home.png`); see `src/lib/reference-photos.ts` for the crop coordinates.
Only photographic regions are reused. Text, navigation, cards, and controls are HTML/React.
These small source regions have limited resolution; separate original photos can replace
them later without changing the layout. Earlier Unsplash placeholders remain available;
see [image credits](public/images/CREDITS.md).

## Search results

`/search?q=пилешко` follows `design-references/search-results.png`. All results are
local demo examples, including the simulated AI and web source badges. There are no
external source attributions, API requests, or generated recipe claims.

- `src/types/recipe.ts`: shared summary fields and discriminated source types.
- `src/lib/mock-search-recipes.ts`: 12 demo recipes with permanent IDs for future detail pages.
- `src/lib/recipe-search.ts`: keyword matching, combined filters, sorting and the initial page size.
- `src/components/search/`: responsive filters, recipe cards and search page composition.
- `src/lib/search-photos.ts`: food-only viewports from the supplied search reference.

Test locally:

1. Open http://localhost:4317/search?q=пилешко. Expect 12 matches: 3 featured and
   initially 8 additional recipes. Click “Покажи още рецепти” to reveal the ninth
   additional recipe without a reload; the button then disappears.
2. Try “Какво мога да приготвя с пилешко?”, “пиле с ориз”, “супа”, and an unsupported
   query such as “драконов плод”. The last query displays the search empty state.
3. Combine time, difficulty, cuisine and dish filters. Both endpoints of “30–60 мин”
   are inclusive; 30-minute recipes also qualify for “До 30 мин”.
   “Над 60 мин” plus “Салати” displays the filter empty state. Reset restores matches.
4. Change sorting, save a recipe and open “Любими”, then follow “Виж рецептата”.
   Recipe Details now resolves the same stable IDs used by Home and Search.
5. At 375px wide, check the single-column featured cards, two-column additional grid,
   scrollable time chips and the filter button that expands the three dropdowns.
   Use Tab/Enter and native select controls to test keyboard access.

## Recipe details

`/recipes/pile-s-oriz` follows the supplied `design-references/recipe-details.png`.
Preparation fields are attached to the existing Home and Search records, with a shared
rice preparation transcribed from the supplied mockup. `src/lib/recipe-catalog.ts` resolves
their stable IDs and deduplicates the shared rice record. Unknown IDs return a 404.

All recipes remain illustrative demos. No real AI generation, web attribution, ratings,
or nutritional values have been invented. The optional nutrition component renders only
fields present in recipe data. The assistant is a clearly marked coming-soon panel.
Food-only SVG viewports reuse the supplied recipe design, copied to
`public/images/approved-recipe.png`; original high-resolution photographs can replace it later.

Test with Node.js 22.14+ (native TypeScript stripping, no additional test dependency):

```sh
npm test
npm run lint
npm run build
```

1. Open http://localhost:4317/recipes/pile-s-oriz. Change 4 servings to 6:
   rice becomes 450 g, chicken 1200 g and water 1125 ml. Back at 4, base amounts return.
2. Check and uncheck ingredients; checkmarks persist while changing servings.
   The minus button stops at 1, and plus stops at 20.
3. Try `/recipes/musaka` (kg/l), `/recipes/salata-pileshko` (fractional pieces),
   and `/recipes/pile-kremoobrazen-sos` (simulated AI source, still labeled demo).
4. Test image thumbnails, favorites and “Започни да готвиш”. The cooking route
   receives the selected servings and restores any locally saved cooking progress.
5. At 375 px, expand the instructions, assistant, tips and source sections.
   No nutrition section appears because no nutrition data exists.
6. `/recipes/nonexistent` shows the recipe-specific not-found page.

Serving math and Bulgarian quantity formatting live in `src/lib/servings.ts`.
The unit suite covers fractions, all seven units, 1–20 limits, missing/zero quantities,
invalid inputs, precision and immutable base data.

## Interactive cooking mode

Open http://localhost:4317/recipes/pile-s-oriz/cook. The page uses the same recipe
catalog and instructions as Recipe Details, with no duplicate recipe collection.
Only steps that already have `durationMinutes` get a timer (rice steps 2 and 6).
The prominent rice dish photograph comes from the supplied cooking design; the
existing smaller step photos remain visible beside the instructions.

Cooking state is stored under `aichef:cooking:v1:<recipe-id>` in localStorage:
schema/data version, current/completed steps, ingredients, servings, independent
timer deadlines, pause/resume information, session status and last update time.
Changes are saved immediately. Recipe changes or malformed records reset safely;
blocked storage falls back to in-memory operation with an explicit notice.
Nothing accesses localStorage during SSR. Timers never start automatically.

“Пауза” freezes active timers, and “Продължи” resumes only those timers. Individually
paused timers stay paused. Exiting or moving between steps leaves active timers running.
Deadline-based calculations reconcile elapsed time on refresh, focus and visibility changes.
Timer completion is a visible notification; no background notification or audio permission
is requested. Reset clears the cooking session, while retaining its selected servings.

Manual checks:

1. In Recipe Details select 6 servings, then “Започни да готвиш”. Rice is 450 g.
2. Check an ingredient, finish step 1 and start the 5-minute timer on step 2.
   Move forward/back and refresh; the checklist, completed steps and countdown restore.
3. Switch tabs, then return. The timer reflects elapsed wall-clock time. Pause the
   whole session, refresh, and resume; the frozen remaining time is preserved.
4. Exit to Recipe Details and return. Selected servings and cooking progress remain.
5. Open another recipe's cooking route; its session is independent.
6. Finish the final step. The summary shows completed step count and the recipe's
   estimated time, never an invented actual duration. “Приготви отново” clears progress.
7. On mobile, expand ingredients, AI assistant and tips. Verify touch controls and no
   horizontal page overflow. The AI panel is explicitly coming soon and has no answers.

Run `npm test`, `npm run lint`, and `npm run build`. Tests use deterministic timestamps
and an in-memory Storage implementation to cover navigation, completion, timers,
background inactivity, restoration, invalid records, storage failures, isolation and reset.

Created files:

- `src/lib/cooking-session.ts`, `src/lib/cooking-timer.ts`: pure session/timer logic.
- `src/hooks/use-cooking-session.ts`: hydration-safe storage and clock subscription.
- `src/components/cooking/`: `cooking-mode.tsx`, `cooking-mode.module.css`,
  `cooking-header.tsx`, `cooking-progress.tsx`, `cooking-step.tsx`, `cooking-timer.tsx`,
  `cooking-navigation.tsx`, `cooking-ingredients.tsx`, `cooking-tips.tsx`,
  `cooking-assistant.tsx`, `cooking-completion.tsx`.
- `tests/cooking-session.test.ts`: automated behavior and persistence tests.
- `public/images/approved-cooking.png`: unchanged copy of the supplied reference.

Existing files changed for this task:

- `src/app/recipes/[id]/cook/page.tsx`: real cooking route and recipe validation.
- `src/components/recipe-details/recipe-details.tsx`,
  `src/components/recipe-details/recipe-header.tsx`: shared selected servings (Task 6).
  Legacy direct-link serving overrides are read after hydration, retaining static routes
  and unknown-ID 404 behavior.
- `src/lib/servings.ts`: serving query validation.
- `src/types/recipe.ts`: optional contextual step tip field (no advice generated).
- `src/components/layout/app-shell.module.css`: cooking page width exception only.
- `README.md`, `public/images/CREDITS.md`: usage, tests and asset documentation.

## Structure

- `src/app/`: App Router layouts and placeholder routes.
- `src/components/layout/`: reusable application shell.
- `src/components/ui/`: reusable UI components and CSS Modules.
- `src/components/motion/`: client-side Motion wrappers with reduced-motion support.
- `src/lib/`: shared application configuration.
- `src/app/globals.css`: design tokens and global styles.

Routes: `/`, `/search`, `/favorites`, `/menu`, `/recipes/[id]`, `/recipes/[id]/cook`.
Try `/recipes/pile-s-oriz` and `/recipes/pile-s-oriz/cook` to preview recipe details and interactive cooking.

Styling uses CSS Modules with global CSS variables; no Tailwind.
Lucide React provides icons, and Motion provides a small page entrance animation.
Firebase, web search and authentication remain deferred. Task 7 adds OpenAI generation; AI mode requires the server environment variables described above. Demo mode needs no API key.


## Task 6 — Application integration and UX refinement

Details and Cooking Mode now share one hydration-safe `useCookingSession` store per
recipe/data version. Serving changes and ingredient checks use the existing session
reducer and existing localStorage record, with no second persistence system. Both
pages scale the original ingredient data through `scaleIngredients`. The server
renders original servings; local preferences restore after hydration. Legacy initial
`?servings=6` links are supported and consumed once to prevent stale URL overrides.

Sessions restore on route entry, refresh and browser history navigation. Storage
events synchronize open tabs; unavailable storage falls back to the shared in-memory
store with a Bulgarian notice. Corrupt, incompatible schema/data-version records
start fresh. Elapsed timer deadlines reconcile normally; progress has no arbitrary
age expiry. Explicit restart clears progress/checklists/timers and retains servings.

Cooking photography is approximately 40% shorter on desktop, capped at 330px, and
180px on small phones. The generic tip repeated in the main instruction was removed;
all recipe tips remain below, and step-specific tips still appear in the main card.
At 1440×900 the first instruction and navigation fit in the viewport. Missing recipe
visuals have a labeled placeholder; absent step photos and nutrition are omitted.
Recipe routes highlight the discovery navigation section. Favorites remain usable
for the current app session; Meal Planner remains clearly marked as coming soon.

Validation executed successfully:

- `npm run lint`
- `npm run typecheck`
- `npm run build` (42 generated pages, 18 recipe and 18 cooking routes)
- `npm test` — 25 passing unit tests
- `npm run test:e2e` — 10 passing Chromium tests covering the 14 requested scenarios
  in grouped journey tests, including all four routes at 375, 390, 768, 1440 and 1920px

Playwright blocks non-local network requests in tests. It runs against the production
build on isolated port **4320**, starts/stops its own server, and does not reuse any
existing service. A fresh checkout needs:

```sh
npm install
npx playwright install chromium
npm run build
npm run test:e2e
```

Screenshots for all 20 page/viewport combinations are saved in `test-results/`.
Open the generated report with `npx playwright show-report`. Failure screenshots
and traces from the first retry are retained. These generated folders are gitignored.
Only Chromium is covered by the automated browser suite; Firefox/WebKit are not run.

Manual verification: run `npm run dev`, open http://localhost:4317, search for
“пиле с ориз”, open the classic rice recipe, change to 6 servings and check rice.
Enter Cooking Mode: rice should be 450g and checked. Finish step 1, start the step 2
timer, refresh, exit to Details and re-enter; servings, checks, step progress and timer
should persist. Complete all seven steps, then use “Приготви отново”. Try a second
recipe to confirm isolation, browser Back/Forward, a nonsense query, and an unknown
recipe ID. On phones expand the ingredient panel to view/check its items.

Task 6 file manifest (changed or added):

- `.gitignore`, `README.md`, `package.json`, `package-lock.json`, `eslint.config.mjs`
- `playwright.config.ts`, `tests/e2e/journey.spec.ts`, `tests/cooking-session.test.ts`
- `src/lib/cooking-session.ts`, `src/hooks/use-cooking-session.ts`
- `src/components/layout/header.tsx`
- `src/components/recipe-details/recipe-details.tsx`
- `src/components/recipe-details/ingredient-list.tsx`
- `src/components/recipe-details/recipe-header.tsx`
- `src/components/recipe-details/recipe-photo.tsx`
- `src/components/cooking/cooking-header.tsx`
- `src/components/cooking/cooking-completion.tsx`
- `src/components/cooking/cooking-step.tsx`
- `src/components/cooking/cooking-mode.module.css`

No unresolved functional failures were found in this validation. Existing limitations:
local demo data only, no live assistant/search/authentication, Favorites clear on full
refresh, and low-resolution food crops inherited from the approved references.

## Mandatory QA policy

[AGENTS.md](./AGENTS.md) defines the permanent acceptance gate for every development
task. Features need automated coverage, bug fixes need reproducing regression tests,
and every task must add/update affected Playwright tests. Existing tests must not be
weakened or disabled to obtain a pass. Blocked validation means an incomplete task.

```sh
npm run test:unit       # business logic, calculation, validation and session tests
npm run test:e2e        # full browser regression suite (requires current production build)
npm run validate       # lint + TypeScript + unit + production build + full E2E
npm run test:e2e:report # open the generated HTML report
```

`npm test` remains a unit-test alias. During development, run a relevant E2E subset
with `npm run test:e2e -- --grep '<scenario>'` after rebuilding. Before completion,
major integrations and releases, execute the full `npm run validate` gate. Commands
stop at the first failure; investigate it, fix the cause and rerun affected tests,
regressions and the complete gate.

Browser suites import `test`/`expect` from `tests/e2e/fixtures.ts`. It centralizes
network isolation and runtime-error assertions; mock external API responses using
explicit `page.route(..., route => route.fulfill(...))` handlers. Service workers
are blocked so they cannot bypass interception. Routine tests never use real OpenAI
or search calls. Browser interception does not cover server-side outbound requests;
future server integrations must also provide mocked provider adapters for E2E. Use
deterministic mock data and accessible role/label selectors.

Playwright retains screenshots on failure, records a trace on the first retry and
writes an HTML report to `playwright-report/`. A retry that passes is still a gate
failure (`failOnFlakyTests`); focused `.only` tests also fail validation. Desktop and
mobile checks include keyboard accessibility, persistence and empty-state recovery,
plus the existing five-width responsive regression. Chromium is the current browser
engine; this does not claim Firefox/WebKit coverage or a complete accessibility audit.

Every final report must name the implemented changes and test changes, list executed,
passed, failed and skipped counts separately for unit/E2E tests (including retries),
state lint/TypeScript/build outcomes, and disclose remaining issues or blockers.


## Task 7 — OpenAI integration

See [the complete implementation report and changed-file manifest](docs/task-7-openai.md).
Use `npm run test:api` for injected server-route/official-SDK transport tests.
`npm run validate` now includes these API tests between unit tests and the build.
Task 7.2 verified one live recipe with the configured `gpt-5.6-luna`; routine tests still never consume API credits. See [the live verification report](docs/task-7-2-live-verification.md).
