import type { Page } from '@playwright/test'

export async function selectCountry(page: Page, country: string) {
  const field = page.getByLabel('Country')
  if (await field.evaluate(element => element.tagName === 'SELECT')) {
    await field.selectOption(country)
    return
  }
  await field.click()
  await page.getByRole('option', { name: country, exact: true }).click()
}
