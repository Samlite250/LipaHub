# Robot payments and manual approval

## Member flow

**Activate robot** opens one form with three sections: published payment instructions, full names and international phone number, then screenshot upload and **Submit payment proof**. The payment reference is optional. Screenshots must be PNG/JPEG, 1–3 files and at most 3 MiB combined. Selected images can be previewed and removed.

The form uses the administrator's country-specific published methods. Burundi supports Lumicash/Code; other robot markets use the configured Binance TRC method, with recipient, asset and network supplied by the operator. No recipient is invented. Rwanda retains its separate dashboard. Instructions and proof intake must be enabled before members can submit. A changed instruction revision requires reopening the form.

Submission stores private proof files and a pending request, using a server-generated immutable plan quote and payment-method snapshot. It does not activate the plan or credit any funds. Members can reopen pending/under-review requests. Rejection includes a reason and permits a new submission. Approved requests show the active robot and the credited one-time bonus. The member view refreshes on focus and periodically; balances use the existing balance refresh mechanism.

## Administrator flow

Open **Admin → Payments → Proof submissions**. Each submission shows the payer's name and phone, saved recipient, method, asset/network, payment reference, plan amount and one-time bonus. Private screenshots can be opened individually. Admins can mark a request under review, reject with a reason, or choose **Approve payment**.

Approval requires a review note and confirmation that the payment was matched against the recipient's records. **Confirm approval** atomically records the decision, activates the robot and credits the saved one-time bonus to the member's bonus balance. Available funds are unchanged. Approval is a trusted manual decision, not automatic verification of an uploaded image or a provider callback. Trading, payouts and recurring earnings remain separate services.

The API accepts `under_review`, `rejected` or `verified` (displayed as **Approved**) with `note` and expected review `version`. Trusted current admin metadata is checked both in the API and in SQL. Browser-supplied bonus values or actor IDs are ignored. A stale or conflicting review returns 409. Approved and rejected decisions are final. Retrying the identical decision by the same administrator is idempotent.

## Database and ledger

Existing installations require `011_robot_payment_approval.sql` after migrations 001–010. It adds review versions and the bonus-credit receipt, and replaces the review RPC with the five-argument version. Readiness checks the new columns. For new empty projects, `Backend/setup/new-project.sql` contains the complete migration chain.

The SQL transaction locks the request and serializes bonus credits with the clearing/wallet locks used by existing balance adjustments. It credits only the bonus minor units in the saved server quote, validates the currency and balance ceiling, records a balanced immutable adjustment, and increments the wallet/review versions. The payment request ID is the ledger's unique request ID. The open-plan unique index prevents a second approved request for the same member/country/plan. Payment and system audit records identify the reviewer. Any failure rolls back the decision and credit together. No direct browser writes to balances or requests are allowed.

Proof objects remain in the private `robot-payment-proofs` bucket, accessible to the owner and trusted administrators through short-lived signed URLs. API responses use no-store headers. The PWA does not cache private pages or proof/API responses.

## Configuration

The existing Supabase project, private bucket, server-only service key and trusted administrator role are required. `PAYMENT_PROOF_INTAKE_ENABLED=true` enables submission only when the member also has a valid published method. The operator will enter the real recipient details in Admin → Payments; the live project had no saved instructions when this enhancement was prepared. Neither code nor tests populate fictitious production recipients.

## Browser preview and verification

The demo uses IndexedDB `lipahub-balance-preview` version 2, with proof requests, instruction revisions, wallets and ledger entries in one database so approvals commit atomically. Existing wallets remain in place and old `lipahub-payment-preview` data is migrated once. Demo credit is local test data and grants no live privileges. Automated screenshots are explicitly marked as test images rather than payment receipts.

Checks cover one-form submission, image/phone/instruction validation, private access, admin role enforcement, rejection/resubmission, approval/activation, duplicate approval, stale decisions, exact currency precision, balanced clearing, overflow rollback, demo migration and concurrent local approvals. The proposed production financial test was blocked by automatic approval review because it would create temporary accounts/proofs and mutate ledger/clearing balances. It was not executed; local PostgreSQL and browser/API checks are the financial validation for this change.
