# Git and CI/CD — Task 11

## Scope and current Git state

Local repository initialized on `main`. No remote was created or connected; no
files were staged, no commit was made and nothing was pushed/deployed. This task
prepares CI configuration; a hosted GitHub Actions run requires the owner's explicit
approval to connect/publish first. There is no deployment workflow or paid service.

Use short-lived `feature/<name>` or `fix/<name>` branches from main. After connection,
submit a PR, require the **Full validation** job, resolve failures and merge reviewed
changes. Prefer small coherent commits. Protect main against force pushes/direct
merges and require review of workflow/dependency changes. Those repository rules
cannot be applied while no GitHub repository is connected.

Before a future initial commit: run `npm run scan:secrets`, inspect `git status` and
`git diff --cached --stat`, then review the intended files before committing. Do not
force-add ignored files. A commit/push/remote connection was not part of this task.
Do not add actual API keys to Git or routine CI secrets.

## Ignore and security checks

`.gitignore` excludes environment files, dependencies/build outputs, Playwright
reports/results, coverage, CI summaries, temporary logs/files, local tool directories,
private keys, service-account files and local credentials. `.env.example` remains
publishable. Ignoring a file does not remove it from existing Git history; this new
repository has no commits/history or staged files.

`npm run scan:secrets` inspects tracked and publishable untracked files, including
fixtures. It detects private-key headers, known OpenAI/GitHub/AWS credential formats,
literal SerpApi keys and copies of local ignored environment secrets. Local secret
values are compared in memory and never returned/logged; findings contain only
file/rule/line. Actual environment files and symlinks in the candidate set fail the
check. A scan failure stops validation: investigate, remove the exposure and rotate
real leaked credentials if necessary, then rescan before staging.

This is a bounded heuristic, not proof that every credential/encoding has been found.
It does not audit every ignored build/log file or external Git history. Synthetic
fixture values are intentional; no real provider credentials belong in fixtures.
Use repository secret scanning/protection where available after connection, without
automatically purchasing any service. Review changed/staged files as well.

## Workflow and quality gates

`.github/workflows/ci.yml` runs on pull requests and pushes to main. No
pull_request_target, workflow_run privilege bridge, deployment or secret reference.
It uses hosted Ubuntu 24.04, read-only contents permission, disabled checkout
credential persistence and concurrency cancellation for superseded runs.

Actions are pinned to immutable verified release commits:

- checkout v6.0.2: `de0fac2e4500dabe0009e67214ff5f5447ce83dd`
- setup-node v6.0.0: `2028fbc5c25fe9cf00d9f06a71cc4710d4507903`
- upload-artifact v5.0.0: `330a01c490aca151604b8cf639adc76d48f6c5d4`

`.nvmrc` pins the existing tested Node 22.14.0 baseline. package.json declares the
supported Node 22 range and npm 11 range, with packageManager npm@11.15.0. CI installs
that exact npm version, runs npm ci from the lockfile, then installs Chromium and
Linux system dependencies using `npx --no-install playwright install --with-deps chromium`.
The action's bundled Node runtime is separate from the application's Node pin.
Pinned toolchains/actions still need periodic security-update review. This task does
not claim that the existing baseline is the latest production patch release.

One `npm run ci:validate` invocation calls **npm run validate once**, preserving:

1. Secret scan.
2. ESLint.
3. TypeScript/Next route type generation.
4. Unit tests.
5. Server API tests with injected providers.
6. Production build.
7. All Playwright functional tests and complete E2E regression, once.

Building precedes E2E because Playwright starts the production build. No duplicate
browser/E2E invocation and no continue-on-error for gates. The wrapper preserves the
child's failing exit status. Tests validate YAML semantics, action pins, install and
script invocation, reporting, environment isolation, ignore policy and secret scan.
js-yaml 4.3.2 is declared directly as a dev dependency for real workflow parsing;
it was already present transitively and is not an application/runtime dependency.

## Mock-only execution and untrusted PRs

