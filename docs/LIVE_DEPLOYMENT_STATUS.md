# Live deployment status — 11 November 2026

Production: https://lipahub-nine.vercel.app

Vercel project: `samlite250s-projects/lipahub`. Frontend and API deploy together from the repository root. The original live deployment was made directly from this checkout. GitHub synchronization and a fresh production deployment were requested on 11 November 2026.

Planned custom domain: `lipahub1.com`, with `www.lipahub1.com` for the website. The owner will purchase it later; ownership, DNS and hosting are not configured. The existing Vercel URL remains the active site. See [production email setup](PRODUCTION_EMAIL.md) for the proposed sending subdomain.

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

## Administrator

`lipahubsupport@gmail.com` has the trusted `app_metadata.role = admin`. Supabase accepted an invitation email pointing to the live password-setup page. The owner must open that email to set their password; inbox delivery and the owner's password setup have not been verified. Administrator console: https://lipahub-nine.vercel.app/admin.

The support address was saved using the audited settings operation. Auth Site URL and exact dashboard/reset-password redirects use the production URL. Minimum password length is 12, with email confirmation enabled.

## Client-launch blockers

Custom SMTP is not configured. The built-in Supabase sender is for testing and restricts recipients to project-team addresses; ordinary client confirmation and recovery delivery require a production email provider. See https://supabase.com/docs/guides/auth/auth-smtp. Keep credentials out of chat and source control; configure them privately in Supabase Auth.

The terms and privacy pages remain explicitly marked as development notices. Final operator details, applicable jurisdiction, retention/deletion rules and operational policies need completion before onboarding clients.

Deposits, withdrawals, vouchers, referral rewards, paid robot activation, real trading and community rewards are not implemented services. Deploying does not enable them. Payment proof intake remains disabled. Provider accounts and product rules are required before implementing and verifying those services.

The public site is available for review. Database readiness does not establish full business or client-launch readiness.
