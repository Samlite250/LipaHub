import { selectCountry } from './helpers/country'
import { expect, test, type Page } from '@playwright/test'
import { balanceInput, minorAmount } from '../Backend/src/admin/balances'

async function openWallet(page: Page) {
  await page.goto('/admin/users')
  await page.getByRole('button', { name: 'Open admin demo' }).click()
  await page.getByRole('button', { name: /Manage balances/ }).first().click()
  await expect(page.getByLabel('New available balance', { exact: true })).toBeVisible()
}
async function adjust(page: Page, available: string, bonus: string, reason: string) {
  await page.getByLabel('New available balance', { exact: true }).fill(available)
  await page.getByLabel('New bonus balance', { exact: true }).fill(bonus)
  await page.getByLabel('Adjustment reason', { exact: true }).fill(reason)
  await page.getByRole('button', { name: 'Review adjustment', exact: true }).click()
  await expect(page.getByText('Confirm this adjustment', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Confirm adjustment', exact: true }).click()
  await expect(page.getByRole('status')).toHaveText('Balance adjustment saved successfully.')
  await expect(page.getByLabel('New available balance', { exact: true })).toHaveValue(available)
}

test('admin balance edits persist, update member dashboards and keep country wallets separate', async ({ page }) => {
  await openWallet(page)
  await expect(page.getByLabel('New available balance', { exact: true })).toHaveValue('6800')
  await page.getByLabel('New available balance', { exact: true }).fill('-1')
  await page.getByLabel('Adjustment reason', { exact: true }).fill('Testing invalid account input')
  await page.getByRole('button', { name: 'Review adjustment' }).click()
  await expect(page.getByRole('alert')).toContainText('non-negative')
  await adjust(page, '12500', '500', 'Correcting the test account opening balance')
  await expect(page.locator('.admin-balance-history')).toContainText('RF 6,800 → RF 12,500')
  await page.getByLabel('Wallet country', { exact: true }).selectOption('Burundi')
  await expect(page.getByLabel('New available balance', { exact: true })).toHaveValue('1000000')
  await adjust(page, '1250000', '250000', 'Applying the Burundi demo account correction')
  await page.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('link', { name: 'Audit log', exact: true }).click()
  await expect(page.locator('.admin-audit-table tbody tr').filter({ hasText: 'balances.adjust' })).toHaveCount(2)
  await page.getByRole('link', { name: 'Back to dashboard', exact: true }).click()
  await expect(page.getByTestId('member-balance')).toHaveText('RF 12,500')
  await expect(page.getByTestId('member-bonus')).toHaveText('RF 500')
  await page.reload()
  await expect(page.getByTestId('member-balance')).toHaveText('RF 12,500')
  await page.goto('/dashboard/profile')
  await selectCountry(page, 'Burundi')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await page.goto('/dashboard')
  await expect(page.getByTestId('robot-funds')).toHaveText('1,250,000 Fbu')
  await expect(page.getByTestId('robot-bonus')).toHaveText('250,000 Fbu')
  await page.reload()
  await expect(page.getByTestId('robot-funds')).toHaveText('1,250,000 Fbu')
  await openWallet(page)
  await expect(page.getByLabel('Wallet country', { exact: true })).toHaveValue('Burundi')
  await page.getByLabel('Wallet country', { exact: true }).selectOption('Rwanda')
  await expect(page.getByLabel('New available balance', { exact: true })).toHaveValue('12500')
  await adjust(page, '2000', '100', 'Correcting an over-credit on the demo account')
  await expect(page.locator('.admin-balance-history article')).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
})

test('balance storage rejects stale edits and request reuse, and conserves adjustment entries', async ({ page }) => {
  await page.goto('/admin/users')
  await page.getByRole('button', { name: 'Open admin demo' }).click()
  await expect(page.locator('.admin-user-table tbody tr')).toHaveCount(1)
  const result = await page.evaluate(async () => {
    const path = '/src/lib/balances.ts'
    const { adjustBalance, getBalance } = await import(/* @vite-ignore */ path)
    const id = JSON.parse(sessionStorage.getItem('lipahub-demo')!).id
    const access = { demoId: id }
    const input = { country: 'Rwanda', available: '12345', bonus: '100', reason: 'Testing an idempotent administrative adjustment', version: 0, requestId: crypto.randomUUID() }
    await Promise.all([adjustBalance(access, id, input), adjustBalance(access, id, input)])
    const first = await getBalance(access, id, 'Rwanda')
    let reused = false; let stale = false
    try { await adjustBalance(access, id, { ...input, available: '12346' }) } catch { reused = true }
    try { await adjustBalance(access, id, { ...input, requestId: crypto.randomUUID(), available: '12346' }) } catch { stale = true }
    const concurrent = await Promise.allSettled(['25000', '26000'].map(available => adjustBalance(access, id, { ...input, requestId: crypto.randomUUID(), version: 1, available })))
    const second = await getBalance(access, id, 'Rwanda')
    await adjustBalance(access, id, { ...input, requestId: crypto.randomUUID(), version: 2, available: '0', bonus: '0' })
    const zero = await getBalance(access, id, 'Rwanda')
    return { firstVersion: first.wallet.version, firstEntries: first.history.length, reused, stale, successes: concurrent.filter(value => value.status === 'fulfilled').length, secondVersion: second.wallet.version, secondEntries: second.history.length, balanced: zero.history.every((entry: { availableBefore: number; availableAfter: number; bonusBefore: number; bonusAfter: number; clearingDelta: number }) => entry.availableAfter - entry.availableBefore + entry.bonusAfter - entry.bonusBefore + entry.clearingDelta === 0), zero: zero.wallet.availableMinor }
  })
  expect(result).toEqual({ firstVersion: 1, firstEntries: 1, reused: true, stale: true, successes: 1, secondVersion: 2, secondEntries: 2, balanced: true, zero: 0 })
  await page.getByRole('link', { name: 'Back to dashboard', exact: true }).click()
  await expect(page.getByTestId('member-balance')).toHaveText('RF 0')
})

test('all eight admin tabs including support are shown and every tab has working controls', async ({ page }) => {
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Open admin demo' }).click()
  const navigation = page.locator('.admin-sidebar nav')
  await expect(navigation.getByRole('link')).toHaveCount(8)
  await expect(navigation.getByRole('link', { name: 'Activity', exact: true })).toHaveCount(0)
  for (const [name, heading] of [
    ['Overview', 'Workspace overview'], ['Users', 'User directory'], ['Payments', 'Country payment settings'],
    ['Resources', 'Learning & content'], ['Announcements', 'Member announcements'],
    ['System settings', 'General settings'], ['Audit log', 'Administrative audit log'],
  ]) {
    await navigation.getByRole('link', { name, exact: true }).click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(navigation.getByRole('link', { name, exact: true })).toHaveAttribute('aria-current', 'page')
    await page.getByRole('button', { name: 'Refresh data' }).click()
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
  }
  await navigation.getByRole('link', { name: 'Payments', exact: true }).click()
  await page.getByRole('tab', { name: 'Proof submissions', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Your queue is clear', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Payment instructions', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Save payment instructions' })).toBeVisible()
})

test('balance validation preserves currency precision and rejects invalid amounts', () => {
  expect(minorAmount('12.34', 'KES')).toBe(1234)
  expect(minorAmount('0.1', 'USD')).toBe(10)
  expect(minorAmount('5000', 'BIF')).toBe(5000)
  for (const amount of ['-1', '1e3', 'NaN', '12.345', '1,000', ' 5', '10000000000000']) expect(() => minorAmount(amount, 'USD')).toThrow()
  expect(() => minorAmount('1.5', 'RWF')).toThrow()
  expect(() => balanceInput({ country: 'Unknown' })).toThrow()
  expect(() => balanceInput({ country: 'Rwanda', version: -1 })).toThrow()
})
