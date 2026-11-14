import { selectCountry } from './helpers/country'
import { expect, test } from '@playwright/test'

test('Rwanda navigation matches the supplied menu and keeps the existing submenu behavior', async ({ page }, info) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'Open practice workspace' }).click()
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Toggle navigation' }).click()
  const menu = page.locator('.sidebar nav')
  await expect(menu.locator('.nav-caption')).toHaveText(['Main', 'Accounts', 'Products', 'Settings'])
  const labels = [
    ['Dashboard', 'Crypto Robotic Trading'],
    ['Voucher', 'Deposit', 'PayForClient', 'Ranks', 'Withdraw', 'Claim Bonus', 'Whatsapp', 'Team', 'Accounts'],
    ['Teach Kinyarwanda', 'Chat with Foreigners', 'Digital Marketing', 'Forex Lessons', 'Aviator', 'Spin & Win', 'Fixed Bets', 'Soccer', 'FREE SHOP', 'Whatsapp Earn', 'Movies', 'Meta ADS', 'Reels', 'Articles', 'Ads Earnings', 'Tiktok Earn', 'Youtube Earn', 'Survey Challenge', 'Business Ebooks', 'Buy Airtime'],
    ['Profile', 'Contact US'],
  ]
  for (const [index, expected] of labels.entries()) await expect(menu.locator('.nav-group').nth(index).locator(':scope > a, :scope > .nav-submenu > .nav-submenu-toggle')).toHaveText(expected)
  await expect(menu.getByRole('link', { name: 'Robotic Plans', exact: true })).toHaveCount(0)
  await expect(menu.getByRole('link', { name: 'Crypto Robotic Trading', exact: true })).toHaveAttribute('href', '/dashboard/trading')
  await menu.getByRole('button', { name: 'Team', exact: true }).click()
  const level = menu.getByRole('button', { name: 'Level 2', exact: true })
  await level.click()
  const panel = page.locator(`[id="${await level.getAttribute('aria-controls')}"]`)
  await expect(panel.getByRole('link')).toHaveText(['Active', 'Inactive'])
  await expect(level.locator('svg')).toHaveCount(0)
  await panel.getByRole('link', { name: 'Inactive', exact: true }).click()
  await expect(page).toHaveURL(/\/referrals\/level-2\/inactive$/)
  await expect(page.locator('.team-toolbar .selected')).toHaveText('Inactive')
  for (const [route, title] of [['whatsapp', 'Whatsapp'], ['aviator', 'Aviator'], ['spin', 'Spin & Win'], ['fixed-bets', 'Fixed Bets'], ['soccer', 'Soccer'], ['whatsapp-earn', 'Whatsapp Earn'], ['meta-ads', 'Meta ADS'], ['reels', 'Reels'], ['tiktok', 'Tiktok Earn'], ['youtube', 'Youtube Earn']]) {
    await page.goto(`/dashboard/${route}`)
    await expect(page.locator('.page-heading h1')).toHaveText(title)
    await expect(page.getByText('Unknown route', { exact: true })).toHaveCount(0)
  }
  await page.goto('/dashboard/reversals')
  if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Toggle navigation' }).click()
  await expect(menu.getByRole('button', { name: 'Accounts', exact: true })).toHaveAttribute('aria-expanded', 'true')
  await expect(menu.getByRole('link', { name: 'Reversals', exact: true })).toHaveAttribute('aria-current', 'page')
})

test('country selection switches Rwanda menu without replacing other country menus', async ({ page }, info) => {
  await page.goto('/login'); await page.getByRole('button', { name: 'Open practice workspace' }).click()
  for (const country of ['Burundi', 'Rwanda']) {
    await page.goto('/dashboard/profile')
    await selectCountry(page, country)
    await page.getByRole('button', { name: 'Save changes' }).click()
    await expect(page.getByRole('status')).toContainText('Profile saved')
    await page.goto('/dashboard')
    if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Toggle navigation' }).click()
    const menu = page.locator('.sidebar nav')
    if (country === 'Burundi') {
      await expect(menu.getByRole('link', { name: 'Robotic Plans', exact: true })).toBeVisible()
      await expect(menu.getByRole('link', { name: 'Aviator', exact: true })).toHaveCount(0)
    } else {
      await expect(menu.getByRole('link', { name: 'Aviator', exact: true })).toBeVisible()
      await expect(menu.getByRole('link', { name: 'Robotic Plans', exact: true })).toHaveCount(0)
    }
    if (info.project.name === 'mobile') await page.getByRole('button', { name: 'Close menu' }).click()
  }
})
