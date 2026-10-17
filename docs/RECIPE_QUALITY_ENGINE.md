# Recipe quality engine — Task 9

## Architecture

`src/lib/recipe-quality/validate-recipe.ts` is a pure deterministic function over
an unknown value projected from the existing canonical `ResolvedRecipe` model.
It returns JSON-compatible `{ version, valid, issues, score, dimensions }`.
Each issue contains a stable code, `error|warning|info`, Bulgarian message, canonical
field path and scoring dimension. It neither mutates recipe data nor makes network
requests. Unexpected service exceptions fail closed with a sanitized error.

Provider-specific existing Zod schemas remain authoritative for canonical shape,
AI content hashes, source roles and web permission metadata. A small Zod projection
checks the common fields before numeric, identity, consistency, safety and dietary
rules. There is no second recipe dataset or new dependency.

Pipeline: generation/extraction → existing structural Zod validation → canonical
quality projection → ingredients/instructions/times → food safety → user constraints.
Errors block complete cooking instructions; warnings remain inspectable. A low
score alone never blocks content. Provenance, original quantities and third-party
text remain unchanged. Metadata-only links never become full recipes.

## Rules and severity

- Errors: nonpositive quantities, unsupported units, missing names/ingredients/steps,
  duplicate IDs, incomplete quantity/unit pairs, invalid servings, missing essential
  measurable amounts, invalid timers, definite dietary conflicts and recognized
  explicit unsafe recommendations.
- Warnings: duplicate ingredient entries, implausible per-serving amounts, suspicious
  units, ingredient references that cannot be reconciled, possible preparation order
  problems, inconsistent totals/individual-step times, uncertain compound-product
  composition, missing thermometer guidance and unclear safety statements.
- Info: unknown source times, species-specific shellfish advice and reminders that
  text alone cannot establish absence of allergens.

Default plausibility limits per serving: 1,000 g, 2,000 ml, or 20 pieces of a single
ingredient. Callers may configure each limit. These are review heuristics, not
nutritional recommendations, and do not reject bulk recipes. Original fractions and
units are retained. Source amounts explicitly marked unparsed warn instead of
inventing quantities; optional seasonings may remain unquantified.

The bounded Bulgarian food lexicon recognizes common synonyms, including
печурки/гъби. Fresh tomatoes and tomato paste are separate groups. Unused or missing
text references warn: steps may use collective names, implicit preparation or
pre-cut ingredients. Structured AI ingredient indices retain their existing protocol
integrity checks. No recipe is rejected for failing a free-text name repetition test.

Negative times/timers are errors. Unknown web times remain null. Totals differing
from preparation + cooking and steps exceeding total time warn. Step durations are
**never summed**: parallel tasks can overlap. The existing AI protocol still requires
individual timers to fit the declared total. Source times are not rewritten.

Explicit dietary queries and optional structured `excludedIngredients` are preserved
in validation options. Known animal, egg, dairy, peanut and gluten categories and
Bulgarian aliases supplement direct name matching. Plant milk and explicitly
gluten-free alternatives are distinguished. Ambiguous flour, oats, sauces and
compound products warn; no allergen-free certification is inferred from text.

Food-safety thresholds, exact sources and limitations: [FOOD_SAFETY_RULES.md](FOOD_SAFETY_RULES.md).

## Score: data completeness, never a safety or taste rating

Five dimensions start at 20: ingredients, instructions, time, quantities and user
constraints. Each error deducts 20 from its dimension; each warning deducts 4;
info deducts 0. Each dimension is floored at zero. The sum is 0–100. Dimensions
and issue locations explain every deduction. Validity is independently determined
by absence of errors. An unsafe recipe could score 80 and is still rejected.
Scores are not displayed as stars, user ratings or food-safety approval.

## Integration and persistence

- `validateModelRecipe` applies the shared gate after the existing raw schema and
  protocol checks, including the legacy single-generation endpoint path.
- `normalizeVariant` gates original and alternative canonical recipes individually.
  Hybrid decoder catches each failure, retains valid siblings and returns safe
  Bulgarian summaries. All-invalid bundles return the existing HTTP 502 error;
  explicit constraints in the legacy single endpoint use HTTP 422.
- AI response bundles carry optional structured reports keyed by accepted recipe ID.
  `validateAIBundle` recomputes reports from data and the original query rather than
  trusting a supplied score. Clients revalidate API and session-cache bundles.
- Authorized web extraction applies the shared gate after `webRecipeSchema`. Valid
  web results carry a report; rejected content falls back to metadata. No publisher
  content is changed or passed to AI. The production permission registry stays empty.
- Browser canonical storage rechecks quality on writes and reads, blocking unsafe
  legacy session entries. Reports can be recomputed from canonical content without
  changing existing IDs or hashes. Query constraints are checked again at search
  cache boundaries; query text is not added to canonical stored content.
- Search cards and Details add only an accessible collapsed “Бележки за данните”
  disclosure for warnings. No technical issue codes, score or certification appears.
  Dietary info/report details are available in structured API reports; the generic
  disclosure is recomputed without original-query text on Details.

