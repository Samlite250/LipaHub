# System administration

The admin console at `/admin` uses the same mint background, light blue header, teal controls and blue/purple/pink gradients as the member dashboard. Existing payment settings and evidence review are retained.

## Areas

| Route | Operations |
| --- | --- |
| `/admin/users` | Create, list, inspect, edit and delete accounts; edit profiles, access and country wallet balances with audited corrections |
| `/admin/resources` | Full CRUD for courses, articles and ebooks; draft/published states, HTTPS resource links and country audience |
| `/admin/announcements` | Full CRUD for member notices with draft/published states and country audience |
| `/admin/settings` | Read/update the member site name, support email/message and announcement visibility |
| `/admin/audit` | Read the latest 200 user/content/settings operation records |
| `/admin/payments` | Existing country payment instructions and proof reviews |

Users have pages of 50. User search and filters apply to the currently loaded page, as labelled. Live content lists return the latest 500 records. Available and bonus balances have a dedicated, audited adjustment editor in Users. Payment provider verification, withdrawals and robot activation remain separate operations. See ACCOUNT_BALANCES.md for currency, concurrency, retry and ledger behavior.

Published resources appear on `/dashboard/courses`, `/dashboard/articles` and `/dashboard/ebooks`. Notices appear on the dashboard and `/dashboard/announcements`, subject to the visibility setting. Support settings appear on `/dashboard/support`, and the site name appears in the member footer. Country audiences control presentation and are not a privacy or financial authorization boundary.

## Demo

Select **Open admin demo**. Demo records live in a separate browser IndexedDB database, `lipahub-system-preview`. The existing demo profile is added to its user directory with an `example.invalid` email; other users appear only when created. Demo CRUD does not create authentication accounts, send email or grant server permissions. Passwords are not stored in the demo database. Deletion requires the exact email or content title. Demo user changes update the currently open demo profile when its record is edited.

Demo user, resource, announcement and settings changes persist until browser site data is cleared. Sign-out does not clear stored demo records. The admin demo must be opened again after a full page reload.

## Live setup

1. Configure `SUPABASE_URL`, `SUPABASE_ANON_KEY` and the server-only `SUPABASE_SERVICE_ROLE_KEY` in `Backend/.env`. Never expose the service key in browser variables.
2. Apply `Backend/migrations/002_system_administration.sql` and `003_account_balances.sql` to the intended Supabase project. Keep migration 001 for the payment tools.
3. Assign the first administrator with trusted Supabase administration: `app_metadata.role = 'admin'`. User-editable metadata never grants permissions.
4. Configure frontend Supabase credentials and `VITE_API_URL` for the API. Verify live operations with controlled test accounts before production use.

The database migration has been supplied, not applied in this checkout. No project credentials are available here. Live Supabase Auth, database RPCs and email confirmation still need integration verification in the target project.

## Authorization and account changes

Every `/api/admin` request verifies its bearer token with Supabase Auth and reads the trusted current role and suspension state. CRUD uses the server-only admin client. Private tables and RPCs are denied to anonymous and ordinary authenticated database clients. Member content is returned through a separate authenticated endpoint that selects published content only. Suspended accounts are rejected by the admin, payment, member-content and `/api/me` routes.

Administrators cannot delete themselves, remove their own administrator role or suspend their own account. Creating an administrator or changing another user's role is supported only through the authorized API. User output is whitelisted and omits raw metadata and credentials. The phone field changes display metadata, not a verified phone identity.

Live account creation requires an 8–128-character initial password and does not send an email. Email confirmation is disabled in the target project, so the user can sign in immediately. The admin API still ignores client-supplied verification flags. Passwords are never returned or written to audit records. Email changes are handled by Supabase's configured identity policy. Deleting accounts referenced by payment records may fail; use suspension to preserve their history. Deletion does not erase unrelated historical audit entries.

## Concurrency and audit

Content and settings use version checks and transactional SQL RPCs. A stale edit or deletion returns 409. User updates check the latest Auth `updated_at` before writing; Supabase Auth does not offer an atomic conditional update, so concurrent user edits still need coordination.

Content/settings mutations and their audit entries commit together. Auth operations span two services: the API first persists a `started` audit entry, then performs the Auth operation and attempts to finalize its outcome. A `started` entry means the result was not finalized in the log; inspect the current account before retrying. Audit entries contain action, target, actor, outcome and timestamp, without passwords or full profile snapshots.

## Verification

`npm run build` validates frontend and backend TypeScript and builds both workspaces. `tests/admin-system.spec.ts` checks user/content CRUD, duplicate emails, delete confirmations, persistence, audiences and member settings on desktop/mobile. `tests/admin-api.spec.ts` exercises the actual Express admin router with an injected Auth/storage service for authorization, sanitization, CRUD and self-protection; it does not claim to verify a live Supabase project or apply SQL migrations.
