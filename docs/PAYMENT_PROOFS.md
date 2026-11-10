# Robot payment instructions and proofs

## Member and administrator flow

1. Open `/admin/payments`. **Open admin demo** explicitly enters a browser-local preview; a real admin account uses the authenticated backend instead.
2. Select the country and configure the requested methods: **Lumicash + Code** for Burundi, manual instructions for Rwanda, and **Binance TRC** for Uganda, Kenya, South Africa and International. Recipient details are blank by default. Crypto requires the asset, network and precise payment instructions. Methods remain unpublished until their fields are complete and the admin enables them.
3. In a non-Rwandan member dashboard, **Activate robot** opens the admin's published method options and instruction revision. It no longer immediately awards a demo bonus.
4. After reading the instructions, continue to proof submission. Required: full names, phone with country code, and 1–3 PNG/JPEG screenshots (5 MB maximum each). Transaction reference is optional.
5. Submission creates a **pending_review** request. It does not establish that a payment occurred, activate a robot or credit any bonus/balance. The member can reopen its status after reload.
6. The admin's **Proof submissions** tab shows payer details and private screenshots. Review can set **under_review** or **rejected** (with a reason). A rejected request may be resubmitted. There is no manual paid/verified/credit action in this module.

An instruction revision change invalidates an open proof form; the member must reopen and review the updated instructions. The submitted method and quote are immutable snapshots. A unique open-request constraint prevents duplicate requests for one member/country/plan.

Rwanda's existing member dashboard remains unchanged and has no robot purchase route. Its instruction configuration is prepared for future payment services.

## Browser-local preview

Demo instructions and proofs live in the `lipahub-payment-preview` IndexedDB database. Files are stored as browser-local blobs, not in public frontend assets, sessionStorage, source control or the live API. Each demo member has a session ID, and the member view filters requests by that ID. Starting a new demo creates a different ID. The explicit admin preview can review this browser's test submissions.

Use test information. Browser-local demo data is not an authenticated production admin system; another person using the same browser profile could open the admin preview. Signing out does not erase the IndexedDB test submissions; clear this site's browser storage to remove them. The UI and development privacy notice disclose this behavior. No invented payment recipient or receipt is supplied; automated tests use a canvas image explicitly labelled **TEST IMAGE / Not a payment receipt**.

## Authenticated backend setup

The code and migration are supplied, but the migration has **not been run** and real private uploads have **not been integration-tested** because no Supabase project credentials are configured.

- Apply `Backend/migrations/001_robot_payment_proofs.sql` once to the intended project. It creates instruction revisions, activation requests, proof metadata, audit events, RLS policies and the private `robot-payment-proofs` storage bucket.
- Set `SUPABASE_URL`, `SUPABASE_ANON_KEY` and server-only `SUPABASE_SERVICE_ROLE_KEY` in `Backend/.env`. Never put a service-role credential in a `VITE_*` variable or frontend file.
- Set `VITE_API_URL` in `frontend/.env` to the API origin, and set `WEB_ORIGIN` on the API to the exact frontend origin. Restart after configuration changes.
- Assign administrators through trusted auth administration: `app_metadata.role = 'admin'`. Neither a profile edit, user metadata nor a request-body role can grant access. The API verifies the session with Supabase Auth before reading roles; admin database RPCs also check trusted auth metadata.
- Keep `PAYMENT_PROOF_INTAKE_ENABLED=false` until schema/storage/role checks, actual recipient and crypto amount instructions, retention/deletion policy and integration review have been completed. The flag enables proof intake, not payment verification, trading, payouts or wallet credits.

## Endpoints

All endpoints below are under `/api/robot-payments` and require a real Bearer session. Browser demo sessions cannot authenticate to them.

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/instructions/:country` | Country method options, revision and intake-enabled state |
| GET | `/requests` | Only the authenticated member's submissions |
| POST | `/requests` | Validated details + base64 PNG/JPEG images; pending request only; intake flag required |
| GET | `/requests/:id/files/:fileId` | Owner/admin check followed by a signed private image URL, valid for 60 seconds |
| PUT | `/admin/instructions/:country` | Admin-only, optimistic revision update and audit event |
| GET | `/admin/requests` | Admin-only review queue, newest 200 records |
| PATCH | `/admin/requests/:id` | Admin-only `under_review` or `rejected` plus note; cannot set `verified` |

## Storage and validation

The backend recomputes the plan quote from the public `shared/robot-catalog.json`. Client-supplied price, bonus, user ID or status fields are never authoritative. Frontend and server quote parity is tested across every plan and supported country. Backend builds copy the catalogue into `Backend/dist/config/` so packaged server artifacts have their own immutable public data snapshot.

Authentication runs before the large upload body parser. Limits: three screenshots, 5 MB per file, PNG/JPEG allowlist, canonical base64, matching image magic bytes, valid image dimensions and a 20-million-pixel cap. Paths use authenticated user IDs and random request/file UUIDs; uploaded filenames are display metadata only. SVG/HTML or renamed non-images are rejected. The browser also decodes and checks selected images before preview.

Uploads go into a private bucket. RLS restricts metadata and storage reads to the owner or trusted admins; restrictive storage guards also constrain broader pre-existing policies. Clients cannot directly insert/update/delete proof objects. Signed URL requests recheck ownership or admin access. API responses are not cached. Database RPCs are executable only by the backend service role, and admin changes are audited.

The request and metadata commit atomically in a database RPC. If upload or commit fails, the API attempts to delete uploaded files; operators should periodically reconcile any orphan private objects left by failed cleanup. A unique partial index prevents duplicate open requests, including concurrent submissions.

## Verification boundary

Uploaded images and typed names are user claims, not trusted provider verification. Neither submission nor review grants an active robot, earnings, bonus or a withdrawal balance. Trusted payment-provider verification, settlement/reconciliation, a persistent wallet/ledger and activation logic remain separate future work. The old virtual activation arithmetic is retained only as an isolated model with invariant tests; the new member flow does not call it.

Automated validation covers the browser preview, stale revisions, pending status, admin review, image display, blocked SVG uploads, image signature/dimension checks, unauthenticated API rejection and a server-side test proving that forged user metadata/body roles cannot grant admin access. Real Supabase RLS, storage signing and RPC transactions still require integration testing against the configured project.
