# Backend development and handoff

The Express API can run locally without credentials, but protected services return 503 until Supabase is configured. Browser demos are separate from real account APIs. Payment verification, robot activation, deposits, vouchers and payouts are not enabled by this backend milestone.

## Start and verify

Use Node 24 and run commands from the workspace root:

```sh
npm install
npm run dev
npm run dev:api
```

For the compiled API, use `npm run build` followed by `npm run start:api`. The default API is `http://127.0.0.1:3001`. After changing environment variables, restart the API and restart or rebuild the frontend.

```sh
npm run check
npm run setup:check
npm run backend:check
```

`check` runs lint, both builds, embedded PostgreSQL integration tests and desktop/mobile Playwright checks. It requires no Supabase project. `setup:check` inspects environment configuration without printing credentials. `backend:check` contacts `/api/ready`; missing credentials or migrations deliberately produce a nonzero exit code. Use `API_ORIGIN` to check a hosted API instead.

## Configuration

Copy the workspace environment examples described in [LIVE_SETUP.md](LIVE_SETUP.md). Keep the server secret in `Backend/.env` or the hosting provider's server environment, never in frontend `VITE_*` values or GitHub source files. The examples contain no working credentials.

| Variable | Purpose |
| --- | --- |
| `SUPABASE_URL` | Supabase project origin; HTTPS except local development |
| `SUPABASE_ANON_KEY` | Publishable key or legacy anon JWT, used for server-verified Auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret/server key or legacy service-role JWT; never sent to the browser |
| `WEB_ORIGIN` | Exact frontend origin for CORS; HTTPS in production |
| `HOST`, `PORT` | Loopback and 3001 by default; configure the host's binding before deployment |
| `TRUST_PROXY_HOPS` | Known proxy hop count, 0 by default; set only after checking the hosting topology |
| `UPSTREAM_TIMEOUT_MS` | Per-request Supabase timeout, 10000ms by default, between 1000 and 30000 |
| `PAYMENT_PROOF_INTAKE_ENABLED` | False until the private bucket, instructions and real integration checks are complete |

Invalid key types, partial Auth credentials, malformed origins, invalid numeric limits and premature proof intake cause startup validation to fail. All Supabase clients share the same bounded HTTP transport. The frontend API transport has a 20-second request timeout and handles successful 204 responses.

## Request handling

`Backend/src/app.ts` creates the application without opening a port. Tests can inject Auth and storage clients. `index.ts` validates configuration, starts the server and handles shutdown.

Every request receives a server-generated `X-Request-ID` and `Cache-Control: no-store`. Helmet supplies security headers. The API accepts bearer tokens and verifies them with Supabase Auth on every protected request. User-editable metadata cannot grant administrative access. Suspended accounts are denied with 403; unavailable Auth returns 503 rather than being misreported as an invalid session.

The default API limit is 60 requests per minute per IP. Health/readiness probes are excluded. CORS does not replace authentication. A reverse proxy must have a reviewed hop configuration before public hosting; do not blindly trust forwarded IP headers.

## Health and readiness

| Endpoint | Access | Meaning |
| --- | --- | --- |
| `GET /api/health` | Public | The process is running; it does not prove database readiness |
| `GET /api/ready` | Public | 200 with `ready: true`, or 503 with `ready: false`; no internal details |
| `GET /api/admin/system/status` | Verified administrator | Named readiness checks and a timestamp, with no keys or internal error messages |

Readiness probes the application tables, migration 007 authorization helpers, schema revision 8 and private payment-proof bucket configuration. Results are cached for five seconds and simultaneous probes share one check. These are connectivity/schema checks, not a substitute for the live two-account and provider tests in the setup guide.

## Current API

| Area | Routes | Access |
| --- | --- | --- |
| Identity | `GET /api/me` | Active signed-in user |
| Published content | `GET /api/member-content` | Active signed-in user; published records filtered for that member's country |
| Member balances | `GET /api/member-balances?country=...&history=true` | Own wallet/history only; supplied user IDs cannot change ownership |
| Support | `GET/POST /api/support`, `GET /api/support/:id`, `POST /api/support/:id/messages` | Owner, or active administrator for staff operations |
| Support state | `PATCH /api/support/:id` | Administrator; optimistic version required |
| Payment instructions | `GET /api/robot-payments/instructions`, `GET /api/robot-payments/instructions/:country` | Active signed-in user |
| Payment submissions | `GET/POST /api/robot-payments/requests`, `GET /api/robot-payments/requests/:id/files/:fileId` | Owner; submission also requires enabled intake |
| Payment administration | `/api/robot-payments/admin/instructions/:country`, `/api/robot-payments/admin/requests` | Administrator; review can only mark under review or rejected |
| System administration | `/api/admin/users`, `/records/:collection`, `/settings`, `/audit`, `/users/:id/balances` | Administrator; validation, version checks and audit records apply |

The bulk instruction endpoint returns all supported countries after one database read. The administrator frontend uses it instead of issuing a separate HTTP request for each of 252 country options.

400 means invalid input, 401 missing/invalid authentication, 403 denied access or suspension, 404 missing records, 409 version/retry conflict, 413 an oversized body, 429 rate limiting and 503 an unavailable dependency. Unexpected failures return a generic 500. Request IDs are always in the response header and also included by the shared error handler. Malformed JSON errors never echo request bodies.

## Database rules and tests

Migration 008 makes raw payment-instruction JSON server-only: members receive enabled methods from the API, while administrators can inspect/edit drafts. Apply migrations 001 through 008 once, in order, in the intended Supabase project. Migration 007 checks current database account status and administrator roles for browser-readable proof data, rather than relying on a role captured in an older JWT. It also rejects suspended actors in payment RPCs. Existing projects should apply only their missing migrations after backup/review.

`npm run test:db` executes the complete migration chain in [PGlite](https://pglite.dev/docs/api), an embedded PostgreSQL engine. The fixture supplies minimal Auth/Storage schemas and roles, then verifies actual SQL grants, row-level policies, support ownership, stale versions, idempotent retries, country constraints and balance/clearing conservation. The test fixture does not implement Supabase Auth, PostgREST, signed URLs, Storage HTTP operations or production multi-connection concurrency. Repeat the [live RLS checks](https://supabase.com/docs/guides/database/postgres/testing-row-level-security) against your real project.

## Payment-proof failure recovery

Uploads remain private. A failed upload or a confirmed database rejection allows cleanup of the new objects. An RPC connection loss may occur after the transaction committed: the API first looks up the saved request and returns it if confirmed. If its outcome remains unknown, it preserves the objects and returns 503 instructing the member to inspect history. It never deletes a potentially referenced screenshot merely because a response was lost.

Unreferenced objects after an uncertain outcome or failed cleanup need operator reconciliation against `robot_payment_proofs`. Automatic orphan deletion, a retention schedule and provider reconciliation remain pending. Do not enable live intake before those operating procedures are established.

## GitHub and remaining live work

`.github/workflows/ci.yml` is prepared locally for Node 24, lint, builds, SQL tests and Playwright on Linux. It has not been pushed or run in GitHub. No Git repository or remote was available during this milestone.

When access is supplied, the next work is to configure the actual project, apply migrations, provision the first administrator through trusted administration and test registration, email confirmation, recovery, cross-account access, support persistence, private proof access and balance retries. Auth user edits span Auth and Postgres: their version check is best effort, not an atomic cross-service transaction; concurrent administrator role changes require further integration review. Financial providers, verified payment events, a financial transaction ledger and payouts still need approved product rules and sandbox integrations.
