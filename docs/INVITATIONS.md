# Invited registration

Members share `/register?ref=MEMBER_ID` or the alternative `/?ref=MEMBER_ID` from their dashboard. Registration shows the inviter's saved display name above the fields, with `Invited by:` in English and `Ufashijwe na:` in Kinyarwanda. It uses LipaHub branding and the supplied reference's pale banner and wider desktop card.

The invite survives home, login, legal-page visits and reloads in the same browser tab for up to seven days. A new explicit `ref` replaces it; a malformed explicit reference clears it. Successful registration clears the saved browser invitation. Ordinary registration without an invitation keeps its existing layout.

`GET /api/invitations/:reference` resolves an existing active Auth account by UUID. Its public response contains only the account ID and display name, capped at 80 characters. It never returns email, phone, account role or private metadata. Missing and suspended accounts return 404; configuration or upstream errors return 503. Existing API rate limits and no-store headers apply. Invalid links and service outages do not prevent ordinary registration; transient errors offer retry.

Signup includes `invitation_reference` and, when the inviter lookup succeeded, `invited_by` in Supabase user metadata. These fields preserve the registration's invitation context. User metadata is editable and must not authorize access or determine rewards, activation or payouts. No trusted referral ledger, team counts, commissions or rewards are implemented by this change. No database migration is required.

Browser checks cover both languages, persistence through the home/login routes, retry, invalid references, escaped display names and mobile overflow. API checks cover response privacy, suspended/missing accounts and safe upstream errors. Existing share/copy and authentication checks remain applicable.
