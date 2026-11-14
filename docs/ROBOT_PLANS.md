# Robotic plans and country rules

The owner supplied 33 explicit plans each for Uganda and Burundi. Uganda runs from 70,000 UGX to 1,000,000 UGX and Burundi from 60,000 Fbu to 1,000,000 Fbu, both with instant activation bonuses from 261,000 to 8,600,000 in their local currency. The other markets still interpolate the BIF endpoints and convert the result into local currencies. These figures are product inputs, not verified financial returns.

## Country display

| Selected country | Dashboard | Currency |
| --- | --- | --- |
| Rwanda / RW / RWA | Existing member dashboard | RF display retained |
| Burundi | 33 robotic plans | BIF, displayed as Fbu |
| Uganda | 33 robotic plans | UGX |
| Kenya | 33 robotic plans | KES |
| South Africa | 33 robotic plans | ZAR |
| International / other nonempty country | 33 robotic plans | USD |
| Missing country | Existing dashboard until selected | No robot eligibility inferred |

Registration and Profile offer Burundi, Uganda, Kenya, Rwanda, South Africa and International / Other countries. Phone prefixes are +257, +256, +254, +250 and +27 respectively; International requires a complete number including its calling code. Country selection controls presentation only, not financial authorization.

## Plan generation

Uganda and Burundi each use the explicit owner-supplied tables stored in [robot-catalog.json](../shared/robot-catalog.json). The two countries are independent: Uganda starts at 70,000 UGX, Burundi at 60,000 Fbu. For all other markets, plan i uses fraction `(i - 1) / 32` and interpolates linearly between the BIF endpoints (60,000 to 1,000,000 value, 261,000 to 8,000,000 bonus) before converting once to the local currency.

| Plan | Uganda value (UGX) | Burundi value (Fbu) | Instant bonus (Uganda UGX / Burundi Fbu) |
| --- | ---: | ---: | ---: |
| Robot 01 | 70,000 | 60,000 | 261,000 |
| Robot 02 | 90,000 | 90,000 | 478,000 |
| Robot 03 | 120,000 | 120,000 | 520,000 |
| Robot 04 | 150,000 | 150,000 | 640,000 |
| Robot 05 | 180,000 | 180,000 | 700,000 |
| Robot 06 | 210,000 | 210,000 | 820,000 |
| Robot 07 | 240,000 | 240,000 | 960,000 |
| Robot 08 | 270,000 | 270,000 | 1,160,000 |
| Robot 09 | 300,000 | 300,000 | 1,380,000 |
| Robot 10 | 330,000 | 330,000 | 1,490,000 |
| Robot 11 | 360,000 | 360,000 | 1,620,000 |
| Robot 12 | 390,000 | 390,000 | 1,840,000 |
| Robot 13 | 420,000 | 420,000 | 2,260,000 |
| Robot 14 | 450,000 | 450,000 | 2,660,000 |
| Robot 15 | 480,000 | 480,000 | 3,060,000 |
| Robot 16 | 510,000 | 510,000 | 3,160,000 |
| Robot 17 | 540,000 | 540,000 | 3,360,000 |
| Robot 18 | 570,000 | 570,000 | 3,660,000 |
| Robot 19 | 600,000 | 600,000 | 4,000,000 |
| Robot 20 | 630,000 | 630,000 | 4,360,000 |
| Robot 21 | 660,000 | 660,000 | 4,660,000 |
| Robot 22 | 690,000 | 690,000 | 4,960,000 |
| Robot 23 | 710,000 | 710,000 | 5,360,000 |
| Robot 24 | 740,000 | 740,000 | 5,680,000 |
| Robot 25 | 770,000 | 770,000 | 6,060,000 |
| Robot 26 | 800,000 | 800,000 | 6,480,000 |
| Robot 27 | 830,000 | 830,000 | 6,900,000 |
| Robot 28 | 860,000 | 860,000 | 7,020,000 |
| Robot 29 | 890,000 | 890,000 | 7,390,000 |
| Robot 30 | 910,000 | 910,000 | 7,740,000 |
| Robot 31 | 940,000 | 940,000 | 8,060,000 |
| Robot 32 | 970,000 | 970,000 | 8,200,000 |
| Robot 33 | 1,000,000 | 1,000,000 | 8,600,000 |

## Currency conversion

The checked-in [reference snapshot](../shared/robot-catalog.json) was fetched from [Frankfurter, pinned to 9 November 2026](https://api.frankfurter.dev/v2/rates?date=2026-11-09&base=BIF&quotes=UGX,KES,USD,ZAR). Frankfurter describes its data as reference rates rather than live market quotes in its [official documentation](https://frankfurter.dev/). No application request refreshes rates or changes a displayed quote during a session.

| Quote | Units per 1 BIF | Display precision |
| --- | ---: | --- |
| UGX | 1.3587 | Whole shillings |
| KES | 0.043182 | 2 decimal places |
| USD | 0.00033271 | 2 decimal places |
| ZAR | 0.0054762 | 2 decimal places |

Each converted value and bonus is rounded once to the target currency precision. Wallet accounting sums integer minor units, preventing floating-point balance drift. A new snapshot or pricing formula must also change `ROBOT_CATALOG_VERSION`; stored demo activations from a different version reset instead of being silently repriced.

## Activation and proof flow

The four primary cards remain Active Plans, Received Bonuses, Total Activated Value and Available Funds. Each country has separate demo wallet data; the old virtual arithmetic is retained as a model, but the member UI no longer immediately activates a plan.

**Activate robot** now opens the country's published admin payment instructions. Burundi offers Lumicash and Code, Rwanda has editable manual instructions for future payment services, and the other markets offer Binance TRC. Crypto publishing requires an asset and network as well as the address/instructions. A USD reference value is displayed alongside country-currency plan values for crypto instructions; the admin must specify the actual asset amount, with no token peg assumed by the app.

Members continue to a proof form with full names, phone, optional transaction reference and 1?3 PNG/JPEG screenshots. Submission records a pending request and **does not** change Active Plans, Received Bonuses or balances. Duplicate open requests are blocked, and an instruction revision change requires the member to reopen the instructions. Admin review can mark under review or reject with a reason; provider payment verification and activation are separate work.

The local demo stores instruction revisions and proof files in IndexedDB. Real accounts use authenticated API routes and private Supabase storage when configured. Demo data cannot authenticate to those APIs. See [payment proof implementation](PAYMENT_PROOFS.md) for setup, access rules and limitations.

## Production boundary

This remains simulation-only under the master prompt. No money is accepted, live order placed or withdrawable bonus created. Production activation requires verified funds, immutable quoted terms/rates, an idempotent server-side activation transaction and a ledger. Editable user metadata and browser storage cannot authorize those actions.

## Implementation

- [Country and phone rules](../frontend/src/domain/countries.ts)
- [33-plan generation, currencies and activation transitions](../frontend/src/domain/robots.ts)
- [Country-specific robot dashboard](../frontend/src/pages/Robots.tsx)
- [Demo session persistence](../frontend/src/state.tsx)
- [Browser checks](../tests/robots.spec.ts)
