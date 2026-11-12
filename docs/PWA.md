# LipaHub installable app

The LipaHub PWA uses the same website, authentication, member/admin pages and API as the browser site. Its install URL is https://lipahub1.vercel.app/install. Launching the installed app opens `/dashboard`; signed-out members reach sign-in through the existing route guard. It does not duplicate account data or introduce separate balances.

The gradient wallet header includes the LipaHub welcome line and an underlined **CLICK HERE** install button, translated to **KANDA HANO** in Kinyarwanda. The member's greeting uses their own account name. Both Rwanda and robot dashboards include the button. Public visitors can also open **Get the app** on the home page.

The button uses a browser-provided install prompt when available. A pending prompt is preserved during navigation. Otherwise, the button opens installation instructions for Android, iPhone/iPad and desktop. A cancelled prompt is not presented as a successful installation. The browser's `appinstalled` event or standalone display mode identifies installed use. Actual installation requires the user's confirmation on their device; automated checks do not confirm installation on the owner's phone.

The manifest is at `/manifest.webmanifest`, with standalone display, scope `/`, start URL `/dashboard`, original-logo PNG icons at 192px and 512px, a separate maskable icon and an Apple touch icon. The production service worker is `/sw.js`. Hosting serves these as static files before the SPA fallback, with explicit manifest/worker MIME types and worker update headers.

The service worker stores only the public offline page and original app icons. It does not cache account pages, API responses or authentication requests. Navigation uses the network; offline navigation displays a reconnect screen. Signing in, balances, support, invitations and current content require an internet connection. Online page code is fetched normally, so the worker does not hold an older app bundle indefinitely.

Validation covers welcome/install controls, both languages, 320px layout, early prompt retention, one-use prompting, installed state, manifest identity, real PNG dimensions, offline navigation/recovery and absence of private responses from Cache Storage. Browser installation behavior follows the [installability guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable) and [prompt handling guidance](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Trigger_install_prompt).
