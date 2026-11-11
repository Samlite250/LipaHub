# LipaHub

Live review site: **https://lipahub-nine.vercel.app**. See [the verified deployment status and remaining client-launch blockers](docs/LIVE_DEPLOYMENT_STATUS.md) for the current cloud state; older local milestones below describe the earlier setup.

The earlier local audit and backend milestone is documented in [SYSTEM_AUDIT.md](docs/SYSTEM_AUDIT.md). See [BACKEND.md](docs/BACKEND.md) for the API and readiness checks, and [LIVE_DEPLOYMENT_STATUS.md](docs/LIVE_DEPLOYMENT_STATUS.md) for completed live integration checks and remaining launch work. `npm run check` runs the complete local quality checks.

## Moving to real accounts

For a new Supabase project, follow [the live setup guide](docs/LIVE_SETUP.md) and run `npm run setup:check` after configuring the two workspace environment files. Production builds disable browser demo access by default. Real sign-in, administration, published content, private payment proofs and balances require the configured Supabase project.

Members can now submit private support requests at `/dashboard/support`; authorized staff reply, close and reopen them at `/admin/support`. Requests and replies persist in Supabase after applying migration `004_member_support.sql`. `/dashboard/transactions` displays the member's saved balance correction history. These features have no live-to-demo fallback. Cloud setup and live database checks are still required; this checkout is not yet a publicly launched financial platform. See the guide for remaining payment and trading limitations.

## Member tabs from the supplied screenshots

Rwanda uses the complete reference sidebar in four groups: Main, Accounts, Products and Settings. It includes the separate Whatsapp and Whatsapp Earn entries, Accounts/Reversals, Aviator, Spin & Win, Fixed Bets, Soccer, FREE SHOP, Meta ADS, Reels, Ads Earnings, Tiktok Earn, Youtube Earn and Survey Challenge, in the supplied order. Contact US opens the existing support page. Other countries retain their existing menu and robotic plan catalogue. Existing direct URLs remain accessible. Added navigation entries open explicit pending-service pages where the service has not been implemented; no reference affiliate destinations or APK downloads are activated.

The Deposit, Voucher, Withdraw, Team, Teach Kinyarwanda and Chat with Foreigners screens now have dedicated layouts. Voucher has Buy Voucher/History navigation; Withdraw has main, Youtube, Trivia, Games, Tiktok, Socials, Chat and History routes; Team has three levels and active/inactive filters. The sidebar expands these sections and supports direct links to their child screens.

Deposit displays MTN/Airtel choices for Rwanda. Voucher shows the saved main account balance, PIN information and an unavailable activation balance until that service exists. Provider instructions, PIN setup, voucher purchases, payouts and referral records remain unavailable; these screens never invent a successful transaction or debit funds. The RF 6,350 voucher price and RF 260 activity reward in the references are explicitly unconfirmed for LipaHub. Kinyarwanda writing practice is a local exercise with no live student or earnings. Foreign conversation matching lets members choose their preference and explains that matching is not enabled. All these screens support light/dark themes and mobile layouts.

Phase 1 implementation of the supplied master prompt. React, Vite, TypeScript, Tailwind, React Router and a separate Express TypeScript API. The supplied third-party HTML is reference material only; none of its scripts, artwork or personal records are served by the application.

## Folder layout

```text
LipaHub/
  frontend/             React application workspace
    src/                Pages, components, state and styles
    public/             Original logo and public assets
    .env.example        Frontend environment template
    vite.config.ts      Frontend development/build configuration
    vercel.json         Frontend hosting routes
    dist/               Generated frontend build
  Backend/              Express API workspace
    src/index.ts        API entry point
    migrations/         Supabase private proof tables, RLS and storage policies
    scripts/            Backend packaging helpers
    .env.example        Server environment template
    dist/               Generated API build
  shared/               Public plan endpoints and reference FX data (no secrets)
  tests/                Shared browser and API integration checks
  docs/                 Reference audit, roadmap and validation
  artifacts/            Local review screenshots
  Materials-References/ Original supplied reference package (not published)
  package.json          Shared workspace commands and development tools
```

