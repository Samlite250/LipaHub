# Production authentication email

Status on 11 November 2026: the recorded live setup uses the Supabase test sender. The owner has an email address but has not supplied an owned domain or email sending provider. Production SMTP and inbox delivery remain unverified. Email confirmation is now disabled at the owner’s request; new registrations enter the dashboard immediately with an 8-character minimum password. Custom SMTP is still needed for reliable password recovery and invitations.

The owner plans to purchase `lipahub1.com` and use `www.lipahub1.com` for the website. Purchase and DNS ownership are pending. Once owned, use `auth.lipahub1.com` as the proposed sending subdomain and `no-reply@auth.lipahub1.com` as the sender. Continue using the existing Vercel URLs until the custom domain is connected and verified.

## Owner setup

1. Choose and register a domain you own. Check both registration and renewal costs before purchasing. A proposed name is not proof of availability. The existing Vercel review address can continue hosting the website while email is configured.
2. Create a [Resend account](https://resend.com/signup) using your existing email address. Its free plan is a starting option; check [current limits](https://resend.com/pricing) against expected registration and password-reset volume.
3. In Resend, add a sending subdomain such as `auth.YOUR_DOMAIN`. Replace `YOUR_DOMAIN` with the purchased domain throughout this guide.
4. In the domain registrar's DNS settings, add the exact records Resend provides for that subdomain. Do not invent record values or replace unrelated records. Wait until Resend reports the domain as verified.
5. Create a sending API key for the verified domain. Keep the key private and enter it directly into Supabase's SMTP password field.

Your existing `lipahubsupport@gmail.com` address remains the support contact. The sender below is an outbound identity; setting it up does not create a support mailbox.

## Supabase settings

Open the [LipaHub project](https://supabase.com/dashboard/project/pzxmfdqfsoltoqgflxcm), then Authentication > Email > SMTP Settings. Enable custom SMTP and use:

| Field | Value |
| --- | --- |
| Sender name | `LipaHub` |
| Sender email | `no-reply@auth.YOUR_DOMAIN` |
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend` |
| Password | The private Resend sending API key |

Use a sender under the verified domain. Do not use the Gmail support address as the Resend sender. Keep email confirmation disabled and the minimum password length at 8, as requested by the owner. Keep these existing authentication URLs:

- Site URL: `https://lipahub-nine.vercel.app`
- Allowed redirect: `https://lipahub-nine.vercel.app/dashboard`
- Allowed redirect: `https://lipahub-nine.vercel.app/reset-password`

Disable click tracking for authentication emails so recovery and invitation links are not rewritten. Review Supabase's email rate limit and the provider's quota together before onboarding clients. SMTP credentials belong in Supabase, not frontend variables or this repository. No application redeployment is required just to change Supabase SMTP.

## Delivery verification

After saving the settings, use an inbox you control outside the Supabase project team:

1. Register through the live website using an 8-character password. Confirm that the dashboard opens immediately without a confirmation email.
2. Request a password reset through the website. Receive the email, follow the reset link, set a new password and sign in with it.
3. Check the visible sender, destination URLs, spam folder and provider delivery logs. Provider acceptance alone does not prove inbox delivery.
4. Record the result in `LIVE_DEPLOYMENT_STATUS.md`. Keep production delivery marked unverified until both flows succeed.

## References

- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp)
- [Resend SMTP integration for Supabase](https://resend.com/docs/send-with-supabase-smtp)
- [Resend domain verification](https://resend.com/docs/dashboard/domains/introduction)
