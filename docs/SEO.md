# SEO setup

## Canonical domain

The build defaults to `https://lipahub1.vercel.app`. Set `VITE_SITE_URL` to the live production origin before building:

```powershell
$env:VITE_SITE_URL = "https://lipahub1.com"
npm run build
```

`VITE_SITE_URL` is used for canonical links, Open Graph URLs, `robots.txt` and `sitemap.xml`. Keep it consistent with the domain verified in Google Search Console.

`www.lipahub.com` is controlled by a different site. Do not use it as the canonical domain or copy its content.

## Positioning

LipaHub is presented as a global learning and community platform built in East Africa. Public copy must say it is open worldwide while keeping country-specific payment, activation and withdrawal claims accurate.

Primary keyword themes:

- LipaHub, LipaHub1, LipaHub Global, LipaHub Business
- online work worldwide, remote work, digital skills
- earn online, Akazikeza
- best-paying jobs in the whole world, best-paying jobs in East Africa
- LipaHub Rwanda, Uganda, Kenya and Burundi

Do not promise jobs, guaranteed income, investment returns or payment coverage that is not live.

## Implemented

- Unique titles, descriptions, canonical links, Open Graph and Twitter metadata for public routes.
- Public content routes: `/about`, `/global`, `/east-africa`, `/online-work`, `/business`.
- JSON-LD for the organization, website, web application, FAQ and public guide pages.
- Generated `robots.txt` and `sitemap.xml` from `frontend/vite-seo.ts`.
- `noindex,nofollow` and `X-Robots-Tag` protection for auth, member, admin, invitation and API routes.
- 1200x630 social image at `frontend/public/og-image.png`.
- Internal links from the homepage navigation, global section and footer.

## Search engines

1. Deploy the production build and confirm `/robots.txt`, `/sitemap.xml` and `/og-image.png` return 200.
2. Add the production domain as a property in Google Search Console and Bing Webmaster Tools.
3. Verify ownership with DNS or the provided HTML verification method.
4. Submit `https://<domain>/sitemap.xml`.
5. Use URL Inspection in Search Console after deploying new pages.
6. Monitor indexing, queries, Core Web Vitals and mobile usability.

## Content and authority

Technical SEO makes the site eligible to rank; it does not guarantee position 1. Ranking also depends on content quality, backlinks, brand searches, domain history and competition.

Prioritize:

- Accurate, original global and country pages for LipaHub.
- Practical online-work and digital-skills content that answers real questions without promising income.
- Consistent use of the LipaHub, LipaHub Global and LipaHub Business names.
- Links from relevant directories, community organizations, learning providers and partners worldwide.
- Regular publishing of useful guides rather than thin keyword pages.
- Search Console monitoring to improve pages that already receive impressions.

Do not create fake job listings, fake reviews, doorway pages, hidden text or guaranteed-earnings claims. These can cause manual actions and undermine trust.

## Validation

```powershell
npm run lint
npm run build
npx playwright test tests/seo.spec.ts
```

Check the built `frontend/dist/robots.txt`, `frontend/dist/sitemap.xml` and canonical/JSON-LD tags in `frontend/dist/index.html`.