Install dependencies once from the repository root. Both workspaces share the root lockfile. Root `npm run dev` starts the frontend, and `npm run dev:api` starts the backend. You can also run `npm run dev` directly inside either folder. `npm run build` checks the whole project and builds both workspaces; `npm run start:api` runs the compiled API afterward.

The dashboard's header settings icon opens an account dropdown with **Profile**, **Deposit**, **Games**, **Settings** and **Log Out**. Settings opens the appearance/language dialog. The `25` Deposit badge is an illustrative demo indicator; payment and game services retain their planned status.

## Country-specific robotic plans

Select Burundi, Uganda, Kenya, South Africa or International in Registration before **Explore the demo**, or change the demo's country in Profile. Everyone outside Rwanda sees **33 robotic plans** on the dashboard and at `/dashboard/robots`. Rwanda keeps its original dashboard.

Burundi plans span **60,000–1,000,000 Fbu**, with one-time demo bonuses spanning **261,000–8,000,000 Fbu**. All 33 tiers interpolate between the owner-supplied endpoints. Uganda uses UGX, Kenya KES, South Africa ZAR and International USD, converted using the checked-in reference rates dated 9 November 2026. See [all plan values and conversion rules](docs/ROBOT_PLANS.md).

Demo activation deducts virtual funding and records the bonus once in a separate demo ledger. It survives reloads, rejects repeated activation and keeps each country's wallet separate. Search, available/active filters and demo reset are included. No funds, real trades or withdrawable rewards are created; live activation is disabled.

The robot dashboard uses four primary gradient cards styled like the Rwanda dashboard: **Active Plans**, **Received Bonuses**, **Total Activated Value** and **Available Funds**. Totals use the country's currency and update from the demo activation state. **View active plans** filters the catalogue to activated robots.

## Run locally

Requires Node 24. On Windows use `npm.cmd` if PowerShell blocks `npm.ps1`.

```sh
npm install
npm run dev
```

Open **http://127.0.0.1:5173**. Select **Explore the demo** on the sign-in page. The demo does not require credentials and is visibly distinct from a real account. Its profile lasts for the browser tab session; chat messages last only while that page is mounted. It never credits real balances, submits payments or delivers messages to people.

Run the optional API in a second terminal:

```sh
npm run dev:api
```

API: `http://127.0.0.1:3001/api/health`. `GET /api/me` requires a Supabase access token verified with Supabase Auth. Payment instruction and proof-review endpoints live under `/api/robot-payments`; they require server-verified authentication and admin roles where appropriate. They cannot confirm a payment, activate a robot or credit a balance.

## Admin dashboard

Open **http://127.0.0.1:5173/admin** and select **Open admin demo**, or sign in with an authorized administrator account. The admin console matches the member dashboard colors and has user CRUD, resource and announcement CRUD, general settings, an audit log, payment review tools and a responsive navigation shell. Counts reflect saved submissions and published instructions; no illustrative revenue or member totals are presented.

Country cards open their payment settings. The proof queue supports name, phone, request ID, reference and plan searches plus country/status filters. Reviewing a recent submission opens that request in the queue. Activity shows submission dates and current review notes, rather than a historical event audit. `/admin/payments` still opens payment configuration directly. Live API authorization and the existing proof-review boundaries remain in place.
User management includes names, emails, display phone numbers, countries, roles, suspension and audited available/bonus balance corrections, with confirmed deletion and self-access protection. Published content and support settings feed the member pages. Live system administration requires `Backend/migrations/002_system_administration.sql` and `003_account_balances.sql` and the server-only Supabase service credential. See [system admin setup, security and verification limits](docs/SYSTEM_ADMIN.md).

The seven primary admin tabs are Overview, Users, Payments, Resources, Announcements, System settings and Audit log. **Balances** in each user row opens country-specific available/bonus funds, mandatory reasons, confirmation and adjustment history. Saved corrections appear on the member dashboard. See [account balance setup and ledger behavior](docs/ACCOUNT_BALANCES.md).

## Payment instructions and proof submission

