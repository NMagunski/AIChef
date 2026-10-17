<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Mandatory QA and test automation policy

These permanent rules apply to **every development task**, including features,
bug fixes, refactors, configuration and test-infrastructure changes. Preserve the
approved UI and existing useful instructions. Automated checks are the primary
acceptance mechanism; do not depend on extensive manual testing by the owner.

### Required coverage and architecture

1. Every new feature must include automated tests.
2. Every bug fix must include a regression test that reproduces the original bug.
   Demonstrate the failure against the original behavior where practical, then
   verify the fix with the same regression test.
3. Use Playwright for browser functional and end-to-end tests. **Every task must
   add or update Playwright tests for its affected functionality.**
4. Use unit tests for pure business logic, calculations, validation and utilities.
5. Cover happy paths, negative scenarios, edge cases, empty states, error handling,
   navigation, state persistence, mobile responsive behavior and accessibility of
   interactive controls. Identify the applicable cases for the affected behavior;
   do not substitute a trivial happy-path test for required coverage.
6. Test desktop and mobile viewports. Retain the existing 375, 390, 768, 1440 and
   1920px responsive regression checks. Include keyboard operation, accessible
   names, focus visibility and meaningful disabled/expanded/checked states for
   affected interactive controls.
7. Prefer stable accessible selectors (`getByRole`, `getByLabel`, accessible names)
   to fragile CSS selectors, positional selectors or arbitrary timeouts. Use
   Playwright's waiting assertions, isolated browser contexts and deterministic data.
8. Reuse the existing configuration, recipe mocks, session utilities and shared
   Playwright fixtures. Keep browser tests in `tests/e2e/*.spec.ts`, shared browser
   setup in `tests/e2e/fixtures.ts`, and unit tests in `tests/*.test.ts`. Extend this
   structure only when necessary; do not duplicate data or test setup. Server API
   tests live in `tests/server/*.test.ts`; deterministic shared inputs in `tests/helpers/`.
9. Mock external APIs in routine browser tests. Never make real OpenAI, web-search
   or other provider calls in routine E2E tests. The shared fixture rejects
   unexpected non-local requests; explicitly fulfill deterministic mock responses
   for integrations. Browser routing cannot intercept server-side outbound calls;
   mock server-side provider adapters too when adding those integrations. Do not
   require API keys, credentials or real user data.
10. Keep Playwright configured for failure screenshots, traces on the first retry,
    and HTML reports. Keep generated reports, screenshots and traces gitignored.
    Retries collect diagnostics; flaky passes must still fail the validation gate.

### Execution and completion gate

1. Every task must execute **ESLint, TypeScript validation, unit tests, Playwright
   tests and a production build**. Run `npm run validate` for the full gate. This
   fails on the first unsuccessful command and builds before production E2E tests.
2. After each feature implementation, run the relevant E2E regression scenarios.
   Use `npm run test:e2e -- --grep '<scenario>'` during iteration, after building
   the changed application. A targeted run does not replace the full task gate.
3. Run the **complete E2E regression suite** before major integrations and releases,
   in addition to all other required checks. `npm run validate` includes that suite.
4. If a test fails, investigate and fix the underlying issue, rerun the affected
   tests, then rerun relevant regressions and the full validation gate. Diagnose
   environment/setup failures explicitly instead of treating them as product passes.
5. Never modify, delete, weaken, disable or skip tests simply to make the suite pass.
   Legitimate behavior changes may update assertions with an explicit explanation
   and equivalent or stronger coverage. Do not delete existing tests for this policy.
6. Never claim checks passed unless actually executed successfully against the final
   implementation. Report actual results, including failures, retries and skips.
7. A task is complete only when implementation and all required checks pass. If
   testing is blocked, identify the blocker and mark the task **incomplete**.

### Commands

- `npm run lint` — ESLint.
- `npm run typecheck` — generate Next.js route types and validate TypeScript.
- `npm run test:unit` — all business-logic/unit tests; `npm test` remains an alias.
- `npm run test:api` — server HTTP handler and official SDK tests using injected/mocked providers.
- `npm run build` — production build.
- `npm run test:e2e` — complete Playwright regression suite against the existing
  production build; starts/stops its own server on **4320**, never port 3000.
- `npm run validate` — lint → typecheck → unit tests → server API tests → build → full Playwright suite.
- `npm run test:e2e:report` — open the HTML browser-test report.

On a fresh checkout run `npm ci` and `npx playwright install chromium` first.
Development and normal application start stay on port **4317**. If the test port is
occupied, diagnose the conflict; do not silently attach to an unrelated service.

### Mandatory final report for every development task

Report all of the following:

- Implemented functionality and added/updated tests.
- Number of tests executed, passed, failed and skipped (split unit and E2E results;
  also identify retries/flaky results rather than counting them as clean passes).
- Unit test results and Playwright E2E results.
- TypeScript results, ESLint results and production build status.
- Any remaining issues; if checks are blocked, the blocker and **incomplete** status.

State the commands actually executed and link to relevant reports when available.
Do not equate a documented policy, unexecuted test or manual inspection with a
successful automated check.
