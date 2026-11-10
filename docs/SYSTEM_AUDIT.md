# System audit and backend milestone — 10 November 2026

The local preview and existing account APIs were audited before the next Supabase/GitHub integration. No hosted project, production account, migration application, repository push or deployment was performed. The workspace did not contain a Git repository or working Supabase environment configuration.

## Findings addressed

| Finding | Result |
| --- | --- |
| Private proof policies used JWT administrator claims after role/status changes | Migration 007 checks current database roles and active status; local PostgreSQL regression tests cover revoked/stale-role and suspended access |
| Payment instruction/review RPCs did not reject suspended administrators | Database checks added; regression test passes |
| Admin payment loading issued one request per country | Bulk authenticated endpoint and frontend loader use one database read/request for all countries |
| A successful 204 payment-review response was parsed as JSON and reported as failure | Shared frontend API transport accepts empty successful responses |
| Lost submission responses could cause deletion of already-committed proof objects | Confirmed receipts are recovered; uncertain objects remain private for reconciliation |
| Auth handling differed by route, with weak `/api/me` bearer parsing and inconsistent suspension handling | Shared authentication, role and storage guards; no client metadata can grant an admin role |
| Slow upstream requests had no explicit bound | Supabase requests and browser API requests have timeouts; stalled Auth regression test returns 503 |
| Disabled payment-instruction drafts were readable in raw JSON | API filters disabled methods for members; migration 008 removes direct browser access to the draft table |
| No distinction between liveness and database readiness | Public health/readiness and protected detailed status endpoint added |
| Configuration mistakes could reach runtime silently | URL/key-type, numeric-limit and intake configuration checks added |
| Request failures were difficult to correlate | Server-generated request IDs, no-store responses, safe JSON errors and JSON rate-limit responses |
| Site-name settings did not reach the dashboard footer | Footer now reads saved settings while preserving the original default branding |
| Lint did not cover Node `.mjs` globals and rejected the control-character validator | Lint configuration and equivalent validator corrected; unused component export removed |
| Tests still expected seven admin tabs and a native profile country select | Expectations updated to include Support and use the actual custom Country control |
| Database behavior had only mocked API tests | Eight embedded PostgreSQL integration tests now execute migrations and verify policies/RPC transactions |
| Test setup assumed Windows and a development API runner | Platform-specific commands/browser defaults corrected; the API is compiled before browser tests |

## Verification

Lint, both builds and all eight PostgreSQL integration tests passed. The full desktop/mobile suite passed 121 checks with one duplicate screenshot check skipped. After the final draft-privacy changes, all 24 backend/payment checks passed; the final readiness revision check was also rerun in the backend suite. Detailed results are recorded in [VALIDATION.md](VALIDATION.md). `npm audit` reported zero known dependency vulnerabilities during this audit. This is an advisory lookup, not proof that the application has no security defects.

Readiness and setup checks deliberately report missing configuration until the owner supplies the real Supabase project. The database integration tests use PostgreSQL with simulated Supabase schemas; the API tests use controlled Auth/storage substitutes except for the local upstream timeout test. They cannot establish live email delivery, cloud permissions or provider behavior.

## What remains before a live launch

1. Connect the intended Supabase project and apply migrations 001–007 in order. Verify the actual grants/policies and bucket using two real member accounts and an administrator, including suspension and role revocation.
2. Verify sign-up, confirmation email, recovery, session refresh, administration, support, balance history and proof persistence against that project. Review concurrent Auth administrator edits across services.
3. Connect the supplied GitHub repository, run the prepared CI workflow and choose approved hosting, HTTPS, proxy settings, secrets and backups. The local CI file has not run on GitHub yet.
4. Confirm product rules and payment providers before implementing or enabling deposits, vouchers, withdrawals, referral rewards or robot activation. The existing balance-correction journal is not a complete payments ledger. Live trading and community reward delivery remain unavailable.
5. Define proof retention/orphan reconciliation, database backup/restore, monitoring and operator contact/legal policies before enabling real intake. Pagination/search on large admin histories and frontend bundle splitting remain follow-up work.

The current frontend build emits a bundle-size advisory. Build output is valid; performance work remains. Existing country/telephone presentation is preserved: Country has no search field, Telephone retains the previously requested calling-code search.

Use [BACKEND.md](BACKEND.md) for the backend structure, commands, endpoints and operating limits, and [LIVE_SETUP.md](LIVE_SETUP.md) when Supabase access is ready.
