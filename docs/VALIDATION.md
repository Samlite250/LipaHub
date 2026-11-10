# Phase 1 validation

Validated locally on 9 November 2026, Africa/Johannesburg. No cloud environment or production service was changed.

## Results

Compact-card correction (supersedes the earlier enlarged-card design): robot catalogue cards are now approximately 300px tall on phones and 305px tall on desktop, with simple inline Robot 01–33 headings, no large numbered badges, tighter spacing and three columns at a standard desktop width. Primary summary cards were also reduced to approximately 124–128px minimum height. Build and lint passed, and both desktop/phone filter-layout checks passed. Manual browser review at 320, 360, 412, 768, 1024 and 1280px found no page overflow or clipped headings/amounts. Current captures are in `artifacts/screenshots/compact-robots-1794253280323/`.

Robot-card readability update: plan cards now use wider columns, large PLAN 01–33 badges, larger monetary text, roomier spacing and 50px activation controls. Builds and lint passed, as did the desktop/phone filter and layout checks. Manual browser inspection of Robot 33 at widths 320, 360, 412, 768, 1024 and 1280px found no page overflow or clipped price/bonus/number text; number badges render at 40–42px. Narrow phones use one column, standard desktop uses two wider columns and very wide screens use three. Card captures are saved under `artifacts/screenshots/robot-card-readability-1794253032731/`.

Primary robot summary cards: Active Plans, Received Bonuses, Total Activated Value and Available Funds now use the same gradient-card styling as the Rwanda dashboard. Totals derive from the selected country's demo activation wallet, including reload/reset behavior. The Active Plans card opens the active-only catalogue. Both builds and lint passed; desktop/phone robot checks cover card presence for all non-Rwandan markets, activated-value totals and the active-plans shortcut.

Country-specific robot update: both workspace builds and lint passed. All 10 robot browser checks passed across desktop and phone after the final 33-plan and FX rules were applied. They cover Rwanda exclusion and direct-route redirect, all non-Rwandan country options, the exact Burundi endpoints and midpoint, monotonic generated values, UGX/KES/USD/ZAR conversions, currency-precision wallet debits, rapid duplicate activation events, cancellation, insufficient funding, reload persistence, country-isolated wallets, malformed stored IDs, new demo sessions, search/filter behavior, phone calling codes and 320px layout. The existing application checks passed during the preceding full run. The narrow-layout check now waits for the normal desktop-to-mobile sidebar transition to finish before measuring overflow. API activation POST remains unavailable, and health still reports payments disabled and trading simulation-only. See [robot rules and all 33 base plan values](ROBOT_PLANS.md).

Workspace reorganization and account-menu update: application code is now under `frontend/` and `Backend/`, with separate packages, TypeScript configurations, build outputs and environment templates. Root workspace commands preserve the existing development URLs. Both builds and lint passed. The 19 existing browser checks passed (one duplicate screenshot check skipped), and two additional desktop/phone dropdown checks passed after correcting a test selector to account for the accessible spacing between Deposit and its demo badge. The new checks cover all five entries, keyboard focus, arrow navigation, Escape, outside dismissal, routed links, the Settings dialog and sign-out. Both running servers were checked successfully after restart.

- `npm.cmd run build`: passed TypeScript and Vite production build. Current workspace outputs are `frontend/dist/` and `Backend/dist/`.
- `npm.cmd run lint`: passed.
- `npm.cmd test`: 19 passed, one intentional skip. Desktop 1280 × 900 and phone 412 × 924; additional 320px layout checks. The skipped mobile test duplicates the desktop reference-canvas captures.
- Targeted screenshot rerun: three passed, one intentional duplicate skip. Captures wait for the relevant view, font readiness and browser paint; animations are disabled and output uses CSS pixels.
- Dependency installation/audit after the scoped `minimatch` override: zero reported vulnerabilities. The override updates the lint tool's transitive glob dependency; build and lint passed with it.
- Local frontend readiness: HTTP 200 from `http://127.0.0.1:5173/`.
- API health and authorization checked in the browser suite: financial services disabled, no-session request rejected, missing auth configuration reported without granting access, arbitrary payment POST unavailable.

## Browser coverage

Landing and FAQ, missing routes, protected member routes, unconfigured sign-in/reset error states, registration password mismatch, English/Kinyarwanda persistence, password visibility, demo login/logout, balance visibility, light/dark persistence, mobile drawer dismissal and Escape, profile saving, deterministic simulation gains/losses/reset, safe chat text rendering, chat clearing, planned route states, absence of financial submission controls, API authentication and runtime page errors.