Workflow environment and `scripts/ci-env.mjs` explicitly clear paid provider keys
and Redis credentials, select demo/local-test and anonymous identity, and remove
inherited production proxy/quota/provider overrides. Ignored `.env.local` cannot
override explicitly empty process credentials. No production Redis credentials or
live OpenAI/SerpApi calls are needed. Playwright server receives the same isolated
environment even when tests run directly. Existing browser request guards reject
unmocked external requests; server tests inject mocked adapters. New desktop/mobile
checks confirm actual endpoints reject missing provider configuration while mocked
recipe results remain usable.

No repository secrets are referenced. Keep fork PR token/secrets protections enabled,
require approval for first-time contributors as appropriate and never use a privileged
self-hosted runner for untrusted PRs. Do not enable write-token sharing for forks.
The minimum GITHUB_TOKEN can read contents; no deployment/PR-comment permissions are
requested. Malicious test code is still arbitrary code: isolation and code review
matter. This workflow does not claim to sandbox all network access from hostile code.

## Reports and troubleshooting

`scripts/ci-validate.mjs` streams validation output and produces numeric summaries:
`ci-reports/summary.md` and `ci-reports/results.json`. It appends the Markdown to
GITHUB_STEP_SUMMARY on GitHub. Failed/unreached gates are distinguished; unreached
checks are never described as passed. Unit/API counts come from TAP summaries;
browser totals come from the Playwright final summary, treating flaky/interrupted
cases as failures. Raw validation logs are not included in uploaded artifacts.

After successful or failed validation (unless cancelled), upload-artifact retains
only `playwright-report/`, `test-results/` and the two summary files for **7 days**.
No workspace-wide upload, hidden files, environment files or credentials. Screenshots
are captured on failure, traces on the first retry, HTML reports on each test run.
A passing retry remains a failure through failOnFlakyTests; focused .only also fails.
If dependency/browser installation fails before validation, there may be no artifacts;
inspect that failed Actions step. Job cancellation/runner loss can prevent uploads.

Playwright uses one worker when CI is set, a ten-minute suite timeout and the
existing local test server on 4320. Job timeout is 30 minutes, leaving time for
installation/build/diagnostics. Existing five viewport regressions are retained.
No environment files should ever be attached as troubleshooting artifacts.

Local commands:

```sh
nvm use
npm ci
npx --no-install playwright install chromium
npm run validate
npm run ci:validate
npm run test:e2e:report
```

The first validation command uses local process settings; CI entry point explicitly
creates the mock-only environment. Both execute every required gate. To debug one
browser scenario, rebuild then use `npm run test:e2e -- --grep '<scenario>'`; rerun
the full gate afterwards. Normal development stays on port 4317.

- npm ci lockfile failure: align package.json/lockfile intentionally; do not replace
  npm ci with unpinned npm install or regenerate dependencies merely to bypass CI.
- Node/npm mismatch: use .nvmrc and packageManager pins.
- Browser missing: install Chromium; on Linux include --with-deps.
- Port 4320 occupied: identify the process; do not attach to an unrelated service.
- A skipped gate after lint/type/test failure: fix the first failure and rerun.
- Missing API/Redis configuration in mock tests is expected; live keys are not a fix.
- Need to update an action SHA: verify its official release commit, review changes,
  update the pin/comment, run configuration tests and the full gate.

## Pending GitHub setup and production blockers

Owner approval is required before creating/connecting a remote or pushing. Afterwards:
choose owner/repository visibility, review licensing/initial source snapshot, create
reviewed commits, connect/push only when authorized, enable Actions, run the first
hosted workflow and require Full validation in main branch rules. Hosted-run/artifact
upload and Linux runner behavior remain unverified until then. This is intentionally
pending setup, not a claim of an executed GitHub Actions run.

CD/deployment remains absent and unauthorized. Redis/gateway configuration and live
infrastructure verification, cost alerts/WAF, source licenses, culinary review,
production secrets/hosting/observability/security and dependency advisory review
remain in PROJECT_BACKLOG.md. Local/mock CI passing is not production approval.

