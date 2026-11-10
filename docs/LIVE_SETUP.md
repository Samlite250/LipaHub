# New LipaHub project setup

The app uses a React frontend, a separate Express API and a Supabase project. Nothing in this checkout creates a hosted project automatically. The current milestone adds private support tickets, staff replies, open/closed statuses, an audit trail and member balance history. Existing account, content, balance administration and proof intake use the same project.

## 1. Create and configure the project

For a new empty project, the same ordered setup is available in `Backend/setup/new-project.sql`. Existing projects must apply only missing migrations.

Create a Supabase project in your account. Keep the database password and server secret private. In its SQL editor, apply these files **once, in order**:

1. `Backend/migrations/001_robot_payment_proofs.sql`
2. `Backend/migrations/002_system_administration.sql`
3. `Backend/migrations/003_account_balances.sql`
4. `Backend/migrations/004_member_support.sql`
5. `Backend/migrations/005_supported_countries.sql`
6. `Backend/migrations/006_worldwide_countries.sql`
7. `Backend/migrations/007_fresh_payment_authorization.sql`
8. `Backend/migrations/008_private_payment_instruction_drafts.sql`

The migrations are transactional. If a migration fails, resolve the error before running the next. Do not reapply earlier migrations to an existing project blindly: several create policies without an existence guard.

## 2. Configure the two services

Copy `frontend/.env.example` to `frontend/.env` and `Backend/.env.example` to `Backend/.env`.

Frontend:

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
VITE_API_URL=http://127.0.0.1:3001
VITE_ENABLE_DEMO=false
```

Backend:

```dotenv
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVER_SECRET_OR_SERVICE_ROLE_KEY
WEB_ORIGIN=http://127.0.0.1:5173
HOST=127.0.0.1
PORT=3001
PAYMENT_PROOF_INTAKE_ENABLED=false
```

The Supabase URLs must identify the same project. A Supabase publishable key can be used in the existing `ANON_KEY` variables. Secret/service-role keys belong only on the backend. Never put them in `VITE_*` variables, source files or chat. The environment files are ignored by source control.

Run `npm run setup:check`. It checks configuration without printing key values or contacting the project. A passing check does **not** verify database migrations or live functionality. Restart local servers and rebuild the frontend after changing configuration.

## 3. Enable real accounts and administration

In Supabase Auth, enable email/password, require email confirmation and set the website URL and allowed redirects for `/dashboard` and `/reset-password`. Configure production email delivery and a password policy. Register and confirm your own account. Use trusted Supabase administration to set that user's **app metadata** to include `"role": "admin"`, preserving other app metadata. User metadata cannot grant administrator access. Sign out and back in after assigning the role.

Start `npm run dev` and `npm run dev:api` in separate terminals. Sign in to `/admin` and publish resources, announcements and support contact details. New real account balances start at zero. Audited balance corrections appear at `/dashboard/transactions`; staff-only adjustment reasons and actor IDs are excluded from the member API.

## 4. Verify with two separate member accounts

Create a support request at `/dashboard/support`. Reload and sign in from another browser: the request must persist. Reply at `/admin/support`, then refresh the member's conversation. Close and reopen the request. Check `/admin/audit` for staff replies and status changes. A second member must not see the first member's tickets or fetch their conversation by ID. Suspended accounts must be denied. Try stale updates and retries: they must not duplicate messages or overwrite a newer status.

Apply a controlled balance correction to one member and check their history. The second member must never see it, even if their request supplies the first member's user ID. Check database grants/RLS directly: browser anon/authenticated roles must not read or write support tables. Only the API uses server-only RPCs. Automated API tests use a substitute service. Embedded PostgreSQL tests execute the SQL transactions and policies locally; repeat the checks against your real project because the fixture does not implement Supabase services.

## 5. Host the platform

For the current Vercel deployment, follow [VERCEL_DEPLOYMENT.md](VERCEL_DEPLOYMENT.md) and select the repository root (`.`). That configuration hosts frontend and API together. The following separate-service configuration remains an alternative.

Build with `npm run build`. Host `frontend/dist` with SPA routing (the supplied Vercel config supports this). Host `Backend/dist` as a separate Node service using `npm run start:api` from the workspace root, or `npm start` from `Backend`. Set `HOST=0.0.0.0` where the host requires it, set its supplied `PORT`, and configure HTTPS. Set `WEB_ORIGIN` to the exact frontend origin and rebuild the frontend with `VITE_API_URL` pointing to the API's HTTPS origin. Update Auth redirects to the hosted URLs. Demo entry points and restored demo sessions are disabled by default in production builds; keep `VITE_ENABLE_DEMO=false` explicitly.

## Remaining launch work

Payment proof intake stays disabled until private storage and actual recipient instructions have been verified. Proof review still cannot confirm payments or activate a plan. Withdrawals, provider-backed deposits, vouchers, referral rewards, automatic robot activation, live trading and community delivery are not implemented by this milestone. The trading page remains an educational simulation. Business rules and providers are needed to implement these services correctly. Final operator contact, terms, privacy and retention policies also need completion before public launch.

## Supported country expansion

Apply `Backend/migrations/005_supported_countries.sql` after migrations 001?004, including for existing projects. It expands payment instructions, content audiences and balance countries to the 16 listed African countries plus International. Registration, profile and administration use these named countries; they are no longer normalized to International. Existing local-currency pricing is retained; newly added markets retain the previous USD pricing fallback until local pricing is configured. This update does not enable payment providers. Calling codes follow the [ITU national numbering plans](https://www.itu.int/oth/t0202/en).

The Country menus now use the full worldwide country and territory catalogue in `shared/countries.json`, including countries without an individual telephone calling code. Apply migration 006 after 005 to preserve these names in live content and account administration. Existing local-currency markets retain their pricing; other countries use the existing USD fallback. The telephone prefix can be changed independently of Account Country. No new payment provider integrations are enabled by adding countries.

## Backend readiness milestone

Read [BACKEND.md](BACKEND.md) for server configuration, request handling and failure recovery. Run `npm run backend:check` against a running API after setup. `/api/health` is only liveness; `/api/ready` must return 200 before routing real account traffic. Authorized administrators can inspect `/api/admin/system/status` for named readiness checks. Migration 007 replaces stale-JWT proof access checks with current database account status. Keep `PAYMENT_PROOF_INTAKE_ENABLED=false` until live verification and proof reconciliation procedures are complete.
