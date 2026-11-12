# Rwanda account activation

New Rwanda registrations open `/activate-account` and require administrator-approved payment before dashboard access. Existing accounts are grandfathered. Administrators and new registrations for other countries keep their existing access rules.

Under **Admin → Payments → Rwanda**, configure MTN and/or Airtel with the actual activation fee in whole RWF, recipient, recipient name and payment steps, then publish the option. Unconfigured methods cannot accept submissions. No recipient or fee from the reference screenshots is used.

Members select an operator, follow the saved instructions, enter their official first and last names and international phone number, attach 1–3 PNG/JPEG screenshots (3 MB combined), confirm the details and submit. A transaction reference is optional. Instructions and the fee are saved with the submission; changed instructions require members to review the latest version.

Review submissions under **Admin → Payments → Proof submissions**. Check the payment against actual operator transaction records before approving. Approval unlocks the Rwanda dashboard without crediting a robot bonus; rejection keeps the account locked and lets the member submit corrected proof. Robot-plan approval separately activates the robot and credits its listed one-time bonus exactly once.

Names alone do not verify payment. Removing screenshots safely requires a merchant/payment-provider integration that checks the provider's successful transaction status, amount, recipient and transaction identifier. The reference page does not establish how its operator verifies transactions. LipaHub currently uses manual review, not automatic MTN or Airtel verification. See [MTN's asynchronous payment documentation](https://momodeveloper.mtn.com/content/html_widgets/nqxho.html).

Migration `012_rwanda_account_activation.sql` creates a trusted requirement at registration. Server authorization and database RLS enforce it. Changing user-editable country, role or payment metadata cannot clear it. The requirement, approval and trusted Auth flag are updated atomically. Apply only this missing migration to an existing database, never the combined new-project setup.

Validation: 24 database tests; mocked API authorization, fee and screenshot checks; desktop/mobile signup, direct-route blocking, pending submission, approval, Airtel, language and small-screen checks. Browser payment tests use controlled mocks and no real transfers. No production financial test accounts or fabricated receipts were submitted.
