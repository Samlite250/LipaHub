import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

const reference = 'Cynthia'
const inviterId = '11111111-1111-4111-8111-111111111111'
test('invited registration shows the inviter above the fields and preserves the invitation across pages', async ({ page }, info) => {
  await page.route('**/api/invitations/*', route => route.fulfill({json: {inviter: {id: inviterId, name: 'Cynthia', username: 'Cynthia'}}}))
  await page.goto(`/?ref=cYnThIa`)
  await page.goto('/login')
  await page.getByRole('link', {name: 'Sign Up', exact: true}).click()
  const banner = page.locator('.registration-invitation')
  await expect(banner).toHaveText('Invited by: Cynthia')
  expect((await banner.boundingBox())!.y).toBeLessThan((await page.locator('input[name=username]').boundingBox())!.y)
  await page.getByRole('button', {name: 'Kinyarwanda', exact: true}).click()
  await expect(banner).toHaveText('Ufashijwe na: Cynthia')
  await page.reload()
  await expect(banner).toHaveText('Ufashijwe na: Cynthia')
  await expect(page.locator('input[name=password]')).toHaveAttribute('minlength', '8')
  await mkdir(`artifacts/screenshots/${process.env.LIPAHUB_SCREENSHOT_RUN}`, {recursive: true})
  await page.screenshot({path: `artifacts/screenshots/${process.env.LIPAHUB_SCREENSHOT_RUN}/${info.project.name}-invited-registration.png`, fullPage: true})
  await page.setViewportSize({width: 320, height: 740})
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
})

test('previously shared ID links still show the saved username', async ({ page }) => {
  await page.route(`**/api/invitations/${inviterId}`, route => route.fulfill({json: {inviter: {id: inviterId, name: 'Cynthia', username: 'Cynthia'}}}))
  await page.goto(`/register?ref=${inviterId}`)
  await expect(page.locator('.registration-invitation')).toHaveText('Invited by: Cynthia')
  await page.reload()
  await expect(page.locator('.registration-invitation')).toHaveText('Invited by: Cynthia')
})

test('invitation errors allow registration and retry without trusting a name supplied in the URL', async ({ page }) => {
  let unavailable = true
  await page.route('**/api/invitations/*', route => {
    return unavailable ? route.fulfill({status: 503, json: {error: 'Unavailable'}}) : route.fulfill({json: {inviter: {id: inviterId, name: '<img src=x onerror=alert(1)>', username: 'Cynthia'}}})
  })
  await page.goto(`/register?ref=${reference}&name=Forged`)
  const banner = page.locator('.registration-invitation')
  await expect(banner).toContainText('We couldn’t check this invitation.')
  unavailable = false
  await banner.getByRole('button', {name: 'Try again'}).click()
  await expect(banner).toContainText('<img src=x onerror=alert(1)>')
  await expect(banner.locator('img')).toHaveCount(0)
  await expect(banner).not.toContainText('Forged')
  await page.route('**/api/invitations/*', route => route.fulfill({status: 404, json: {error: 'Not found'}}))
  await page.reload()
  await expect(banner).toContainText('You can still create an account.')
  await expect(page.locator('button.auth-submit')).toBeEnabled()
  await page.goto('/register?ref=%3Cinvalid%3E')
  await expect(banner).toHaveCount(0)
  expect(await page.evaluate(() => sessionStorage.getItem('lipahub-invitation'))).toBeNull()
})
