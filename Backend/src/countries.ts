import { existsSync, readFileSync } from 'node:fs'

const source = new URL('../../shared/countries.json', import.meta.url)
const data: { name: string; iso2: string; dialCode: string }[] = JSON.parse(readFileSync(existsSync(source) ? source : new URL('./config/countries.json', import.meta.url), 'utf8'))
export const countries = [...data.map(country => country.name), 'International']
