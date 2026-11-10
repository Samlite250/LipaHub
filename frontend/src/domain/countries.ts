import countryData from '../../../shared/countries.json' with { type: 'json' }

export const countries = [...countryData.map(country => country.name), 'International']
export type Country = typeof countries[number]

export function normalizeCountry(value: unknown): Country | null {
  if (typeof value !== 'string' || !value.trim()) return null
  const normalized = value.trim().toLowerCase()
  const aliases: Record<string, Country> = {"ke": "Kenya", "ug": "Uganda", "tz": "Tanzania", "rw": "Rwanda", "bi": "Burundi", "mw": "Malawi", "cm": "Cameroon", "ng": "Nigeria", "gh": "Ghana", "cd": "DR Congo", "mz": "Mozambique", "bw": "Botswana", "ss": "South Sudan", "zm": "Zambia", "zw": "Zimbabwe", "za": "South Africa", "ken": "Kenya", "uga": "Uganda", "tza": "Tanzania", "rwa": "Rwanda", "bdi": "Burundi", "mwi": "Malawi", "cmr": "Cameroon", "nga": "Nigeria", "gha": "Ghana", "cod": "DR Congo", "moz": "Mozambique", "bwa": "Botswana", "ssd": "South Sudan", "zmb": "Zambia", "zwe": "Zimbabwe", "zaf": "South Africa", "drc": "DR Congo", "democratic republic of the congo": "DR Congo", "congo (democratic republic)": "DR Congo"}
  return countryData.find(country => country.iso2 === normalized)?.name || (Object.hasOwn(aliases, normalized) ? aliases[normalized] : null) || countries.find(country => country.toLowerCase() === normalized) || 'International'
}

// Presentation policy only. A selected country is never financial authorization.
export function hasRobotDashboard(value: unknown): boolean {
  const country = normalizeCountry(value)
  return country !== null && country !== 'Rwanda'
}

export function dialCode(value: string): string {
  const country = normalizeCountry(value)
  return countryData.find(item => item.name === country)?.dialCode || ''
}

export function formatPhone(country: string, phone: string): string {
  const clean = phone.replace(/\s/g, '')
  const prefix = dialCode(country)
  return prefix ? prefix + clean.replace(/^0/, '') : clean
}
