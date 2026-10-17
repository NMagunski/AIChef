# AIChef project backlog

## Completed foundation

- Tasks 1–2: Next.js App Router/TypeScript/CSS Modules, approved Bulgarian Home,
  responsive shared design and local mock catalog.
- Tasks 3–6: Search filters and pagination for demo collection; Details with
  quantities/servings; interactive Cooking Mode, timers/session persistence and UX
  integration. Preserve all approved pages and existing tests.
- Mandatory QA policy in AGENTS.md; deterministic units, server API tests,
  desktop/mobile Playwright, production validation gate and diagnostic reports.
- Tasks 7, 7.1, 7.2: Responses API recipe generation and strict normalization;
  controlled errors, temporary cache/store; live verification findings retained in
  `task-7-1-live-smoke.md` and `task-7-2-live-verification.md`. Previous baseline:
  46 unit + 19 server API + 43 Playwright = 108 passing tests.

## Task 8 — implementation complete; discovery verification in Task 8.1

- Google discovery through replaceable SerpApi adapter, independent combined search,
  normalized/deduplicated source metadata and incremental provider pagination.
- Authorized-source permissions, secure JSON-LD extraction, canonical recipe reuse
  in Details/Cooking and temporary storage; unknown sources remain original links.
- Deterministic tests and documentation completed. Final `npm run validate` passed:
  **68 unit + 39 server API + 58 Playwright = 165 passed**, 0 failed/skipped,
  0 final retries/flaky tests; ESLint, TypeScript and production build passed.
- Task 8 completed implementation/automated validation without a live smoke test.
  Task 8.1 subsequently verified live discovery (below), while full source extraction
  remains restricted. No production reuse agreements supplied; registry stays empty.

## Task 8.1 — live discovery verified; live extraction restricted

- Initial attempt was blocked by missing configuration and made zero provider
  calls; its offline gate passed 167 tests. The owner then supplied local settings.
- Verified key presence and `WEB_SEARCH_PROVIDER=serpapi`, without printing the key
  or modifying `.env.local`. Exactly **5/5 authorized SerpApi requests used**:
  all HTTP 200, 38 organic results, 37 unique metadata links after deduplication,
  23 individual text-recipe candidates by title/URL review, 14 distinct hostnames.
- Dish relevance is good at the discovery level, but results include social/video,
  collection and Wikipedia pages. Ingredient/recipe completeness is not verified.
- Found/fixed a real `fb_comment_id` duplicate and lack of a firm whole-response
  deadline (one live call took 26.479 seconds). Both original failures were reproduced
  by deterministic regressions before fixes. No additional live calls were made;
  the timeout fix remains live-unverified and may reject slow cold searches.
- Registry remains empty: all discovered publishers have UNKNOWN permission and
  METADATA_ONLY access. Documented text/image licenses are still needed; no source
  pages fetched, no full content/images reused, no live Cooking Mode eligibility.
  Live extraction remains unverified under existing permission controls.
- Added sanitized first-page metadata and desktop/mobile replay tests for all five
  queries; existing missing-configuration and full AI/authorized fixture journeys
  are retained. Final resumed `npm run validate` passed: **70 unit + 41 API +
  70 Playwright = 181 passed**, 0 failed/skipped, 0 retries/flaky tests. ESLint,
  TypeScript and production build passed. Full source extraction remains unverified.
- The five-call live budget is exhausted. No further provider calls or pages without
  new authorization. No live OpenAI calls. Full findings: `task-8-1-live-search.md`.

## Task 8.2 — complete (implementation and mocked automated validation)

- Initial target: one original AI + up to two validated licensed web recipes,
  filled with independent AI alternatives, at most three complete initial cards.
- Metadata-only links stay under “Още рецепти в интернет”. Original, alternative,
  licensed and metadata-only provenance is explicit and backward compatible.
- One structured generation call per batch; original query/constraints/safety rules
  preserved. No publisher content is supplied to the model. Existing licensed-source
  registry, canonical recipe store, Details, servings and Cooking Mode are reused.
- Bounded cache/retry history and configurable extra AI batches; at most two total initial
  generation attempts and one attempt per extra batch, with terminal
  quota/auth suppression. Local limits are not distributed production cost control.
