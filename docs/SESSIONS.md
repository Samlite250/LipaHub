# Sessions and browser storage

LipaHub is a static SPA using Supabase Auth. It does not currently set application cookies.

## Supabase session

`frontend/src/lib/supabase.ts` creates the browser client with:

- `persistSession: true`
- `autoRefreshToken: true`
- `detectSessionInUrl: true`
- `flowType: 'pkce'`

Supabase stores the session in browser storage and refreshes access tokens while the member stays signed in. `frontend/src/state.tsx` loads the existing session on startup, listens for auth changes and synchronizes sign-in/sign-out between open tabs.

Signing out clears the Supabase session. Theme, language and demo preferences are separate localStorage/sessionStorage values and are not authentication credentials.

## Cookies

The app does not add advertising or tracking cookies. The privacy page documents browser storage and session behavior.

If httpOnly cookies are required later, add a trusted backend session proxy and move token handling server-side. Do not place privileged tokens in JavaScript-readable cookies.

## Security headers

`vercel.json` sets:

- `Content-Security-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Referrer-Policy`
- `Permissions-Policy`

The CSP allows inline scripts because the site includes JSON-LD. Re-test authentication, Supabase requests, images and the member dashboard whenever the policy changes.

## Validation

```powershell
npm run lint
npm run build
npx playwright test tests/app.spec.ts tests/auth-navigation.spec.ts tests/seo.spec.ts
```
