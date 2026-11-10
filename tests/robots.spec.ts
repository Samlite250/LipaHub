import { selectCountry } from './helpers/country'
import { expect, test, type Page } from '@playwright/test'
import { mkdir } from 'node:fs/promises'

async function enterCountryDemo(page: Page, country: string) {
  await page.goto('/register')
  await selectCountry(page, country)
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await expect(page).toHaveURL('/dashboard')
  await expect(page.locator('.hello-badge')).toBeVisible()
}
async function changeCountry(page: Page, country: string) {
  await page.goto('/dashboard/profile')
  await selectCountry(page, country)
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status')).toContainText('Profile saved')
  await page.goto('/dashboard')
  await expect(page.locator('.hello-badge')).toBeVisible()
}
test('all non-Rwandan selections show 33 plans and Rwanda keeps its standard dashboard', async ({ page }) => {
  await enterCountryDemo(page, 'Rwanda')
  await expect(page.locator('.robot-card')).toHaveCount(0)
  await expect(page.getByText('RF 78,488')).toBeVisible()
  await page.goto('/dashboard/robots')
  await expect(page).toHaveURL('/dashboard')
  await expect(page.getByRole('link', { name: 'Robotic Plans', exact: true })).toHaveCount(0)
  for (const country of ['Burundi', 'Uganda', 'Kenya', 'South Africa', 'International']) {
    await changeCountry(page, country)
    await expect(page.getByRole('heading', { name: '33 robotic plans', exact: true })).toBeVisible()
    await expect(page.locator('.robot-card')).toHaveCount(33)
    await expect(page.locator('.robot-primary-cards .stat-card')).toHaveCount(4)
    await expect(page.locator('.dashboard-main')).not.toContainText(/\bdemo\b/i)
    for (const label of ['Active Plans', 'Received Bonuses', 'Total Activated Value', 'Available Funds']) {
      await expect(page.locator('.robot-primary-cards').getByRole('heading', { name: label, exact: true })).toBeVisible()
    }
    await expect(page.locator('.robot-region')).toHaveText(country)
    const expected: Record<string, [string, string]> = {
      Burundi: ['60,000 Fbu', '+261,000 Fbu'], Uganda: ['81,522 UGX', '+354,621 UGX'],
      Kenya: ['2,590.92 KES', '+11,270.50 KES'], 'South Africa': ['328.57 ZAR', '+1,429.29 ZAR'],
      International: ['19.96 USD', '+86.84 USD'],
    }
    await expect(page.getByTestId('robot-01').locator('.robot-price dd')).toHaveText(expected[country][0])
    await expect(page.getByTestId('robot-01').locator('.robot-bonus-box dd')).toHaveText(expected[country][1])
    await expect(page.locator('.robot-card button:not(:disabled)')).toHaveCount(33)
  }
  await changeCountry(page, 'Rwanda')
  await expect(page.locator('.robot-card')).toHaveCount(0)
})
test('all 33 Burundi plan values retain the supplied endpoints and generated midpoint', async ({ page }) => {
  await enterCountryDemo(page, 'Burundi')
  await expect(page.getByTestId('robot-01').locator('.robot-price dd')).toHaveText('60,000 Fbu')
  await expect(page.getByTestId('robot-01').locator('.robot-bonus-box dd')).toHaveText('+261,000 Fbu')
  await expect(page.getByTestId('robot-17').locator('.robot-price dd')).toHaveText('530,000 Fbu')
  await expect(page.getByTestId('robot-33').locator('.robot-bonus-box dd')).toHaveText('+8,000,000 Fbu')
  const values = (await page.locator('.robot-price dd').allTextContents()).map(value => Number(value.replace(/[^0-9]/g, '')))
  expect(values.every((value, index) => index === 0 || value > values[index - 1])).toBeTruthy()
})
test('restoring demo storage rejects unknown, duplicate and unaffordable activation IDs', async ({ page, request }) => {
  await enterCountryDemo(page, 'Burundi')
  await page.evaluate(() => {
    const profile = JSON.parse(sessionStorage.getItem('lipahub-demo')!)
    profile.robotIdsByCountry = { Burundi: ['robot-01', 'robot-01', 'unknown', 'robot-33', 'robot-32'], Kenya: ['not-a-robot'] }
    profile.bonus = 999999999
    profile.balance = 999999999
    sessionStorage.setItem('lipahub-demo', JSON.stringify(profile))
  })
  await page.reload()
  await expect(page.getByTestId('active-robot-count')).toHaveText('1 / 33')
  await expect(page.getByTestId('robot-bonus')).toHaveText('261,000 Fbu')
  await expect(page.getByTestId('robot-funds')).toHaveText('940,000 Fbu')
  await changeCountry(page, 'Kenya')
  await expect(page.getByTestId('active-robot-count')).toHaveText('0 / 33')
  expect((await request.post('http://127.0.0.1:3001/api/robots/robot-01/activate', { data: { country: 'Burundi', bonus: 261000 } })).status()).toBe(404)
  await page.goto('/login')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await changeCountry(page, 'Burundi')
  await expect(page.getByTestId('active-robot-count')).toHaveText('0 / 33')
})
test('robot filters, country dial codes and responsive preview work', async ({ page }, info) => {
  await page.goto('/register')
  await selectCountry(page, 'Burundi')
  await expect(page.locator('.iti__selected-country')).toContainText('+257')
  await selectCountry(page, 'International')
  await page.getByLabel('Telephone').fill('+33123456789')
  expect(await page.getByLabel('Telephone').evaluate(input => (input as HTMLInputElement).checkValidity())).toBeTruthy()
  await selectCountry(page, 'Burundi')
  await page.getByRole('button', { name: 'Explore the demo' }).click()
  await expect(page.locator('.robot-card')).toHaveCount(33)
  await page.getByLabel('Filter robots').selectOption('available')
  await expect(page.locator('.robot-card')).toHaveCount(33)
  await page.getByLabel('Search robots').fill('33')
  await expect(page.locator('.robot-card')).toHaveCount(1)
  await expect(page.getByTestId('robot-33')).toBeVisible()
  await page.getByLabel('Search robots').fill('not-a-plan')
  await expect(page.getByRole('heading', { name: 'No matching robots' })).toBeVisible()
  await page.getByRole('button', { name: 'Show all 33 plans', exact: true }).last().click()
  await page.getByLabel('Filter robots').selectOption('available')
  await mkdir(`artifacts/screenshots/${process.env.LIPAHUB_SCREENSHOT_RUN}`, { recursive: true })
  await page.locator('.robot-primary-cards').evaluate(element => element.scrollIntoView({ block: 'center' }))
  await page.screenshot({ path: `artifacts/screenshots/${process.env.LIPAHUB_SCREENSHOT_RUN}/${info.project.name}-burundi-robots.png`, fullPage: false, scale: 'css', animations: 'disabled' })
  await page.setViewportSize({ width: 320, height: 740 })
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
})