- Added unit/API/desktop-mobile E2E coverage, strict initial-card cap regression and
  a guard against generating paid extras while web results are pending. Displaced
  cached alternatives reveal only after Show More, without another API call.
- Final `npm run validate` passed: **85 unit + 56 API + 86 Playwright = 227 passed**,
  0 failed/skipped, 0 final retries/flaky tests. ESLint, TypeScript and production
  build passed. Previous tests preserved; 46 new tests added. No live OpenAI/SerpApi
  requests were made for this task.
- Full details/file manifest: `task-8-2-hybrid-discovery.md`. New prompt output
  quality/latency remains live-unverified; source text/image licenses remain absent.

## Task 9 — complete (implementation and mocked automated validation)

- Deterministic canonical quality pipeline with structured errors/warnings/info,
  numeric/identity/ingredient/instruction/time rules and configurable plausibility.
- Conservative Bulgarian food-safety and dietary checks gate original AI, alternatives
  and authorized web content; invalid web content stays metadata-only. Other valid
  recipes remain usable. Source content, provenance and canonical IDs are preserved.
- Explainable 0–100 data-quality score (five dimensions); never a food-safety guarantee
  or user rating. Accessible collapsed warning disclosures reuse the approved UI.
- Provider responses, cached bundles and canonical browser storage are revalidated.
  No production permissions, credentials, providers or approved layouts were changed.
- Added deterministic unit/API/browser cases and desktop/mobile original AI and
  authorized-web full cooking journeys. Existing 227 tests retained. No live paid calls.
- Documentation: `RECIPE_QUALITY_ENGINE.md` and `FOOD_SAFETY_RULES.md`.
- Final `npm run validate` passed: **134 unit + 71 API + 98 Playwright = 303 passed**,
  0 failed/skipped, 0 retries/flaky tests. ESLint, TypeScript and production build
  passed. Added 76 tests (49 unit, 15 API, 12 browser); no existing tests removed.
- The initial full gate exposed two new E2E navigation synchronization errors; exact
  destination assertions fixed the tests, and targeted plus full regressions passed.
  Food safety and allergy suitability still require expert/user judgment; passing
  automated validation does not guarantee safe food.

## Task 10 — complete (implementation and mocked automated validation); deployment blocked

- Pre-change audit recorded for both public POST endpoints and provider paths.
- Shared Redis REST / atomic Lua admission for endpoint/client/global rates, UTC
  daily/monthly attempted-call quotas, conservative AI recipe-slot limits, query
  attempts, provider circuit blocks, token-owned leases and validated shared caches.
- Explicit local/test mode; no production fallback to process-local protection.
  Arbitrary X-Forwarded-For is ignored. Optional secret-authenticated trusted proxy
  enables separate IP buckets; otherwise callers share a conservative anonymous cap.
- Bounded output tokens, avoidance hints, provider pages/results and retries; browser
  Retry-After cooldown and independent provider failures preserve existing results.
  Existing structured outputs, quality and licensing gates remain in force.
- No paid provider requests or infrastructure provisioning. Redis and identity
  settings are absent locally (presence checked without printing credentials).
- Deployment remains blocked pending shared storage and gateway configuration plus
  real infrastructure consistency/durability/ACL/load verification. Implementation
  tests use deterministic backend fixtures and mocked Redis REST/provider transports.
- Final `npm run validate` passed: **175 unit + 91 API + 110 Playwright = 376 passed**,
  0 failed/skipped, 0 final retries/flaky tests. ESLint, TypeScript and production
  build passed. Added 73 tests (41 unit, 20 API, 12 browser); previous 303 retained.
- Full configuration, audit, file manifest, limitations and final test report:
  `SECURITY_AND_RATE_LIMITING.md`. No production-readiness claim without configured
  and verified distributed infrastructure.

## Task 11 — complete locally; GitHub connection/hosted execution pending approval

- Initialized a local repository on main; no staging, commit, remote, push or deploy.
- Expanded ignore rules and added a secret scan with redacted findings. Actual
  environment files remain ignored and .env.example remains publishable.
