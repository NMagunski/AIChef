# Security, rate limiting and API cost protection — Task 10

## Pre-implementation audit (2026-10-17)

Inspected every public API route (two POST endpoints), underlying provider adapters,
server/browser caches, existing quotas, input schemas and browser retry paths.

| Surface | Existing protection | Finding / planned correction |
| --- | --- | --- |
| POST `/api/recipes/generate` | 8 KB body cap, strict query/batch Zod, same-origin checks, timeout, local rate limits/cache/coalescing | All counters/history/locks are process-local; trusts arbitrary X-Forwarded-For. Add shared atomic admission, provider quotas, identity policy and distributed generation attempts/leases. |
| POST `/api/recipes/search-web` | 4 KB cap, query schema, same-origin, local global 30/min | No per-client shared protection. Cursor syntax enforced only in service; cap provider pages/results explicitly and add shared provider accounting. |
| AI variants / extras | Max 3 initial/2 extra recipes, max 2 extra batches, local attempts, SDK retries disabled | New instances reset attempts/cache. Introduce atomic per-query attempts, terminal provider failure suppression and global concurrency admission. |
| SerpApi adapter | 8s deadline, 1MB body cap, fixed Google endpoint, 10 results/page, max start 90 | Repeated pagination across instances costs money; protect actual provider calls with shared page cache, quotas and duplicate locks. |
| Identity | SHA-256 of first X-Forwarded-For | Client can spoof unlimited identities. Default to shared anonymous bucket; require explicit secret-authenticated trusted proxy configuration for IP isolation. |
| Credentials | Server-only imports, no NEXT_PUBLIC keys, sanitized errors | Preserve boundaries. Add backend/HMAC secrets only server-side; test errors and built browser assets for leakage. |
| Caching | Bounded validated AI/web content, web licenses and quality gates | Process-local caches do not prevent multi-instance duplicate calls. Shared cache must be client-scoped, bounded, expiring, versioned and validated before reuse; no raw publisher bypass. |
| HTTP / retries | Bulgarian failures, Retry-After fixed 60s, no automatic provider retry | Add accurate retry windows, separate daily/monthly application quotas from provider billing errors, enforce browser cooldown without losing independent results. |

No public login/authentication endpoints exist. These are intentionally anonymous
recipe discovery endpoints: origin checks are not authentication. Requests without
Origin can be made by non-browser clients. Rate/quota controls limit that exposure;
this task does not introduce user accounts or claim to eliminate bots/DDoS.

Implementation/configuration/verification details follow after this audit. No live
OpenAI/SerpApi calls or paid infrastructure provisioning are permitted for Task 10.

## Implemented architecture

Public route handlers explicitly inject the same lazy `getSecurityController()`.
Production handler factories reject omission of security too. Structural validation,
body caps, origin checks and provider credential validation precede paid work.

`ProtectionStore` is a provider-independent interface. Two implementations:

- `RedisRestProtectionStore`: HTTPS Redis REST transport compatible with Upstash's
  documented command-array API. Uses atomic Lua EVAL for the complete admission
  transaction. No external SDK or new package dependency. A Redis instance or a
  compatible REST gateway supporting TIME/EVAL/GET/SET, counters and sorted sets is
  required; strong read/write consistency to one authoritative primary is required.
- `LocalProtectionStore`: bounded deterministic development/test implementation.
  It is never an implicit production fallback. At capacity it fails closed instead
  of evicting active quota entries. It cannot enforce limits across instances.

Production defaults to Redis when mode is absent. Invalid settings, absent URL/token
or identity secret, Redis network/protocol errors and backend timeouts block new
requests with sanitized Bulgarian HTTP 503. The transport uses TLS, bearer auth,
redirect rejection, a two-second whole-operation deadline, bounded response reads
and no retries. Backend credentials are server-only.

## Atomic admission, quotas and concurrency

Endpoint HTTP admission reserves per-client and global minute counters, including
cache-hit HTTP requests. Before a paid generation/search attempt, one atomic script:

