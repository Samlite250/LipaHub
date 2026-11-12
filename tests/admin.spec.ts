import { expect, test } from '@playwright/test'
import { countries } from '../frontend/src/domain/countries'

test('admin counts and filters saved submissions and opens a specific request from overview', async ({ page }) => {
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Open admin demo' }).click()
  await expect(page.getByRole('heading', { name: 'No payment markets published' })).toBeVisible()
  await expect(page.locator('.admin-market-panel')).toContainText(`0 of ${countries.length}`)
  await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('lipahub-balance-preview', 2)
      open.onsuccess = () => resolve(open.result)
      open.onerror = () => reject(open.error)
    })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('requests', 'readwrite')
      for (const [index, name, country, status] of [
        ['1', 'Test Alice', 'Burundi', 'pending_review'],
        ['2', 'Test Bob', 'Kenya', 'under_review'],
        ['3', 'Test Carol', 'Burundi', 'rejected'],
      ]) tx.objectStore('requests').put({
        id: `test-request-${index}`, userId: `test-user-${index}`, country, status,
        planId: 'robot-01', fullName: name, phone: '+25779000000', transactionReference: `TEST-${index}`,
        instructionVersion: 1, paymentMethod: { id: 'test-method', name: 'Test method', enabled: true },
        quote: { value: 60000, bonus: 261000, currency: 'BIF' }, files: [],
        submittedAt: '2026-11-10T08:00:00Z', reviewNote: '',
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    db.close()
  })
  await page.getByRole('button', { name: 'Refresh data' }).click()
  const paymentMetric = page.locator('.admin-metric').filter({ hasText: 'Payment proofs to review' })
  await expect(paymentMetric.locator('strong')).toHaveText('2')
  await expect(paymentMetric).toContainText('1 pending · 1 in review')
  await expect(page.locator('.admin-metric').filter({ hasText: 'Withdrawals to review' }).locator('strong')).toHaveText('—')
  await page.getByRole('button', { name: 'Review submission from Test Alice' }).click()
  await expect(page.locator('.admin-proof-card')).toHaveCount(1)
  await expect(page.locator('.admin-proof-card')).toContainText('Test Alice')
  await page.getByLabel('Search submissions').fill('')
  await page.getByLabel('Filter by country').selectOption('Kenya')
  await expect(page.locator('.admin-proof-card')).toHaveCount(1)
  await expect(page.locator('.admin-proof-card')).toContainText('Test Bob')
  await page.getByLabel('Filter by status').selectOption('rejected')
  await expect(page.getByRole('heading', { name: 'No matching submissions' })).toBeVisible()
  await page.getByRole('button', { name: 'Clear filters' }).click()
  await expect(page.locator('.admin-proof-card')).toHaveCount(3)
  await page.getByLabel('Search submissions').fill('TEST-3')
  await expect(page.locator('.admin-proof-card')).toHaveCount(1)
  await expect(page.locator('.admin-proof-card')).toContainText('Test Carol')
})

test('withdrawals administration is reachable and stays live-only in the demo', async ({ page }) => {
  await page.goto('/admin')
  await page.getByRole('button', { name: 'Open admin demo' }).click()
  await page.getByRole('link', { name: 'Withdrawals', exact: true }).click()
  await expect(page.locator('.admin-page-title').getByRole('heading', { name: 'Withdrawal review', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Live administrator access required' })).toBeVisible()
  await expect(page.locator('.admin-live-only')).toContainText('not simulated in the demo workspace')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
})

test('admin overview connects country settings, review filters and audit on desktop and mobile', async ({ page }) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: 'Admin workspace', exact: true })).toBeVisible()
  await expect(page.locator('.admin-metrics')).toHaveCount(0)
  await page.getByRole('button', { name: 'Open admin demo' }).click()
  await expect(page.locator('.admin-metric').filter({ hasText: 'Payment proofs to review' }).locator('strong')).toHaveText('0')
  await expect(page.getByRole('heading', { name: 'No payment markets published' })).toBeVisible()
  await expect(page.locator('.admin-market-panel')).toContainText(`0 of ${countries.length}`)
  await page.getByRole('link', { name: 'Payments', exact: true }).click()
  await page.getByLabel('Payment country').selectOption('Burundi')
  const method = page.locator('.admin-method-editor').filter({ has: page.getByRole('heading', { name: 'Lumicash', exact: true }) })
  await method.getByLabel('Recipient phone / code / wallet address').fill('TEST-RECIPIENT')
  await method.getByLabel('Instructions for Lumicash').fill('Test instructions only. Do not send a payment.')
  await method.getByLabel('Publish Lumicash').check()
  await page.getByRole('button', { name: 'Save payment instructions' }).click()
  await expect(page.getByRole('status')).toHaveText('Demo instructions saved in this browser.')
  await page.getByRole('link', { name: 'Overview', exact: true }).click()
  await expect(page.locator('.admin-metric').filter({ hasText: 'Published payment markets' }).locator('strong')).toHaveText('1')
  await expect(page.locator('.admin-market-grid > button')).toHaveCount(1)
  await expect(page.locator('.admin-market-grid')).toContainText('Burundi')
  await page.getByRole('button', { name: 'Refresh data' }).click()
  await expect(page.locator('.admin-metric').filter({ hasText: 'Published payment markets' }).locator('strong')).toHaveText('1')
  await expect(page.locator('.admin-market-grid > button')).toHaveCount(1)
  await page.getByRole('link', { name: 'Payments', exact: true }).click()
  await page.getByRole('tab', { name: 'Proof submissions', exact: true }).click()
  await page.getByLabel('Search submissions').fill('No matching member')
  await page.getByLabel('Filter by country').selectOption('Kenya')
  await page.getByLabel('Filter by status').selectOption('under_review')
  await expect(page.getByRole('heading', { name: 'Your queue is clear' })).toBeVisible()
  await page.getByRole('link', { name: 'Audit log', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Administrative audit log' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Back to dashboard', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy()
})
