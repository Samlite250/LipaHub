import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

test('wallet welcome matches LipaHub branding and CLICK HERE opens installation help', async ({ page }, info) => {
  await page.goto('/login')
  await page.getByRole('button', {name: 'Explore the demo'}).click()
  await expect(page.locator('.wallet-welcome')).toContainText('Welcome to LipaHub')
  await expect(page.locator('.wallet-welcome')).toContainText('Courses, videos, games, trivia & referrals')
  await expect(page.locator('.hello-badge')).toContainText('Hello, Alex')
  await page.getByRole('button', {name: 'CLICK HERE', exact: true}).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Install the LipaHub app')
  await expect(dialog).toContainText('Add to Home screen')
  await expect(dialog).toContainText('iPhone or iPad')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await page.setViewportSize({width: 320, height: 740})
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
  await mkdir(`artifacts/screenshots/${process.env.LIPAHUB_SCREENSHOT_RUN}`, {recursive: true})
  await page.locator('.wallet-hero').screenshot({path: `artifacts/screenshots/${process.env.LIPAHUB_SCREENSHOT_RUN}/${info.project.name}-wallet-app.png`})
  await page.getByRole('combobox', {name: 'Language', exact: true}).selectOption('rw')
  await expect(page.getByRole('button', {name: 'KANDA HANO'})).toBeVisible()
})

test('an early browser install prompt survives navigation and is used only once', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => {
    const event = new Event('beforeinstallprompt', {cancelable: true})
    Object.assign(event, {prompt: async () => { localStorage.setItem('pwa-prompt-calls', String(Number(localStorage.getItem('pwa-prompt-calls') || 0) + 1)) }, userChoice: Promise.resolve({outcome: 'accepted'})})
    window.dispatchEvent(event)
  })
  // Use client navigation to keep the browser's pending event alive.
  await page.getByRole('link', {name: 'Get the app', exact: true}).first().click()
  await page.getByRole('button', {name: 'Install LipaHub', exact: true}).click()
  await expect(page.getByRole('status')).toContainText('Complete the installation')
  expect(await page.evaluate(() => localStorage.getItem('pwa-prompt-calls'))).toBe('1')
  await page.getByRole('button', {name: 'Done', exact: true}).click()
  await page.getByRole('button', {name: 'Install LipaHub', exact: true}).click()
  expect(await page.evaluate(() => localStorage.getItem('pwa-prompt-calls'))).toBe('1')
  await page.evaluate(() => window.dispatchEvent(new Event('appinstalled')))
  await expect(page.getByRole('heading', {name: 'LipaHub is installed'})).toBeVisible()
})

test('manifest and PNG icons identify the installed app as the same dashboard', async ({ request }) => {
  const response = await request.get('/manifest.webmanifest')
  expect(response.ok()).toBeTruthy()
  const manifest = await response.json()
  expect(manifest).toMatchObject({name: 'LipaHub', id: '/', start_url: '/dashboard', scope: '/', display: 'standalone'})
  for (const icon of manifest.icons) {
    const image = await request.get(icon.src)
    expect(image.ok()).toBeTruthy()
    const png = await image.body()
    expect(png.subarray(1, 4).toString()).toBe('PNG')
    const [width, height] = icon.sizes.split('x').map(Number)
    expect(png.readUInt32BE(16)).toBe(width)
    expect(png.readUInt32BE(20)).toBe(height)
  }
})

test('offline navigation shows a reconnect page and never caches account or API responses', async ({ page, context }) => {
  await page.goto('/install')
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('/sw.js', {scope: '/'})
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) await new Promise<void>(resolve => navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {once: true}))
  })
  await page.goto('/login')
  const cached = await page.evaluate(async () => {
    const entries = await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(request => new URL(request.url).pathname)))
    return entries.flat()
  })
  expect(cached).toContain('/offline.html')
  expect(cached.every(path => path === '/offline.html' || path === '/favicon.svg' || path.startsWith('/icons/'))).toBeTruthy()
  await context.setOffline(true)
  await page.goto('/dashboard/profile')
  await expect(page.getByRole('heading', {name: "You're offline"})).toBeVisible()
  const apiUnavailable = await page.evaluate(async () => { try { await fetch('/api/me'); return false } catch { return true } })
  expect(apiUnavailable).toBeTruthy()
  await context.setOffline(false)
  await page.reload()
  await expect(page.getByRole('heading', {name: 'Sign In', exact: true})).toBeVisible()
})
