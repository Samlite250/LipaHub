import { selectCountry } from './helpers/country'
import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

async function open(page: Page, route: string) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await page.goto(`/dashboard/${route}`)
}
test('deposit shows Rwanda providers, expands details and returns to the dashboard', async ({ page }) => {
  await open(page, 'deposit')
  await page.getByRole('button', { name: 'Deposit with MTN' }).click()
  await expect(page.getByRole('heading', { name: 'MTN Mobile Money' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Deposit with MTN' })).toHaveAttribute('aria-expanded', 'true')
  await page.getByRole('button', { name: 'Deposit with Airtel' }).click()
  await expect(page.getByRole('heading', { name: 'Airtel Mobile Money' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'MTN Mobile Money' })).toHaveCount(0)
  await page.getByRole('link', { name: 'Go to dashboard' }).click()
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/dashboard/profile')
  await selectCountry(page, 'Burundi')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.goto('/dashboard/deposit')
  await expect(page.getByText('Deposit options for Burundi have not been published yet.', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Deposit with MTN' })).toHaveCount(0)
})

test('voucher uses account funds, explains PIN availability and opens history', async ({ page }) => {
  await open(page, 'voucher')
  await expect(page.locator('.reference-funds')).toContainText('RF 6,800')
  await page.getByRole('button', { name: 'Change PIN' }).click()
  await expect(page.getByRole('dialog')).toContainText('PIN setup is not available yet')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await expect(page.getByRole('button', { name: 'Voucher purchases unavailable' })).toBeDisabled()
  await page.locator('.reference-tabs').getByRole('link', { name: 'History' }).click()
  await expect(page).toHaveURL(/\/voucher\/history$/)
  await expect(page.getByRole('heading', { name: 'Voucher history' })).toBeVisible()
})

test('withdrawal sources and team levels support nested routes and sidebar expansion', async ({ page }, info) => {
  await open(page, 'withdraw/chat')
  await expect(page.locator('.reference-page>.panel-heading')).toContainText('Withdraw from Chat')
  await expect(page.getByRole('button', { name: 'Request withdrawal' })).toBeDisabled()
  await page.locator('.reference-channel-links').getByRole('link', { name: 'Withdraw History' }).click()
  await expect(page.getByRole('heading', { name: 'Withdrawal history' })).toBeVisible()
  await page.goto('/dashboard/referrals/level-1/inactive')
  await expect(page.locator('.team-toolbar .selected')).toHaveText('Inactive')
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Toggle navigation' }).click()
  const team = page.locator('.nav-submenu').filter({ has: page.locator('.nav-submenu-toggle', { hasText: 'Team' }) })
  await expect(team).toHaveAttribute('data-open', 'true')
  const thirdLevel = team.locator('.nav-level').filter({ has: page.locator('.nav-submenu-toggle', { hasText: 'Level 3' }) })
  await thirdLevel.locator(':scope > .nav-submenu-toggle').click()
  await thirdLevel.getByRole('link', { name: 'Active', exact: true }).click()
  await expect(page).toHaveURL(/\/referrals\/level-3\/active$/)
  await expect(page.getByRole('heading', { name: 'Level 3 team' })).toBeVisible()
  if (info.project.name === 'mobile') await expect(page.locator('.sidebar-overlay')).toHaveCount(0)
})

test('all team levels expand and collapse and have working active and inactive links', async ({ page }, info) => {
  await open(page, 'referrals/level-1')
  const sidebar = page.locator('.sidebar')
  const showMenu = async () => { if (info.project.name === 'mobile' && !(await sidebar.evaluate(el => el.classList.contains('is-open')))) await page.getByRole('button', { name: 'Toggle navigation' }).click() }
  await showMenu()
  await expect(page.getByText('All members', { exact: true })).toHaveCount(0)
  const team = page.locator('.nav-submenu').filter({ has: page.locator(':scope > .nav-submenu-toggle', { hasText: 'Team' }) })
  const summary = team.locator(':scope > .nav-submenu-toggle')
  const existingFont = await sidebar.getByRole('link', { name: 'Deposit', exact: true }).evaluate(el => { const css = getComputedStyle(el); return [css.fontFamily, css.fontSize, css.fontWeight] })
  expect(await summary.evaluate(el => { const css = getComputedStyle(el); return [css.fontFamily, css.fontSize, css.fontWeight] })).toEqual(existingFont)
  for (const number of [1, 2, 3]) {
    const level = team.locator('.nav-level').filter({ has: page.locator('.nav-submenu-toggle', { hasText: `Level ${number}` }) })
    if (!(await level.evaluate(el => el.getAttribute('data-open') === 'true'))) await level.locator(':scope > .nav-submenu-toggle').click()
    for (const status of ['active', 'inactive']) {
      await level.getByRole('link', { name: status === 'active' ? 'Active' : 'Inactive', exact: true }).click()
      await expect(page).toHaveURL(new RegExp(`/referrals/level-${number}/${status}$`))
      await expect(page.locator('.team-toolbar .selected')).toHaveText(status === 'active' ? 'Active' : 'Inactive')
      await showMenu()
    }
    await level.locator(':scope > .nav-submenu-toggle').click()
    await expect(level.getByRole('link', { name: 'Inactive', exact: true })).not.toBeVisible()
    await level.locator(':scope > .nav-submenu-toggle').focus()
    await page.keyboard.press('Enter')
    await expect(level.getByRole('link', { name: 'Inactive', exact: true })).toBeVisible()
  }
  await summary.click()
  await expect(team.locator('.nav-level').first().locator(':scope > .nav-submenu-toggle')).not.toBeVisible()
  await summary.focus(); await page.keyboard.press('Enter')
  await expect(team.locator('.nav-level').first().locator(':scope > .nav-submenu-toggle')).toBeVisible()
})

test('conversation matching requires a choice and never invents a partner or reward', async ({ page }) => {
  await open(page, 'foreigners')
  const search = page.getByRole('button', { name: 'Search for a foreigner' })
  await expect(search).toBeDisabled()
  await page.getByRole('button', { name: 'Female', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Female', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await search.click()
  await expect(page.getByRole('status')).toContainText('No conversation has been started')
  await page.getByRole('button', { name: 'Male', exact: true }).click()
  await expect(page.getByText('Matching is not available yet', { exact: true })).toHaveCount(0)
})

test('teaching practice escapes messages, resets and fits desktop and small phones', async ({ page }, info) => {
  await open(page, 'language-teaching')
  await page.getByRole('button', { name: 'Start a writing practice' }).click()
  await page.getByLabel('Your Kinyarwanda message').fill('<img src=x onerror=alert(1)> Muraho!')
  await page.getByRole('button', { name: 'Add practice message' }).click()
  await expect(page.locator('.language-message')).toHaveText('<img src=x onerror=alert(1)> Muraho!')
  await expect(page.locator('.language-message img')).toHaveCount(0)
  await page.getByRole('button', { name: 'End practice' }).click()
  await page.getByRole('button', { name: 'Start a writing practice' }).click()
  await expect(page.locator('.language-message')).toHaveCount(0)
  const folder = `artifacts/screenshots/reference-tabs-${process.env.LIPAHUB_SCREENSHOT_RUN}`
  await mkdir(folder, { recursive: true })
  for (const route of ['deposit', 'voucher', 'withdraw/chat', 'referrals/level-2', 'language-teaching', 'foreigners']) {
    await page.goto(`/dashboard/${route}`)
    await expect(page.locator('.reference-page')).toBeVisible()
    if (route === 'language-teaching') await page.getByRole('button', { name: 'Start a writing practice' }).click()
    await page.screenshot({ path: `${folder}/${info.project.name}-${route.replaceAll('/', '-')}.png`, fullPage: true })
    if (info.project.name === 'mobile') await page.setViewportSize({ width: 320, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
    if (info.project.name === 'mobile') {
      const logo = await page.locator('.mobile-logo').boundingBox()
      const tools = await page.locator('.header-tools').boundingBox()
      expect(logo && tools && logo.x + logo.width <= tools.x).toBeTruthy()
    }
    if (route === 'voucher' || route === 'foreigners') {
      await page.getByRole('button', { name: 'Switch to dark mode' }).click()
      await page.screenshot({ path: `${folder}/${info.project.name}-${route}-dark.png`, fullPage: true })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
      await page.getByRole('button', { name: 'Switch to light mode' }).click()
    }
  }
})
