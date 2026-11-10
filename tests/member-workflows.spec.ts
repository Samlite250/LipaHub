import { expect, test } from '@playwright/test'

test('member balance history shows saved corrections after a reload', async ({ page }) => {
  await page.goto('/login'); await page.getByRole('button', { name: 'Explore the demo' }).click()
  await page.goto('/dashboard/transactions')
  await expect(page.getByRole('heading', { name: 'Balance history' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'No balance changes yet' })).toBeVisible()
  await page.evaluate(async () => {
    const profile = JSON.parse(sessionStorage.getItem('lipahub-demo')!)
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const opening = indexedDB.open('lipahub-balance-preview', 1); opening.onsuccess = () => resolve(opening.result); opening.onerror = () => reject(opening.error) })
    const tx = db.transaction(['wallets', 'entries'], 'readwrite')
    const entryId = crypto.randomUUID(); const now = new Date().toISOString()
    tx.objectStore('wallets').put({ id: `${profile.id}:Rwanda`, userId: profile.id, country: 'Rwanda', currency: 'RWF', availableMinor: 7050, bonusMinor: 0, version: 1, updatedAt: now })
    tx.objectStore('entries').put({ id: entryId, requestId: entryId, userId: profile.id, country: 'Rwanda', currency: 'RWF', availableBefore: 6800, availableAfter: 7050, bonusBefore: 0, bonusAfter: 0, createdAt: now })
    await new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error) }); db.close()
  })
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Balance history' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'RF 250', exact: true })).toBeVisible()
  await expect(page.getByText('Not available yet', { exact: true })).toHaveCount(0)
})

test('support in demo requires a real account and admin inbox is routed', async ({ page }) => {
  await page.goto('/login'); await page.getByRole('button', { name: 'Explore the demo' }).click()
  await page.goto('/dashboard/support')
  await expect(page.getByRole('heading', { name: 'Member support' })).toBeVisible()
  await expect(page.getByText('Sign in with a real account', { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Submit request' })).toHaveCount(0)
  await page.goto('/admin/support'); await page.getByRole('button', { name: 'Open admin demo' }).click()
  await expect(page.getByRole('heading', { name: 'Support inbox', exact: true, level: 1 })).toBeVisible()
  await expect(page.getByText('Sign in with an administrator account to respond to real member requests.')).toBeVisible()
})
