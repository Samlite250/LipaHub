import { expect, test } from '@playwright/test'

const site = 'https://lipahub1.vercel.app'
const publicPages = [
  ['/', 'LipaHub | Online Work, Digital Skills & Earn Online Worldwide'],
  ['/about', 'About LipaHub | Global Learning Hub Built in East Africa'],
  ['/global', 'LipaHub Global | Online Work & Digital Skills Worldwide'],
  ['/east-africa', 'LipaHub East Africa | Rwanda, Uganda, Kenya & Burundi'],
  ['/online-work', 'Online Work Worldwide | Akazikeza & Digital Skills | LipaHub'],
  ['/business', 'LipaHub Business | Global Learning & Community Partnerships'],
] as const

test('public SEO pages expose unique metadata, canonicals and crawlable content', async ({ page }) => {
  for (const [path, title] of publicPages) {
    await page.goto(path)
    await expect(page).toHaveTitle(title)
    await expect(page.locator('h1')).toBeVisible()
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /.{40}/)
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /^index,follow/)
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', `${site}${path}`)
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute('content', `${site}${path}`)
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', `${site}/og-image.png`)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} overflows`).toBeTruthy()
  }
  await page.goto('/online-work')
  await expect(page.locator('script#lipahub-page-jsonld')).toHaveCount(1)
  expect(await page.locator('script#lipahub-page-jsonld').textContent()).toContain('"@type":"Article"')
})

test('global positioning and target keywords are visible', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('meta[name="keywords"]')).toHaveAttribute('content', /LipaHub Global/)
  await expect(page.locator('meta[name="keywords"]')).toHaveAttribute('content', /best paying jobs in the whole world/)
  await expect(page.getByRole('heading', { name: 'One hub. Global access.' })).toBeVisible()
  await page.goto('/global')
  await expect(page.getByRole('heading', { level: 1 })).toContainText('global learning')
  for (const text of ['Open worldwide', 'earn online', 'Akazikeza', 'best-paying jobs in the whole world', 'LipaHub Business']) await expect(page.locator('main')).toContainText(text)
  await page.goto('/online-work')
  await expect(page.locator('main')).toContainText('best-paying jobs in East Africa, Africa or the whole world')
})

test('private and auth routes are excluded from search', async ({ page }) => {
  for (const path of ['/login', '/register', '/forgot-password', '/reset-password', '/activate-account', '/dashboard', '/admin', '/i/abc12345', '/this-does-not-exist']) {
    await page.goto(path)
    await expect(page.locator('meta[name="robots"]'), path).toHaveAttribute('content', 'noindex,nofollow')
  }
})

test('robots.txt, sitemap.xml and social image are published', async ({ request }) => {
  const robots = await request.get('/robots.txt')
  expect(robots.ok()).toBeTruthy()
  const robotsText = await robots.text()
  expect(robotsText).toContain('Sitemap: https://lipahub1.vercel.app/sitemap.xml')
  for (const path of ['/dashboard', '/admin', '/login', '/register', '/i/']) expect(robotsText).toContain(`Disallow: ${path}`)

  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.ok()).toBeTruthy()
  const sitemapText = await sitemap.text()
  for (const path of ['/', '/about', '/global', '/east-africa', '/online-work', '/business']) expect(sitemapText).toContain(`<loc>${site}${path}</loc>`)

  const image = await request.get('/og-image.png')
  expect(image.ok()).toBeTruthy()
  expect(image.headers()['content-type']).toContain('image/png')
  expect((await image.body()).length).toBeGreaterThan(1000)
})

test('new guide pages remain usable at the smallest supported width', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 })
  for (const [path] of publicPages) {
    await page.goto(path)
    await expect(page.locator('main h1')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${path} overflows at 320px`).toBeTruthy()
  }
})