1. Checks any terminal provider failure block and identical-request lease.
2. Removes expired concurrency leases, then checks the global concurrency bound.
3. Checks all per-client/global daily/monthly request and recipe-slot counters,
   paid-attempt minute limits and per-query generation attempt ceilings.
4. Only if every check passes, increments all counters and acquires both leases.

Redis TIME governs lease expiry. Counters receive TTL only on their first increment,
never a sliding extension on each request. All script keys share the namespace's
Redis cluster hash tag so global/client budgets can be checked atomically. This
places the security ledger on one logical Redis shard; capacity planning is needed.
Lua is atomic with respect to other Redis commands; do not configure eviction that
can remove live counters. Use durable storage/primary consistency and restricted
credentials. Losing or restoring stale counters can reset protection.

Daily/monthly keys use calendar UTC dates, with TTL to the next UTC boundary.
Application/server clocks must remain synchronized (normal NTP/platform time).
Minute windows are fixed windows starting at first admission, not sliding windows;
boundary bursts are possible. Daily/monthly rejections return HTTP 429 and the
remaining reset time in Retry-After. Per-query initial attempts are capped at two,
extras at one per allowed batch, for 24h in the shared ledger. Existing stricter local
history/extra-batch bounds remain additional guards, never production authority.

Counters count conservative **attempt reservations**, not successful recipes and not
provider invoices. Failed, invalid, timed-out and cancelled paid work is not refunded.
Each initial AI call reserves three recipe slots; each extra batch reserves two,
even when licensed sources reduce actual generation. In rare cache/lock races a
reservation can be consumed without paid work; this overcounts conservatively.

A successful canonical AI response is schema/quality-validated before shared cache
persistence. An identical active request from another instance returns HTTP 429
REQUEST_IN_PROGRESS rather than starting another provider call. Same-process calls
coalesce. Shared cache keys include HMAC'd client/query/model/batch fingerprints;
no plaintext IPs or queries are put into keys. Shared cache data contains canonical
recipes or normalized search metadata and must be treated as private operational
data: restrict access, encryption/retention and backups. Responses remain no-store.

Cache is checked before admission and again after lease acquisition to close the
stale-miss / previous-lock-release race. AI cached content is revalidated with the
original query and quality engine; web provider metadata is schema-validated, then
existing licensing/quality gates still run before full content is usable. AI cache
TTL is ten minutes; normalized discovery metadata TTL is five minutes. Values are
bounded to two million characters. A completed cached result can be served without
reserving another paid request, including during a provider quota block.

Global concurrency defaults: AI 5, web 10. Token-owned leases expire after 120s and
release cannot remove another owner's lock. AI work has the existing 45s deadline;
SerpApi retains its complete 8s deadline. A worker crash recovers by lease expiry.
A timeout/abort cannot guarantee a remote provider cancelled billing or processing.
Do not increase upstream deadlines past lease duration without changing the design.

## Client identity and authorization boundary

Default `shared` identity ignores X-Forwarded-For, cookies and all client identity
headers: every anonymous caller shares one conservative client bucket. This prevents
header spoofing at the expense of fairness; one abusive caller can exhaust everyone's
anonymous allowance. It is not account identity or user authentication.

For independent per-IP buckets, configure `trusted-proxy` and a strong proxy secret.
The gateway must strip incoming x-aichef-proxy-secret and the chosen IP header,
replace the IP with a verified address, and inject the secret. The application checks
the secret with constant-time comparison and requires a single valid IP. IPv6 aliases
are normalized. X-Forwarded-For is never consulted. Restrict direct origin access
and keep proxy secrets out of browser configuration/logs. Without a valid gateway
secret, trusted-proxy requests are HTTP 403; there is no permissive IP fallback.

HTTP Origin checks are CSRF/cross-origin defenses, not proof of identity. Anonymous
APIs remain usable by non-browser clients within limits. Add gateway WAF/DDoS/bot
controls and consider authenticated quotas later; this task adds no login flow.

## AI and web-specific controls

