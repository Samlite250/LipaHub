# Robotic plans and country rules

The owner requested 33 plans for everyone outside Rwanda, with Burundi values from 60,000 Fbu to 1,000,000 Fbu and instant activation bonuses from 261,000 Fbu to 8,000,000 Fbu. The owner authorized filling the range and converting the resulting amounts into local currencies. These figures are product inputs, not verified financial returns.

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

Plan i uses fraction `(i - 1) / 32`. Robot value and bonus each interpolate linearly between their supplied endpoints. Base Burundi amounts round to whole francs. The two endpoints remain exact; intermediate plans are generated rather than represented as individually supplied by the owner.

| Plan | Robot value (Fbu) | Instant bonus (Fbu, demo) |
| --- | ---: | ---: |
| Robot 01 | 60,000 | 261,000 |
| Robot 02 | 89,375 | 502,844 |
| Robot 03 | 118,750 | 744,688 |
| Robot 04 | 148,125 | 986,531 |
| Robot 05 | 177,500 | 1,228,375 |
| Robot 06 | 206,875 | 1,470,219 |
| Robot 07 | 236,250 | 1,712,063 |
| Robot 08 | 265,625 | 1,953,906 |
| Robot 09 | 295,000 | 2,195,750 |
| Robot 10 | 324,375 | 2,437,594 |
| Robot 11 | 353,750 | 2,679,438 |
| Robot 12 | 383,125 | 2,921,281 |
| Robot 13 | 412,500 | 3,163,125 |
| Robot 14 | 441,875 | 3,404,969 |
| Robot 15 | 471,250 | 3,646,813 |
| Robot 16 | 500,625 | 3,888,656 |
| Robot 17 | 530,000 | 4,130,500 |
| Robot 18 | 559,375 | 4,372,344 |
| Robot 19 | 588,750 | 4,614,188 |
| Robot 20 | 618,125 | 4,856,031 |
| Robot 21 | 647,500 | 5,097,875 |
| Robot 22 | 676,875 | 5,339,719 |
| Robot 23 | 706,250 | 5,581,563 |
| Robot 24 | 735,625 | 5,823,406 |
| Robot 25 | 765,000 | 6,065,250 |
| Robot 26 | 794,375 | 6,307,094 |
| Robot 27 | 823,750 | 6,548,938 |
| Robot 28 | 853,125 | 6,790,781 |
| Robot 29 | 882,500 | 7,032,625 |
| Robot 30 | 911,875 | 7,274,469 |
| Robot 31 | 941,250 | 7,516,313 |
| Robot 32 | 970,625 | 7,758,156 |
| Robot 33 | 1,000,000 | 8,000,000 |

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