The full suite expects empty Supabase configuration. Real registration, confirmation email delivery, password recovery, profile updates for real accounts and API token verification against a configured Supabase project have not been exercised. They need credentials and a controlled integration environment. No RLS or ledger tests can be claimed because those services belong to later phases.

Screenshots from the final export are in a dated subdirectory of `artifacts/screenshots/`; filenames below are relative to that run directory. Fresh directories avoid overwriting images that Windows viewers may still hold open. Vite ignores generated reports, artifacts and caches so report regeneration does not trigger reloads or Windows file-watcher conflicts.

## Visual review

All supplied screenshots were visually inspected. Captured LipaHub pages were reviewed at desktop and phone sizes. Authentication reference-sized viewports are 351 × 447 (sign-in) and 375 × 547 (registration); full-page captures extend vertically where the readable form needs scrolling. Dashboard capture is 1280 × 631, approximately the reference desktop content after excluding browser chrome. Phone overview is 412 × 924.

| Reference | LipaHub capture | Review |
| --- | --- | --- |
| `image.png` | `reference-size-dashboard.png` | 240px white sidebar, 64px blue header, gradient profile/wallet, translucent wallet tiles and four vivid cards align with reference patterns. Demo disclosure and prominent new feature links change vertical positions. |
| `image(1).png`, `image(2).png`, `image(4).png` | `mobile-dashboard-top.png` | Centred original logo, separated header controls, hidden drawer, single-column cards and two-column wallet tiles. No horizontal overflow at 320px or 412px. |
| `image(5).png` | `reference-size-register.png` | Mint canvas, centred white card, teal border, upper-right language controls, field order and gradient action preserved. Larger readable fields create a taller page than the scaled reference. |
| `image(6).png` | `reference-size-login.png` | Mint canvas, logo above white card, teal border, compact form and reset link preserved. Email-only auth and additional demo/language controls are intentional differences. |
| No original dark-mode screenshot | `desktop-dashboard-dark.png`, `mobile-dashboard-dark.png` | Original dark treatment preserves card colours and provides dark surfaces, readable chart labels and input controls. |

Visual iteration fixed a 320px overflow from the public hero's decorative background and improved narrow-phone navigation spacing. Screenshot capture was corrected to wait for the member view and finish resize transitions before taking images. A local SVG country flag replaces platform-dependent emoji in the dashboard header/profile.

This is a visual comparison of independently implemented layout patterns, not a claim of pixel identity. Authentication form scale, original LipaHub artwork, typography, safe sample data and new feature placements deliberately differ. No numeric pixel-similarity score is asserted.

## Telephone and supported-country update

Registration now offers all 16 owner-listed African countries plus International, with a synchronized calling-code selector. The code is displayed before the country name so it remains visible at 320px. The full workspace build passed. The selected application, robot, payment-model and country suite passed 43 checks with one existing duplicate screenshot check skipped; all four country checks passed again after the final display change. Targeted lint passed for the new/updated country, auth, robot, balance, flag, payment and test code, excluding the pre-existing control-regex error in admin validation. Full lint remains blocked by that existing error and missing Node globals for `Backend/scripts/check-setup.mjs`; it also reports the existing AccountTabs fast-refresh warning.

Server/client quotes were compared for all 33 plans in every non-Rwandan supported market. New markets preserve USD pricing rather than inventing local exchange rates. `005_supported_countries.sql` expands existing database constraints and balance-function validation; it has not been applied or tested against a live Supabase database. Mobile registration was visually reviewed at 320px; see `artifacts/telephone-countries-mobile.png`.

## Reference telephone picker

Replaced the native telephone country select with the International Telephone Input React component and bundled flag assets. The closed field shows flag, dial code and arrow on a grey background; the scrollable worldwide list opens with the selected country near its middle. Supported calling countries synchronize Account Country; other calling countries select International. Submission awaits the local number utilities and stores an E.164 number.

Workspace build and targeted lint passed. Across the application, country and robot desktop/mobile checks, 37 checks passed and the existing duplicate screenshot check was skipped. Six initially failing checks passed after correcting an accessible-label conflict and scoping the list-item assertion. Keyboard opening, Escape, outside-click dismissal, Kinyarwanda placeholder, all 16 supported prefixes, worldwide selection and 320px layout were checked. Reference-style open/closed captures are in `artifacts/telephone-reference-open.png`, `artifacts/telephone-reference-closed.png` and `artifacts/telephone-reference-mobile.png`. The build reports a bundle-size advisory; phone-number utilities load in a separate chunk. Live registration against Supabase remains untested.

## Worldwide Country menu

