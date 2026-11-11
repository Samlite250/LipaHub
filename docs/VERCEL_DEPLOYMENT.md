# Vercel deployment for LipaHub

Target repository: https://github.com/Samlite250/LipaHub

Supabase project: https://pzxmfdqfsoltoqgflxcm.supabase.co

The root `vercel.json` deploys the React build and Express API as one project. The API exports an application from `api/index.mjs`; it does not open a persistent server port. `/api/*` routes to that function before the SPA fallback. Production frontend requests use the same origin when `VITE_API_URL` is empty. Local development continues to use port 3001.

## 1. Connect the accounts and publish source

The project and repository URLs identify destinations; they do not grant account access. Authorize the Vercel, GitHub and Supabase connections, or authenticate the respective CLIs on your machine. Never paste a database password or server secret into chat or commit it to GitHub.

Import `Samlite250/LipaHub` into Vercel after the application source has been pushed. Alternatively, an authenticated Vercel CLI can deploy directly from `D:\Dev\LipaHub` with `npx vercel --prod`, without GitHub.

## 2. Project build settings

| Setting | Value |
| --- | --- |
| Root Directory | Repository root, `.`; do not select `frontend` |
| Framework preset | Other; root configuration sets `framework: null` |
| Node version | 24.x |
| Install command | `npm ci` |
| Build command | `npm run build` |
| Output directory | `frontend/dist` |

The root configuration includes the backend output and shared JSON in the function bundle. The old `frontend/vercel.json` is for a frontend-only project and is not the configuration for this combined deployment.

## 3. Environment variables

The repository already knows the project URL through `shared/deployment.json`. The frontend and API share the same validated public key. Only two private environment entries are required in Vercel, unless an authorized connection configures them for you:

| Variable | Value |
| --- | --- |
| `SUPABASE_ANON_KEY` | The Supabase publishable/anon key; also accepts `SUPABASE_PUBLISHABLE_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | The Supabase secret/service-role key; server-only |

No duplicate `VITE_*` keys, API URL, build commands or output settings need to be entered. Production demo access and payment proof intake default to disabled. Existing explicit `VITE_SUPABASE_*` values remain supported. A secret placed in a public-key setting causes the build to fail rather than exposing it.

Private server secrets cannot be stored in GitHub. An authenticated Vercel connection is needed if the assistant is to configure those entries on your behalf. Merely importing the source cannot obtain missing account credentials.

The function derives its HTTPS website origin from Vercel system variables when `WEB_ORIGIN` is unset. An explicit `WEB_ORIGIN` can override it. Preview deployments use their own URL. The Vercel entry defaults the trusted proxy hop count to 1; local servers remain at 0. Review proxy settings again if another CDN/proxy is later introduced.

Keep private keys in the server environment only. Rebuild/redeploy after changing frontend variables. Use separate preview database credentials if preview environments should not modify production data.

## 4. Supabase setup

For a new empty database, run `Backend/setup/new-project.sql` once, or authorize Supabase so the assistant can apply it. That file contains migrations 001 through 008 in order. Existing databases must apply only their missing migrations; see [LIVE_SETUP.md](LIVE_SETUP.md). Configure email/password Auth, an 8-character minimum password, disabled email confirmation, recovery email delivery and the first trusted administrator.

After Vercel returns the production `https://...vercel.app` URL, set that as the Supabase Auth Site URL and allow these redirects:

```text
https://YOUR-PROJECT.vercel.app/dashboard
https://YOUR-PROJECT.vercel.app/reset-password
```

Use exact deployed URLs. Preview URLs require separate Auth redirect configuration if used for real-account testing.

## 5. Verify the deployment

1. `/api/health` must return JSON with HTTP 200. A page of HTML here means API routing is wrong.
2. `/api/ready` must return 200 with `ready: true`. Until credentials, migrations and the private bucket are ready, it deliberately returns 503. Authorized administrators can inspect `/api/admin/system/status`.
3. Open `/dashboard/profile` directly and verify SPA routing. Register and verify immediate dashboard access, then sign in again and test password recovery.
4. Check admin permissions and support persistence with two separate member accounts. Verify cross-account access is denied and suspended accounts cannot read private data.
5. Verify balance history, content, announcements and settings against the real project. Review private proof intake separately before enabling it.

## Upload compatibility

[Vercel Functions limit request payloads to 4.5 MB](https://vercel.com/docs/errors/function_payload_too_large). Proof uploads use base64 JSON, which increases their payload size. The application now accepts 1–3 screenshots with a combined binary size of at most 3 MiB, keeping accepted request bodies below that platform limit. The form and both validators use the same limit. The existing private bucket's 5 MiB ceiling remains an upper storage bound. For larger uploads, implement signed direct-to-Supabase uploads rather than increasing Express's parser limit.

Rate limiting in the API uses an instance-local memory store. Vercel can run multiple function instances, so it is not a global financial abuse-control system. Establish shared limits and the remaining financial controls before enabling real payment intake.

## Functionality and the custom domain

Connecting Supabase enables the implemented real-account, administration, content, support and account-history services after live verification. Hosting does not implement provider deposits, withdrawals, vouchers, referral rewards, robot activation or live trading; those workflows still need product rules and integrations. Do not present them as completed services.

After the `vercel.app` deployment is verified, add the custom domain in Vercel and configure the DNS records Vercel supplies. Update Supabase Site URL/redirects and any explicit `WEB_ORIGIN` to the new domain, then redeploy if environment values changed. The same-origin API transport needs no separate API-domain change.

Sources: [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [rewrites](https://vercel.com/docs/routing/rewrites), [system environment variables](https://vercel.com/docs/environment-variables/system-environment-variables).