- AI query limit remains 500 characters / 8KB body. Prior-variant avoidance hints
  are capped at seven recipes, 160 title characters and 40 ingredient names of
  80 characters each, avoiding unbounded repeated prompt history. Strict structured outputs,
  recipe quality/safety/dietary checks and provenance are preserved.
- OPENAI_MAX_OUTPUT_TOKENS defaults to 16000, configurable 256–32000. The legacy
  single-recipe adapter caps at min(configured,8000). No model migration or prompt
  change. Confirm the selected model's own limits before deployment.
- The official SDK still has maxRetries=0. Quota/auth failures create a shared
  five-minute provider circuit block across queries/clients. Current requests keep
  the original distinct provider error; later work is suppressed without calling it.
- Initial AI variants remain at most three; extras at most two per batch, with
  AI_DISCOVERY_MAX_EXTRA_BATCHES limited to 0–2. Client-supplied counts/models ignored
  by strict request schemas. Cached successful recipes are reused; invalid output
  never becomes usable shared cache content.
- SerpApi remains fixed-endpoint, credential-private, bounded to 10 normalized
  results per provider page and at most WEB_MAX_PROVIDER_PAGES (1–10). The cursor
  must be a valid bounded page/offset; next pages must advance. Out-of-range starts
  fail before paid calls. At the configured page cap, pagination ends.
- Actual SerpApi calls, including internal hybrid lookups, use the same shared
  quotas/cache/leases. Source permissions, secure fetching, attribution and the empty
  production authorized-source registry are unchanged. No new scraping/reuse rights.

## Errors, cooldown and HTTP hardening

Bulgarian messages distinguish HTTP throttling, UTC daily/monthly budgets, in-flight
requests, temporary backend unavailability and actual provider credit/quota errors.
429 responses carry the appropriate remaining Retry-After, not a hard-coded minute.
Provider billing failures remain distinct 503 responses. Internal URLs, tokens,
stacks and backend details are not included. Existing independent AI/web results
remain visible when only one side fails.

The browser reads seconds or HTTP-date Retry-After. Retry buttons are disabled
until expiry, with a localized countdown and no automatic paid retry. In-memory
endpoint cooldowns also stop premature repeat calls; eligible cached recipes can
still be read. Refresh resets the UI cooldown but cannot bypass server enforcement.
Existing terminal provider errors retain their non-retry behavior. New security
responses may allow a manual retry after the documented cooldown.

Next response headers add nosniff, frame denial/CSP frame-ancestors, strict-origin
referrers and disabled camera/microphone/geolocation. This is not a complete
script-src CSP or security audit. Configure HTTPS/HSTS, origin/network restrictions
and operational security at the deployment gateway.

## Environment and deployment

`.env.local` was not changed. `.env.example` documents all settings without secrets.

Development: `API_SECURITY_MODE=local` (or omit it with next dev). Empty identity
secret uses a local-only fallback. Existing port 4317 remains. Local counters reset
on restart and cannot protect production costs.

Production requires, at minimum:

```dotenv
API_SECURITY_MODE=redis
API_REDIS_REST_URL=https://your-private-redis-rest-endpoint
API_REDIS_REST_TOKEN=<restricted-server-only-token>
API_IDENTITY_SECRET=<at-least-32-random-characters-shared-by-all-instances>
API_SECURITY_NAMESPACE=aichef-production
API_CLIENT_IDENTITY=trusted-proxy
API_TRUSTED_IP_HEADER=x-real-ip
API_TRUSTED_PROXY_SECRET=<different-strong-gateway-secret>
```

Provision/connect suitable shared Redis yourself; nothing was purchased, created
or connected in this task. Restart all instances after configuration changes.
Use one stable namespace/secret/limit policy across all instances. Rotating identity
secrets or namespaces resets client accounting/cache isolation: plan rotations,
retain global budgets and do not use rotation to bypass active cost controls.