- GitHub Actions PR/main workflow uses verified SHA pins, minimum permissions,
  clean mock-only environment, locked installs and one complete validation invocation.
- Failure screenshots/traces/HTML reports and numeric summaries have seven-day
  artifact retention. Existing tests retained; CI configuration and clean browser
  tests added. No application features/design changed.
- Hosted Actions execution and repository branch rules remain pending explicit owner
  approval to connect GitHub. No paid providers or infrastructure were used.
- Workspace and fresh-install verification both passed `npm run ci:validate` →
  `npm run validate`: **187 unit + 91 API + 112 Playwright = 390 passed per run**,
  0 failed/skipped, 0 retries/flaky results; ESLint, TypeScript and build passed.
  Added 12 unit + 2 browser tests; previous 376 preserved. Offline npm ci installed
  381 packages in the isolated copy with no private environment files.
- Final publishable-file secret scan: 205 candidates, 0 findings. Nothing staged.
- Full configuration, operating instructions and verification report: `CI_CD.md`.

## High priority / production blockers

- Configure and verify the Task 10 distributed Redis backend and trusted gateway;
  no production shared-storage credentials or identity secret are configured yet.
- Provider-native budgets/billing alerts, ledger monitoring, gateway bot/WAF controls
  and production cost/abuse review; Task 10 attempt quotas are not a precise USD cap.
- Expert culinary/food-safety review and broader Bulgarian semantic/dietary validation
  beyond the bounded deterministic quality engine in Task 9.
- Source licensing and attribution audit; retain actual agreements before enabling
  full publisher content. Audit photograph permission separately.
- Review and create the initial Git commit; local main repository exists with no
  staged files/commits. Remote connection/push requires explicit owner approval.
- Authorize GitHub connection, execute the first hosted CI run and configure main
  branch required checks/reviews. CI is prepared locally; CD/deployment and production
  secrets/environment configuration remain pending and require separate approval.
- Production deployment readiness, hosting timeout/capacity review, observability,
  security review and permission-backed live extraction verification.

## Medium priority / pending features

- Firebase integration and user authentication.
- Persistent favorite recipes (current favorites are a local prototype).
- Shopping lists and weekly meal planner.
- Better images using Higgsfield; authorized image retrieval/proxy/cache design.
- Persistent recipe storage with server permission revalidation, revocation and
  licensing-aware retention policies.

## Known issues / technical debt

- Local/test caches and limits do not span instances or survive restart. Production
  routes now require Task 10 distributed protection, currently unconfigured. Verify
  Redis primary consistency, durability/no-eviction, clock synchronization, proxy
  header overwriting and load before enabling paid production traffic.
- Browser recipes expire (AI 24h/web 10min), max 20 per tab. Opening in a different
  tab/device or after expiry can require rediscovery. Permission revocation is not
  pushed into already-open views; no permanent full-content storage is implemented.
- Unknown yield/incomplete JSON-LD cannot safely drive servings/Cooking and stays
  metadata-only. Some publisher aliases, layouts and structured-data variants need
  future adapters; no arbitrary scraping or AI reconstruction fallback.
- Keyword checks cannot establish dietary/allergy/semantic correctness or source
  safety. Source ranking is discovery order, not a quality score.
- Dependency audit reports 5 high advisories in the development ESLint/Next plugin
  dependency chain (braces/micromatch/fast-glob). Review a compatible upgrade;
  do not apply the suggested major downgrade blindly. New parser dependencies are
  runtime dependencies; production-only audit reports no advisories.
- Live discovery verified in Task 8.1. Registry remains empty; full web extraction/
  Cooking journeys are verified only with synthetic authorized fixtures. Slow cold
  SerpApi calls can exceed the 8-second response deadline; observe latency/cost before
  deciding on a longer production budget. The deadline fix was validated with mocks.

## Future improvements

- Voice cooking assistant and user personalization.
- Organic growth and SEO.
- Advertising architecture and sponsored recipe placements.
- Food-brand partnerships.

Do not implement these unrelated items as part of Task 8. Update this document when
work is completed; retain historical verification documents and existing work.