Open **http://127.0.0.1:5173/admin/payments** and click **Open admin demo**. For Burundi, enter and publish **Lumicash** and/or **Code** details, then save. Rwanda has an editable manual-instructions option. Uganda, Kenya, South Africa and International have **Binance TRC** options; publishing requires the recipient address, crypto asset, network and instructions. No recipient or token is invented.

Return to the member dashboard (select Burundi or another non-Rwandan country). Click **Activate robot**, read the published instructions, continue to the proof form and provide **full names**, **phone number including country code**, and **1?3 PNG/JPEG screenshots**. Transaction reference is optional. Use test information in the demo. A request becomes **pending review**, persists across reloads and can be viewed in the admin proof queue. Admins can inspect screenshots, record an under-review state or reject with a reason. Proof never confirms a payment or grants a bonus by itself.

Demo settings and proof images persist in this browser's IndexedDB until the site data is cleared; signing out does not erase those demo submissions. A new demo profile has a separate member ID. The admin preview deliberately sees local test submissions but grants no backend privileges.

For actual private storage, apply `Backend/migrations/001_robot_payment_proofs.sql` to the intended Supabase project and configure `SUPABASE_SERVICE_ROLE_KEY` **only in `Backend/.env`**, alongside the existing URL/auth keys. Assign live administrators through trusted auth administration with `app_metadata.role = 'admin'`; user metadata never grants this role. Keep `PAYMENT_PROOF_INTAKE_ENABLED=false` until the migration, private storage, role checks and actual payment instructions have been integration-tested. The migration is supplied but has not been applied in this checkout because project credentials are unavailable.

`VITE_API_URL` points the frontend to the separately hosted API. No browser demo falls back to the live API, and real accounts never silently fall back to browser-local storage. See [payment architecture, endpoints and verification limits](docs/PAYMENT_PROOFS.md).

## Live authentication