`API_SECURITY_MODE=local-test` is allowed even in a production-built test server
**only** with RECIPE_SEARCH_MODE=demo and both paid API keys absent. Playwright
explicitly sets this mode and clears provider keys. Setting local-test with real
keys in production fails closed. It is not a deployment bypass for paid requests.

Default settings (all configurable in `.env.example`):

| Setting | AI | Web |
| --- | ---: | ---: |
| HTTP and paid-attempt client/minute | 5 | 10 |
| HTTP and paid-attempt global/minute | 30 | 30 |
| Paid client/day | 20 | 50 |
| Paid client/month | 200 | 500 |
| Paid global/day | 500 | 1000 |
| Paid global/month | 5000 | 10000 |
| Global concurrent work | 5 | 10 |

AI recipe-slot budgets: client 80/day,800/month; global 2000/day,20000/month.
Quota/rate values accept zero to stop new work. Concurrency must be 1–100, token
cap 256–32000, pages 1–10. Invalid/negative/fractional/out-of-range settings reject
configuration. Bounds prevent accidentally unlimited values. Changing limits is an
operator action, not a browser parameter. Monitor requests/costs and size for your
traffic before enabling production.

## Cost estimates and limits

Request reservations limit attempted API work; **they do not guarantee an exact USD
spending ceiling**. Models have different token rates, input sizes and reasoning
usage. Failed or aborted calls may bill; providers may change prices/accounting.
Other applications using the same keys are outside this ledger. Redis/gateway usage
itself may cost money. Set provider-native budgets, alerts and separate project keys.

`estimateTokenCost` is a pure scenario calculator using caller-supplied input/output
tokens and per-million rates. No fabricated current model prices, live billing data
or USD threshold is enforced. A flat search-cost scenario is attempted searches ×
provider unit price, only when that price/plan is actually known. Use actual provider
usage dashboards for reconciliation. Tokens reserved here are a response cap, not
measured billing tokens. The official OpenAI documentation states that output-token
caps include reasoning tokens, not only visible recipe text.

## Verification scope and remaining production blockers

All OpenAI/SerpApi dependencies are mocked. Unit tests use fake clocks and shared
atomic in-process fixtures; Redis REST tests verify EVAL protocol/error handling
with a mocked transport. No external Redis credentials were supplied or used and
no real Redis deployment was provisioned/tested. Multi-instance quota/concurrency
semantics are tested against the shared deterministic backend; deployment-specific
Redis Lua compatibility, primary consistency, durability, eviction policy, ACLs,
latency, gateway header overwriting and production load still require verification
against the chosen infrastructure. Production remains blocked until configured and
verified; passing local tests is not a production-readiness claim.

The old spoofed-client regression was strengthened to expect throttling at the
anonymous per-client limit (five), because spoofed headers no longer mint identities.
Global limits across separately verified proxy identities are tested independently.
No existing tests were removed or disabled. Full existing E2E journeys are retained.

