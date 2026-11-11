# Live deployment status — 11 November 2026

Production: https://lipahub-nine.vercel.app

Vercel project: `samlite250s-projects/lipahub`. Frontend and API deploy together from the repository root. The original live deployment was made directly from this checkout. GitHub synchronization and a fresh production deployment were requested on 11 November 2026.

Planned custom domain: `lipahub1.com`, with `www.lipahub1.com` for the website. The owner will purchase it later; ownership, DNS and hosting are not configured. The existing Vercel URL remains the active site. See [production email setup](PRODUCTION_EMAIL.md) for the proposed sending subdomain.

## GitHub and Vercel refresh

On 11 November 2026, source commit `f42ae5b43a6a8ac71cdd69f03cfe5716840e209b` was pushed to `Samlite250/LipaHub` on `main` and deployed to the existing production project. Vercel deployment `dpl_6PkGMis4FQLbAaj8DAwBbvHnzroL` reached `READY` and was aliased to https://lipahub-nine.vercel.app. Subsequent documentation-only commits may follow this deployed source commit.

Fresh public checks returned 200 for home, registration, login, admin and member-support route shells. `/api/health` confirmed authentication configuration and disabled payment services; `/api/ready` returned 200 with `ready: true`.

Local lint, build and all 12 database/deployment checks passed. The browser suite completed with 120 passed, one intentionally skipped and one desktop payment-demo timeout. That timed-out test passed when rerun alone with its original timeout. No production email, custom-domain or payment-provider setup was performed in this refresh.

Supabase project: `pzxmfdqfsoltoqgflxcm`. All 12 public application tables have RLS enabled. Schema revision 8 and the private `robot-payment-proofs` bucket passed the live API readiness check. Production credentials are stored privately in Vercel, with demo access and payment proof intake explicitly disabled.

## Verified

- Public home, registration, login, forgotten-password, admin and member deep links load at desktop and 390px mobile widths without horizontal overflow or JavaScript page errors.
- `/api/health` returns 200 JSON with authentication configured. `/api/ready` returns 200 with `ready: true`.
- Temporary live accounts successfully signed in; anonymous access and member attempts to access administrator APIs were denied. User-editable role metadata did not grant administration.
- Member balances started at zero and stayed scoped to the signed-in member even when another user ID was supplied. Direct browser access to support tables was denied.
- A temporary support ticket persisted, accepted a staff reply, closed correctly and remained inaccessible to a second member.
- Mobile Chrome completed a real sign-in and displayed the saved support conversation. Suspending that member revoked API access.
- Temporary support messages, ticket and all three test accounts were removed. Audit records are retained.
- The local build and all 12 database/deployment tests passed before deployment. Vercel successfully built the final onboarding text changes.

## Immediate registration update

Source commit `17e38be19e14e211e94fcbf1619f13c8411fb9de` is on GitHub and deployed as `dpl_B41XmhLMsjyNLN8kPysp4uLd2zsx`, aliased to the production URL. Live Supabase Auth and registration, reset and admin forms use an 8-character minimum. Email confirmation is disabled.

Live mobile-browser verification registered a temporary member with an 8-character password, reached the dashboard immediately, accessed the authenticated API and signed in again without email confirmation. A 7-character password was rejected, and an authenticated password change accepted 8 characters. The temporary account was deleted. Lint, build and all 8 focused desktop/mobile authentication and admin checks passed. Public route checks and API readiness also passed.

## Invited registration update

Source commit `079fc71` was pushed and deployed as `dpl_35VqLysYFFNuf3WmQqEjPMsTqduA` on 11 November 2026. The invited form now matches the supplied name-banner reference. A live check verified the owner's public inviter lookup, home-to-registration persistence, English/Kinyarwanda, reloads and mobile layout. An intercepted signup request contained both invitation metadata fields; no test account was created or email sent. Lint, build and all 12 focused browser/API checks passed. See [invitation behavior and limits](INVITATIONS.md); this preserves signup context without enabling a referral ledger or rewards.

## Administrator

Sign-in now routes accounts with trusted `app_metadata.role = admin` to `/admin`; members go to `/dashboard` or their requested member page. Visiting `/login` with an existing administrator session also opens `/admin`. Password reset uses the same role-based destination. User-editable metadata never determines this redirect. Lint, build and 10 focused desktop/mobile authentication and routing checks passed for this change.

The existing invited owner account needed a one-time confirmation after email confirmation was disabled for new registrations. With explicit owner approval, `lipahubsupport@gmail.com` was confirmed through Supabase Auth administration on 11 November 2026, preserving its password and trusted admin role. Public password sign-in then succeeded and `/api/admin/system/status` returned 200. Current HTML and its referenced CSS/JavaScript returned 200; older asset filenames from previous deployments returned 404, so previously open tabs should be refreshed. The telephone input no longer supplies the unsupported `inputProps.type` override.

`lipahubsupport@gmail.com` has the trusted `app_metadata.role = admin`. Supabase accepted an invitation email pointing to the live password-setup page. The owner must open that email to set their password; inbox delivery and the owner's password setup have not been verified. Administrator console: https://lipahub-nine.vercel.app/admin.

The support address was saved using the audited settings operation. Auth Site URL and exact dashboard/reset-password redirects use the production URL. At the owner's request, the live minimum password length was reduced to 8 and email confirmation was disabled on 11 November 2026. New registrations receive a session immediately and can access the dashboard.

## Client-launch blockers

Custom SMTP is not configured. The built-in Supabase sender is for testing and restricts recipients to project-team addresses; ordinary client recovery and invitation delivery require a production email provider. Registration no longer requires confirmation email. See https://supabase.com/docs/guides/auth/auth-smtp. Keep credentials out of chat and source control; configure them privately in Supabase Auth.

The terms and privacy pages remain explicitly marked as development notices. Final operator details, applicable jurisdiction, retention/deletion rules and operational policies need completion before onboarding clients.

Deposits, withdrawals, vouchers, referral rewards, paid robot activation, real trading and community rewards are not implemented services. Deploying does not enable them. Payment proof intake remains disabled. Provider accounts and product rules are required before implementing and verifying those services.

The public site is available for review. Database readiness does not establish full business or client-launch readiness.