Copy `frontend/.env.example` to `frontend/.env` and `Backend/.env.example` to `Backend/.env`. Set the frontend `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your own project. This is a publishable/anonymous key, never a service-role key. For API authentication set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in the backend environment. Each workspace reads its own environment file. Restart the servers after changing environment variables.

In Supabase Auth enable email/password, disable email confirmation for immediate dashboard access and set the minimum password length to 8 and allow the local and eventual production callback URLs for `/dashboard` and `/reset-password`. Configure a suitable password policy, reset emails, abuse protection and production SMTP before launch. The app supports registration, confirmation callbacks, sign-in, reset requests, password changes, profile metadata updates and sign-out. It uses email sign-in because no trusted username lookup service exists yet. With no credentials it reports that auth is unavailable; it never fabricates a successful login or email.

Real account balances are read from the authenticated balance API, start at zero and can be corrected by an authorized administrator after the balance migration is configured. Failed live reads show an unavailable state. User-editable metadata is display-only and is never used as a role, verification flag or authorization decision. Demo state cannot authenticate to the API. Live authentication and email delivery require a configured project and remain unverified in this checkout.

## Routes and scope

| Routes | Phase 1 behavior |
| --- | --- |
| `/` | Responsive landing, feature links and FAQ |
| `/register`, `/login`, `/forgot-password`, `/reset-password` | Auth UI and configurable Supabase integration |
| `/terms`, `/privacy` | Clearly labelled development notices, not final launch policies |
| `/dashboard` | Protected member shell, sample or empty financial summaries, charts, actions, balances, invite preview and timetable |
| `/dashboard/profile` | Edit demo or authenticated display metadata |
| `/dashboard/trading` | Deterministic educational simulation with virtual units, two exposure options and reset |
| `/dashboard/robots` | Country-specific 33-plan catalogue, payment instructions and proof submission; Rwanda redirects to its original dashboard |
| `/dashboard/chat` | Local composer preview, no live delivery or rewards |
| `/dashboard/deposit`, `/dashboard/voucher`, `/dashboard/voucher/history` | Provider selection, account balances, PIN availability and voucher history interface; financial actions await services |
| `/dashboard/withdraw`, `/dashboard/withdraw/:source` | Withdrawal source navigation, balance availability and payout/history screens |
| `/dashboard/referrals`, `/dashboard/referrals/:level`, `/dashboard/referrals/:level/:status` | Team levels, status filters and pending referral-data state |
| `/dashboard/language-teaching`, `/dashboard/foreigners` | Kinyarwanda writing practice and conversation matching interface; no live matching or rewards |
| `/dashboard/pay-for-client`, `/ranks`, `/claim-bonus`, `/surveys`, `/ads`, `/social`, `/shop` (each prefixed with `/dashboard`) | Routed, explicit planned states; no submission or payment actions |
| `/dashboard/transactions` | Authenticated balance correction history scoped to the current member; browser demo history stays separate |
| `/dashboard/support`, `/admin/support` | Private member support tickets and staff replies/status changes after migration 004 |
| Additional reference menu entries under `/dashboard` | Planned language teaching, marketing, forex lessons, videos, movies, games, airtime and reversals |
| `/admin`, `/admin/users`, `/admin/resources`, `/admin/announcements`, `/admin/settings`, `/admin/audit`, `/admin/payments` | System administration with user/content CRUD, settings, audit and payment review; browser-local demo and protected live APIs |
| `/dashboard/courses`, `/dashboard/articles`, `/dashboard/ebooks`, `/dashboard/announcements` | Published admin content and country audiences |
| Other routes | Not-found view |

English and Kinyarwanda cover authentication and core dashboard labels. Feature descriptions and future-release notices are currently English. Theme and language persist locally. Mobile navigation supports overlay dismissal, Escape and a keyboard focus loop. Appearance settings use a native modal dialog.

## Checks

```sh
npm run build
npm run lint
npm test
```

Playwright uses installed Chrome on Windows by default. Elsewhere set `PLAYWRIGHT_CHROMIUM_EXECUTABLE` to a local Chromium/Chrome executable and adjust the two `webServer.command` values from `npm.cmd` to `npm` if required. Tests start both servers and cover demo flows, auth error states, routing, translation, theme persistence, profile edits, simulation, chat text escaping, unavailable financial controls, API auth and responsive layout. These tests expect **no Supabase credentials**; use a separate controlled environment for real-account integration tests.

Screenshots are written to a fresh dated directory under `artifacts/screenshots/`; the HTML test report goes to `playwright-report/`. See `docs/REFERENCE_AUDIT.md` for source findings and scope. See `docs/ROADMAP.md` for remaining phases.

## Deployment

For the requested combined Vercel deployment, use the repository root (`.`), the root `vercel.json`, and [VERCEL_DEPLOYMENT.md](docs/VERCEL_DEPLOYMENT.md). Both frontend and API run on the same Vercel domain. The older frontend-only configuration is an alternative, not the setting for this deployment.

The review site is deployed at **https://lipahub-nine.vercel.app** with frontend and API hosted together from the repository root. `npm run build` creates frontend output in `frontend/dist/` and API output in `Backend/dist/`. The `frontend/vercel.json` configuration is only for the alternative frontend-only deployment with a separately hosted API. No custom domain is recorded. No secrets belong in `VITE_*` variables.

Final privacy/terms, production password recovery email, final operational verification of the supplied database policies and live financial verification/activation integrations remain future work. No earnings, business partners, users or market performance are claimed by this preview.


The registration telephone input now follows the supplied flag-and-code reference: a compact grey prefix button opens an alphabetical worldwide country list with bundled flags and calling codes. Account Country offers the full worldwide list plus International. Changing the telephone calling code preserves the selected account country. Numbers are formatted to E.164 at submission. Kinyarwanda shows `Shyiramo nimero`. The picker uses [International Telephone Input](https://intl-tel-input.com/docs/react-component); its flags and number utilities are served locally with the application.

Country menus now show the complete worldwide country and territory list, including France, United States, India, Japan, Brazil and Australia, with International retained as a fallback. Named selections persist through registration and profile updates. Account Country and telephone calling code are independent. Existing databases need `006_worldwide_countries.sql` after migration 005.

Registration and Profile now use the reference-style Country dropdown: flag, country name and muted calling code rows, with keyboard navigation, click-away dismissal and a popup that stays within the phone screen. Country has no search field and uses the same field width, 32px rows and 200px maximum list height as Telephone. The full worldwide country list remains available.