References:
- [Redis atomic Lua scripting](https://redis.io/docs/latest/develop/programmability/eval-intro/)
- [Redis REST command transport](https://upstash.com/docs/redis/features/restapi)
- [Official OpenAI documentation: token accounting/caps](https://developers.openai.com/api/docs/guides/token-counting)

Final executed results and the complete file manifest are recorded below.

## File manifest

New server security modules:
- `src/lib/server/security/types.ts`
- `src/lib/server/security/config.ts`
- `src/lib/server/security/identity.ts`
- `src/lib/server/security/quotas.ts`
- `src/lib/server/security/local-store.ts`
- `src/lib/server/security/redis-store.ts`
- `src/lib/server/security/controller.ts`
- `src/lib/server/security/runtime.ts`
- `src/lib/server/security/error-response.ts`
- `src/lib/server/security/web-provider.ts`

New shared/browser helpers:
- `src/lib/api-protection-errors.ts`
- `src/lib/retry-after.ts`
- `src/hooks/use-retry-cooldown.ts`

Updated runtime/integration files:
- `src/app/api/recipes/generate/route.ts`
- `src/app/api/recipes/search-web/route.ts`
- `src/lib/server/generate-handler.ts`
- `src/lib/server/hybrid-generator.ts`
- `src/lib/server/openai-client.ts`
- `src/lib/server/openai-generator.ts`
- `src/lib/server/openai-variants.ts`
- `src/lib/server/web/search-runtime.ts`
- `src/lib/server/web/search-handler.ts`
- `src/lib/server/web/search-service.ts`
- `src/lib/server/web/serpapi.ts`
- `src/lib/ai/recipe-schema.ts`
- `src/lib/ai/generate-client.ts`
- `src/lib/ai/errors.ts`
- `src/lib/web/search-client.ts`
- `src/lib/web/errors.ts`
- `src/components/search/ai-search-results.tsx`

Configuration/tests/documentation:
- `.env.example`
- `next.config.ts`
- `playwright.config.ts`
- `tests/helpers/security.ts` (new)
- `tests/security.test.ts` (new)
- `tests/server/security-api.test.ts` (new)
- `tests/server/generate.test.ts` (strengthened spoofing regression)
- `tests/e2e/security.spec.ts` (new)
- `docs/SECURITY_AND_RATE_LIMITING.md` (new)
- `docs/PROJECT_BACKLOG.md`

No dependencies added, real credentials changed or existing tests deleted.

## Final executed results — 2026-10-17

Final command: `npm run validate`, exit **0**.

| Suite | Executed | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: | ---: |
| Unit | 175 | 175 | 0 | 0 |
| Server API | 91 | 91 | 0 | 0 |
| Playwright functional + full E2E regression | 110 | 110 | 0 | 0 |
| Total | 376 | 376 | 0 | 0 |

ESLint, Next route type generation/TypeScript and production build passed. Final
Playwright run: 45.4 seconds, zero retries/flaky results. Added 41 unit, 20 API and
12 browser cases; all previous 303 cases retained, with the documented stronger
spoofing regression. The 110 browser total includes both functional checks and
existing full cooking journeys; do not count those journeys twice.

Additional executed targeted build/browser run: security + hybrid regressions,
28/28 passed. During implementation the first gate stopped on an optional-field
TypeScript annotation in a new fixture; correcting its type resolved it. A later
browser run had six new test failures because unscoped alert selectors matched both
the application error and Next's route announcer. Scoping to the semantic main
region fixed the selectors without weakening expected messages or cooldown checks.
The affected scenarios and relevant hybrid regressions were rerun, followed by the
full final gate after all implementation refinements. No failures remain.

Coverage includes atomic multi-controller admission, per-client/global daily/monthly
budgets, expiration/reset boundaries, simultaneous requests, ownership/expiry of
leases, cache race/validation, output token/hint bounds, page caps, backend outage
and transport deadline, missing settings/credentials, provider credit exhaustion,
partial failures and no paid calls on rejection. Browser cases cover search/cache,
localized limits, Retry-After with a controlled clock, Show More/extra-batch controls,
licensed web fallback, desktop/mobile overflow, safe error text and HTTP headers.
The existing AI/original/alternative/authorized-web Home → Search → Details → Cooking
→ Completion, servings/checklist/timers/refresh/history/dietary/quality regressions
all passed. Existing 375/390/768/1440/1920px checks remain intact.

Local generated artifacts:
- `/tmp/aichef-task10-validation-final.log` — final complete gate.
- `/tmp/aichef-task10-targeted.log` — targeted build and browser regressions.
- `playwright-report/index.html` — final HTML report; screenshot/trace-on-failure
  configuration retained. No final retries required traces.

Presence-only configuration inspection confirmed `sharedStorageConfigured=false`
and `identitySecretConfigured=false`; no secret values were printed and `.env.local`
was not changed. Production is deliberately blocked. External Redis provisioning,
credential entry, gateway configuration and deployment-specific verification are
still required. These are operator/deployment prerequisites, not skipped automated
tests. No real OpenAI/SerpApi calls, live Redis requests or infrastructure purchases
were made. No additional dependencies were installed.