References:
- [Playwright CI and browser dependencies](https://playwright.dev/docs/ci)
- [Checkout pinned release](https://github.com/actions/checkout/releases/tag/v6.0.2)
- [Setup Node pinned release](https://github.com/actions/setup-node/releases/tag/v6.0.0)
- [Artifact pinned release](https://github.com/actions/upload-artifact/releases/tag/v5.0.0)

## Task file manifest

- `.git/`: initialized local main repository; no remote/indexed files/commits.
- `.gitignore`: additional generated files and local credential exclusions.
- `.nvmrc`: tested Node pin (new).
- `.github/workflows/ci.yml`: workflow (new).
- `package.json`, `package-lock.json`: runtime/package-manager policy, CI/security
  scripts and explicit workflow-parser dev dependency.
- `scripts/scan-secrets.mjs`, `scripts/ci-env.mjs`, `scripts/ci-summary.mjs`,
  `scripts/ci-validate.mjs`: secret scan, isolation, reporting and runner (new).
- `playwright.config.ts`: isolated server environment, CI worker and global timeout.
- `tests/ci-automation.test.ts`: configuration/report/scan units (new).
- `tests/e2e/ci-clean-environment.spec.ts`: mock-only desktop/mobile checks (new).
- `docs/CI_CD.md`: operating instructions/report (new).
- `docs/PROJECT_BACKLOG.md`: status update.

Final executed results are recorded below.

## Final executed verification — 2026-10-17

Both the current workspace and an isolated fresh-install copy passed:
`npm run ci:validate` → `npm run validate` (exit 0).

| Suite | Passed per full run | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Unit | 187 | 0 | 0 |
| Server API | 91 | 0 | 0 |
| Playwright functional + complete E2E | 112 | 0 | 0 |
| Total | 390 | 0 | 0 |

There are 390 unique cases, executed in each of the two full verification runs
(780 case executions across those final runs, not 780 different tests). Both runs
passed ESLint, TypeScript/Next type generation, production build and the secret
scan. Both browser runs had zero retries/flaky cases. Added 12 unit and 2 browser
cases; the previous 376 tests remain. Playwright includes all prior full cooking,
servings, persistence, timers, refresh/history, alternatives, dietary, quality,
pagination, partial failure and mobile regressions; those are not a second suite.

The clean copy was created outside the project at
`/tmp/aichef-task11-clean-3uww57jf`, using only Git-publishable source files, with no
private environment files, node_modules or existing build. An independent
`npm ci --offline --no-audit --no-fund` installed **381 packages in 6 seconds** from
the existing npm cache. Full CI validation then built and ran all browser scenarios
using the installed Chromium cache. This verifies fresh project dependencies/source
on the local macOS host; Ubuntu browser system-package installation and artifact
upload have not been executed on a hosted GitHub runner. npm reported existing
whatwg-encoding/ESLint deprecation warnings; installation succeeded. Existing
production/dependency upgrade review items remain in the backlog.

During implementation the first CI wrapper run stopped correctly on a new helper's
TypeScript return annotation, marked typecheck Failed and all subsequent checks
Not run, and returned nonzero. Adding an explicit string-environment return type
fixed the issue. Both complete final runs then passed; no tests were weakened or
skipped. The successful summary lists the actual 187/91/112 counts.

Final security/Git verification:
- 205 publishable source candidates scanned, zero findings; no values printed.
- No commits/history existed to contain accidentally committed secrets.
- Actual environment files, logs, credentials and generated reports are ignored;
  `.env.example` is included in the candidate set.
- Branch main; staged/indexed files 0; commits 0; remotes 0.
- No GitHub login/project connection, push, deployment, provider calls or paid
  infrastructure provisioning took place. Public documentation/release pages were
  read only to verify workflow syntax and action pins.

Local generated reports:
- `ci-reports/summary.md`, `ci-reports/results.json`: workspace validation summary.
- `playwright-report/index.html`: workspace HTML browser report.
- `/tmp/aichef-task11-validation-final.log`: complete workspace gate output.
- `/tmp/aichef-task11-clean-validation.log`: complete clean-copy gate output.
- Clean-copy summaries/HTML report reside under the temporary copy, not Git.

GitHub CI is **prepared and locally verified, not hosted-executed**. Owner approval,
a reviewed initial commit/remote, first hosted run and branch required checks remain
setup steps. Production/CD blockers from Task 10 remain. No production-readiness or
successful remote CI/deployment is claimed.