Country selectors now share `shared/countries.json`: 251 named countries and territories plus International. This includes the worldwide telephone catalogue and additional territories without individual calling codes. Named international countries persist in profiles and are accepted by backend validation. Existing currency markets retain their prices; other named countries preserve the previous USD fallback. Changing a telephone prefix no longer overwrites Account Country.

Workspace build, targeted lint and 26 desktop/mobile country, robot and payment-model checks passed. These cover selections from multiple continents, profile reload persistence and server/client quote agreement for every listed non-Rwandan country. Compiled backend validation accepted France and produced a USD quote for Japan. Migration `006_worldwide_countries.sql` updates live country constraints and balance-function validation; it has not been applied to a live database.

## Country dropdown reference layout

Registration and Profile now use `CountrySelect.tsx` rather than a browser-native select. The popup shows original bundled flags, country names and muted calling codes in compact rows, with a grey active/selected row, icon-free search and the full worldwide catalogue. It positions above or below the field and clamps to the viewport. Keyboard arrows, Enter, Escape, Tab, click-away dismissal, empty search results and retained focus are covered. Search and selection are independent of the telephone country picker.

Workspace build and targeted lint passed. Across the selected application, country and robot runs, 41 existing checks and two new dropdown interaction checks passed; the existing duplicate screenshot check was skipped. Two mobile checks were rerun cleanly after overlapping test runs removed each other's temporary trace files. Visual review confirmed the dropdown at desktop and 320px widths without overflow. Captures: `artifacts/country-dropdown-reference.png`, `artifacts/country-dropdown-desktop.png`, `artifacts/country-dropdown-mobile.png`. No database change is required for this presentation update.

Country dropdown correction: removed its search input. The full list opens immediately and uses the Telephone field width, 32px rows, 200px maximum list height, 13px text and matching flag/name spacing. Keyboard arrows, Home/End, Enter, Escape and Tab remain available. All 12 country checks passed across desktop and mobile, including explicit comparison with Telephone popup width and row height. TypeScript and targeted lint passed. Reviewed `artifacts/country-dropdown-no-search.png`.

## Whole-system audit and backend foundation (10 November 2026)

`npm run check` completed successfully: clean lint, frontend/API builds, eight PostgreSQL integration checks and 121 passing Playwright checks across desktop and mobile. One existing duplicate screenshot check was skipped. After the final payment-instruction privacy change, the 24 backend/payment checks passed again; eight SQL checks passed against migrations 001 through 008. The backend suite was rerun after adding readiness verification of schema revision 8. `npm audit --audit-level=high` reported zero known vulnerabilities.

The SQL checks execute real PostgreSQL using PGlite with minimal Auth/Storage schema fixtures. They verify that all application tables have RLS, server-only RPC permissions, owner isolation, fresh administrator status, suspension denial, private bucket configuration, support idempotency/ownership/version checks, balance correction idempotency/stale rejection/clearing conservation and worldwide country constraints. API tests additionally exercise security/no-store/request-ID headers, malformed bearer tokens, upstream Auth failure/timeouts, draft instruction filtering, bulk loading, 204 responses, body limits, rate limits, dependency readiness and ambiguous proof commits without deleting referenced objects.

The site-name setting now updates the member footer, stale profile-selector tests use the actual country control, Support is included in the admin navigation expectations, and the full member/admin/reference-screen checks pass. Country presentation remains without search; Telephone keeps calling-code search.

`setup:check` and `backend:check` intentionally exit nonzero in this workspace because no working Supabase environment files/project were supplied. They must pass after real configuration. No live database migration, sign-up/email/Storage test, provider integration, GitHub CI run or deployment is claimed. The frontend build still reports its existing bundle-size advisory. See SYSTEM_AUDIT.md for remaining work and BACKEND.md for the handoff.

Vercel preparation: root configuration routes API requests before SPA fallback, includes compiled backend/shared JSON in the function, and uses a port-free API export. Production frontend transports use the current origin when VITE_API_URL is empty. Screenshot limits are now 3 MiB combined to fit base64 JSON within Vercel request limits. Local adapter and database checks passed (10 Node tests). No Vercel deployment is claimed until account authorization and a successful live deployment response are available.

Import-only preparation: shared public deployment metadata supplies the owner-provided Supabase URL when a publishable key is available. The build and API resolve the same public key from one environment entry, reject server secrets in public-key settings, and never embed the server key. A generated new-project SQL file includes all eight migrations exactly once. Build, lint and 12 Node/database/deployment tests passed. Actual Supabase/Vercel configuration still requires authenticated access; no private credentials are committed.