## Verification

Existing deterministic fixtures, provider injection, shared browser request guards
and production Playwright configuration are reused. No test contacts OpenAI or
SerpApi. Added unit cases cover every requested validation category, serialization
and exception sanitization; API cases cover mixed validity, warnings, exclusions,
legacy generation and licensed web downgrade. Browser cases include original AI and
licensed-web Home → Details → Cooking → Completion journeys at desktop/mobile widths,
portions, checked products, timer persistence, refresh/history, invalid originals and
alternatives, explicit exclusions, accessible warnings and no overflow/certification.

Run `npm run validate`: ESLint → TypeScript → units → server API → production build
→ full Playwright functional/E2E regression. Final results and the file manifest are recorded below.

## Remaining limitations / future work

This is rule-based data validation, not a culinary reasoning or medical/allergy
system. Bulgarian vocabulary and phrase scope are incomplete; complex negation,
replacement ingredients, compound labels, ingredient-note restrictions and cross-step
semantics need expert-reviewed datasets. Numeric score is not calibrated against
expert ratings. Safety rules do not guarantee safe food. Existing illustrative demo
catalog pages are unchanged; complete live AI and permission-backed web flows are
gated. Production still needs distributed quotas/cost controls, CI/deployment/security
review, source licensing, culinary review and permission-backed live extraction
verification. No live paid requests were made or authorized for this task.

## File manifest

New engine modules:
- `src/lib/recipe-quality/quality-types.ts`
- `src/lib/recipe-quality/ingredients.ts`
- `src/lib/recipe-quality/ingredient-validation.ts`
- `src/lib/recipe-quality/instruction-validation.ts`
- `src/lib/recipe-quality/time-validation.ts`
- `src/lib/recipe-quality/food-safety-validation.ts`
- `src/lib/recipe-quality/dietary-validation.ts`
- `src/lib/recipe-quality/validate-recipe.ts`

Updated integration files:
- `src/lib/ai/recipe-schema.ts`
- `src/lib/ai/hybrid.ts`
- `src/lib/ai/generate-client.ts`
- `src/lib/ai/recipe-store.ts`
- `src/lib/server/generate-handler.ts`
- `src/lib/server/hybrid-generator.ts`
- `src/lib/server/web/search-service.ts`
- `src/lib/web/schema.ts`
- `src/lib/web/types.ts`
- `src/lib/web/search-client.ts`

UI additions/updates:
- `src/components/recipe-details/recipe-quality-notice.tsx`
- `src/components/recipe-details/recipe-quality-notice.module.css`
- `src/components/recipe-details/recipe-details.tsx`
- `src/components/search/search-recipe-card.tsx`

New tests:
- `tests/recipe-quality.test.ts`
- `tests/server/recipe-quality-api.test.ts`
- `tests/e2e/recipe-quality.spec.ts`

Documentation:
- `docs/RECIPE_QUALITY_ENGINE.md`
- `docs/FOOD_SAFETY_RULES.md`
- `docs/PROJECT_BACKLOG.md`

## Final executed results — 2026-10-17

Final command: `npm run validate` (exit 0).

| Suite | Executed | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: |
| Unit | 134 | 134 | 0 | 0 |
| Server API | 71 | 71 | 0 | 0 |
| Playwright functional + full E2E regression | 98 | 98 | 0 | 0 |
| Total | 303 | 303 | 0 | 0 |

ESLint, Next route type generation/TypeScript and production build passed. Final
browser run: 0 retries, 0 flaky tests, 35.3 seconds. Added 49 unit, 15 API and 12
Playwright cases; all previous 227 tests remain. Full Playwright count includes the
12 new quality cases and the existing regression journeys; it is not a separate
second suite to count twice. Desktop/mobile, navigation, persistence, servings,
timers, empty/error states, warning keyboard access and overflow checks passed.

During implementation, targeted unit checks caught a peanut-name derivative bug
and a temporary syntax typo; both were corrected. The first full gate had two
new desktop E2E failures because a checkbox assertion matched both Cooking and
Details before the exit navigation finished. Waiting for the exact Details URL
and heading before Back fixed synchronization without weakening assertions. The
next targeted quality + hybrid browser regression passed 28/28. The complete gate
was rerun after the final conservative storage/temperature refinements and passed
against the final implementation. No failures or skipped tests remain.

Local diagnostic artifacts (generated, not source files):
- `/tmp/aichef-task9-validation-final.log` — final complete gate output.
- `/tmp/aichef-task9-targeted.log` — targeted build/browser regression output.
- `playwright-report/index.html` — final HTML report. Failure screenshots and retry
  traces remain configured; successful final tests required no retry traces.

No real OpenAI or SerpApi calls were made. The production licensed-source registry
remains empty. Remaining production blockers are retained in `PROJECT_BACKLOG.md`:
expert culinary/safety review and broader semantics, actual source text/image
permissions, distributed cost/rate controls, persistent permission-aware storage,
CI/deployment/security/observability readiness and permission-backed live extraction
verification. Task 9 completes deterministic validation, not those integrations or
any certification of food safety/allergen absence.
