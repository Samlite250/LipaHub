# Account balances and administrative corrections

Open `/admin/users`, choose **Balances** on a user, and select the wallet country. The editor shows available funds, the separate bonus balance and the latest 100 corrections. Enter the new totals and a reason of 10–500 characters, review the before/after amounts, then confirm. Both credits and reductions are supported; totals cannot be negative.

The administrative console is grouped into Overview, Payments, Withdrawals, Members, Support, Content, Audit log and Settings. Payment instructions and proof submissions are sub-tabs of Payments; resources and announcements are sub-tabs of Content. The former submission Activity page is redundant with the proof queue; its legacy query selects proof submissions. Withdrawals is a live-only review queue and stays hidden behind an access notice in the browser demo.

## Member display

Available funds and bonuses on the Rwanda and robot dashboards read the saved account wallet. Historical illustrative statistics such as referrals, expenses and withdrawn amounts are not rewritten by a balance correction. Changing a member's country selects a separate wallet and does not convert or transfer funds.

| Country | Currency | Fractional digits |
| --- | --- | --- |
| Rwanda | RWF / RF | 0 |
| Burundi | BIF / Fbu | 0 |
| Uganda | UGX | 0 |
| Kenya | KES | 2 |
| South Africa | ZAR | 2 |
| International | USD | 2 |

The API chooses the currency from the country. Amounts are entered without grouping commas, parsed as exact integer minor units and capped at 1,000,000,000,000 minor units per bucket. Exponents, negatives, extra fractional digits and non-finite values are rejected. A reduction is a new correction, not an edit to an old history entry.

The member dashboard refreshes balances when opened, focused, made visible and every 30 seconds while visible. Demo corrections also broadcast a local update. Failed live reads show an unavailable state rather than using a browser-local or fabricated balance.

## Persistence and ledger

Apply `Backend/migrations/003_account_balances.sql` after migration 002. Configure the server's Supabase credentials as described in SYSTEM_ADMIN.md. The migration has not been applied here; live PostgreSQL RPC and Auth integration still require testing in the intended project.

Live wallets start at zero. An adjustment RPC locks the currency clearing account and the user's wallet, checks the expected version, then commits the new balances, the correction receipt, the opposite clearing-account entry and an admin audit event in one transaction. The receipt enforces:

`available change + bonus change + clearing change = 0`

Each correction has a unique request ID. A matching retry returns the current wallet without applying the correction again. Reusing the ID with different details or submitting a stale version is rejected. RPC access is restricted to the server service role, and the function rechecks the trusted admin role and suspension state. Ordinary clients cannot modify wallet tables. The service role has read-only table grants for wallets/history; writes go through the RPC.

The admin API verifies roles with Supabase Auth. Member reads always use the verified user's ID; a submitted identity or balance in editable profile metadata is ignored. Accounts with balance history cannot be deleted because ledger foreign keys preserve that history; suspend them instead. No endpoint deletes or rewrites adjustment receipts.

These are administrative account corrections. They do not verify a payment provider event, mark a payment proof as paid, activate a robot or initiate a withdrawal.

## Demo behavior

The demo uses IndexedDB database `lipahub-balance-preview`, independently of live storage. Until an admin correction exists, its baseline matches the existing Rwanda sample or robot demo arithmetic. After a correction, that saved wallet becomes the displayed account total. Resetting legacy robot demo activations does not erase an admin correction. Demo passwords, authentication roles and API access are unaffected.

IndexedDB commits the wallet and its correction receipt together. Concurrent stale writes and repeated request IDs are checked in the transaction. Correction entries are also shown in the demo Audit log. Demo user deletion is refused when adjustment history exists. Demo account figures remain browser-local test data.

## Endpoints and verification

- `GET /api/admin/users/:id/balances?country=Rwanda`: wallet and latest 100 corrections, admin-only.
- `POST /api/admin/users/:id/balances`: reviewed correction with `country`, decimal-string `available`/`bonus`, `reason`, expected `version` and UUID `requestId`.
- `GET /api/member-balances?country=Rwanda`: only the authenticated member's wallet.

`tests/balances.spec.ts` covers editor confirmation, persistence, member display, currency separation, reductions, zero totals, duplicate requests, concurrent stale writes and navigation through all seven tabs. `tests/balance-api.spec.ts` exercises the Express routes with injected Auth/storage services to check authorization, identity isolation, argument validation and conflict mapping. These tests do not substitute for applying and integration-testing the SQL migration against Supabase.
