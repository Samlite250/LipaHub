import { selectCountry } from './helpers/country'
import { expect, test } from '@playwright/test'
import { countries } from '../frontend/src/domain/countries'

const supported = [
  ['Kenya', '+254'], ['Uganda', '+256'], ['Tanzania', '+255'], ['Rwanda', '+250'],
  ['Burundi', '+257'], ['Malawi', '+265'], ['Cameroon', '+237'], ['Nigeria', '+234'],
  ['Ghana', '+233'], ['DR Congo', '+243'], ['Mozambique', '+258'], ['Botswana', '+267'],
  ['South Sudan', '+211'], ['Zambia', '+260'], ['Zimbabwe', '+263'], ['South Africa', '+27'],
]

test('registration synchronizes all supported countries and dialling codes', async ({ page }) => {
  await page.goto('/register')
  const country = page.getByLabel('Country', { exact: false })
  const dialling = page.locator('.iti__selected-country')
  await country.click()
  await expect(page.locator('.country-select-option')).toHaveCount(countries.length)
  await page.keyboard.press('Escape')
  for (const [name, code] of supported) {
    await selectCountry(page, name)
    await expect(dialling).toContainText(code)
    await expect(dialling).toHaveAttribute('title', name)
    await page.getByLabel('Telephone').fill('712345678')
    expect(await page.getByLabel('Telephone').evaluate((input: HTMLInputElement) => input.checkValidity())).toBeTruthy()
  }
  await dialling.click()
  await page.locator('.iti__country[data-iso2=ng]').click()
  await expect(country).toHaveValue('South Africa')
  await dialling.click()
  await expect(page.getByRole('listbox').getByRole('option')).toHaveCount(244)
  await page.locator('.iti__country[data-iso2=fr]').click()
  await expect(country).toHaveValue('South Africa')
  await page.getByLabel('Telephone').fill('612345678')
  expect(await page.getByLabel('Telephone').evaluate((input: HTMLInputElement) => input.checkValidity())).toBeTruthy()
  await page.setViewportSize({ width: 320, height: 740 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
})

test('a newly supported country persists as a named market through profile and dashboard', async ({ page }) => {
  await page.goto('/register')
  await page.locator('.iti__selected-country').click()
  await page.locator('.iti__country[data-iso2=cd]').click()
  await selectCountry(page, 'DR Congo')
  await page.getByRole('button', { name: 'Open practice workspace' }).click()
  await expect(page.locator('.robot-region')).toHaveText('DR Congo')
  await expect(page.locator('.robot-card')).toHaveCount(33)
  await page.goto('/dashboard/profile')
  await expect(page.getByLabel('Country')).toHaveValue('DR Congo')
  await selectCountry(page, 'Tanzania')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status')).toContainText('Profile saved')
  await page.reload()
  await expect(page.getByLabel('Country')).toHaveValue('Tanzania')
})


test('telephone dropdown supports keyboard dismissal, outside click, flags and translations', async ({ page }) => {
  await page.goto('/register')
  const trigger = page.locator('.iti__selected-country')
  await expect(trigger.locator('.iti__flag')).toHaveClass(/iti__rw/)
  await trigger.focus()
  await page.keyboard.press('Enter')
  await expect(trigger).toHaveAttribute('aria-expanded', 'true')
  await expect(page.locator('.iti__country[data-iso2=ro]')).toContainText('Romania')
  await page.keyboard.press('Escape')
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole('heading', { name: 'Get Started' }).click()
  await expect(trigger).toHaveAttribute('aria-expanded', 'false')
  await page.getByRole('button', { name: 'Kinyarwanda', exact: true }).click()
  await expect(page.getByLabel('Telephone')).toHaveAttribute('placeholder', 'Shyiramo nimero')
  await page.setViewportSize({ width: 320, height: 740 })
  await trigger.click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
})


test('calling code search filters Burundi and selects it with the keyboard', async ({ page }) => {
  await page.goto('/register')
  await page.locator('.iti__selected-country').click()
  const search = page.locator('.iti__search-input')
  await expect(search).toBeFocused()
  await search.fill('Burundi')
  const options = page.getByRole('listbox').getByRole('option')
  await expect(options).toHaveCount(1)
  await expect(options).toContainText('Burundi')
  await search.press('ArrowDown')
  await search.press('Enter')
  await expect(page.locator('.iti__selected-country')).toContainText('+257')
  await expect(page.getByLabel('Country')).toHaveValue('Rwanda')
  await page.locator('.iti__selected-country').click()
  await expect(search).toHaveValue('')
  await expect(options).toHaveCount(244)
})


test('Country includes worldwide selections and preserves them in the profile', async ({ page }) => {
  await page.goto('/register')
  const menu = page.getByLabel('Country')
  for (const country of ['France', 'United States', 'India', 'Australia', 'Brazil', 'Japan', 'Antarctica']) {
    await selectCountry(page, country)
    await expect(menu).toHaveValue(country)
  }
  await selectCountry(page, 'France')
  await page.getByRole('button', { name: 'Open practice workspace' }).click()
  await expect(page.locator('.robot-region')).toHaveText('France')
  await expect(page.locator('.robot-card')).toHaveCount(33)
  await page.goto('/dashboard/profile')
  await expect(page.getByLabel('Country')).toHaveValue('France')
  await selectCountry(page, 'Japan')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('status')).toContainText('Profile saved')
  await page.reload()
  await expect(page.getByLabel('Country')).toHaveValue('Japan')
})


test('Country dropdown has no search and matches telephone measurements', async ({ page }) => {
  await page.goto('/register')
  await page.locator('.iti__selected-country').click()
  const telephone = await page.locator('.iti__country-selector').boundingBox()
  const telephoneRow = await page.locator('.iti__country[data-iso2=rw]').boundingBox()
  await page.keyboard.press('Escape')
  const trigger = page.getByLabel('Country')
  await trigger.press('ArrowDown')
  const popup = page.locator('.country-select-popup')
  const list = popup.getByRole('listbox')
  await expect(list).toBeFocused()
  await expect(popup.locator('input')).toHaveCount(0)
  await expect(popup.getByRole('option')).toHaveCount(countries.length)
  const box = await popup.boundingBox()
  const row = await popup.getByRole('option', { name: 'Rwanda', exact: true }).boundingBox()
  expect(Math.abs(box!.width - telephone!.width)).toBeLessThanOrEqual(2)
  expect(row!.height).toBe(telephoneRow!.height)
  await list.press('Home')
  await list.press('Enter')
  await expect(trigger).toHaveValue('Afghanistan')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await list.press('Escape')
  await expect(trigger).toBeFocused()
  await trigger.click()
  await page.getByRole('heading', { name: 'Get Started' }).click()
  await expect(popup).toHaveCount(0)
  await page.setViewportSize({ width: 320, height: 740 })
  await trigger.click()
  const narrow = await popup.boundingBox()
  expect(narrow!.x).toBeGreaterThanOrEqual(0)
  expect(narrow!.x + narrow!.width).toBeLessThanOrEqual(320)
  await list.press('Tab')
  await expect(page.getByRole('checkbox')).toBeFocused()
})
