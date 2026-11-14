import { existsSync, readFileSync } from 'node:fs'

type Catalog = { version: string; count: number; minimumValue: number; maximumValue: number; minimumBonus: number; maximumBonus: number; plans?: Record<string, { value: number; bonus: number }[]>; currencies: Record<string, string>; fx: { date: string; rates: Record<string, number> } }
const sourceCatalog = new URL('../../../shared/robot-catalog.json', import.meta.url)
const catalog: Catalog = JSON.parse(readFileSync(existsSync(sourceCatalog) ? sourceCatalog : new URL('../config/robot-catalog.json', import.meta.url), 'utf8'))
const sourceLimits = new URL('../../../shared/proof-limits.json', import.meta.url)
export const proofLimits: { maxFiles: number; maxFileBytes: number; maxTotalBytes: number } = JSON.parse(readFileSync(existsSync(sourceLimits) ? sourceLimits : new URL('../config/proof-limits.json', import.meta.url), 'utf8'))
export { countries } from '../countries.js'
import { countries } from '../countries.js'
export class InputError extends Error { status = 400 }
export function text(value: unknown, label: string, max: number, min = 0): string {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max || [...value].some(char => char.charCodeAt(0) < 32 && ![9, 10, 13].includes(char.charCodeAt(0)))) throw new InputError(`Invalid ${label}.`)
  return value.trim()
}
export function country(value: unknown): string { if (typeof value !== 'string' || !countries.includes(value)) throw new InputError('Invalid country.'); return value }
export function quote(planId: unknown, region: string) {
  if (typeof planId !== 'string' || !/^robot-(0[1-9]|[12][0-9]|3[0-3])$/.test(planId) || !Object.hasOwn(catalog.currencies, region)) throw new InputError('Plan is unavailable for this country.')
  const currency = catalog.currencies[region]
  const number = Number(planId.slice(-2))
  const factor = ['BIF', 'UGX'].includes(currency) ? 1 : 100
  const plan = catalog.plans?.[region]?.[number - 1]
  if (plan) {
    const valueMinor = Math.round(plan.value * factor)
    const bonusMinor = Math.round(plan.bonus * factor)
    return { value: valueMinor / factor, bonus: bonusMinor / factor, valueMinor, bonusMinor, currency, rateDate: catalog.fx.date, catalogVersion: catalog.version }
  }
  const fraction = (number - 1) / (catalog.count - 1)
  const valueMinor = Math.round(Math.round(catalog.minimumValue + fraction * (catalog.maximumValue - catalog.minimumValue)) * catalog.fx.rates[currency] * factor)
  const bonusMinor = Math.round(Math.round(catalog.minimumBonus + fraction * (catalog.maximumBonus - catalog.minimumBonus)) * catalog.fx.rates[currency] * factor)
  return { value: valueMinor / factor, bonus: bonusMinor / factor, valueMinor, bonusMinor, currency, rateDate: catalog.fx.date, catalogVersion: catalog.version }
}
export function defaultMethods(region: string) {
  const names = region === 'Burundi' ? ['Lumicash', 'Code'] : region === 'Rwanda' ? ['MTN', 'Airtel'] : region === 'Uganda' ? ['MTN Uganda', 'Airtel'] : region === 'Kenya' ? ['Mpesa', 'Airtel'] : ['Binance TRC']
  return names.map((name, index) => ({ id: `${region.toLowerCase().replaceAll(' ', '-')}-${index + 1}`, name, recipient: '', accountName: '', asset: '', network: name === 'Binance TRC' ? 'TRC' : '', instructions: '', enabled: false }))
}
export function instructions(input: Record<string, unknown>, region: string) {
  const expected = defaultMethods(region)
  if (!Number.isInteger(input.version) || Number(input.version) < 0 || !Array.isArray(input.methods) || input.methods.length !== expected.length) throw new InputError('Invalid instruction version or methods.')
  const methods = expected.map(template => {
    const method = (input.methods as Record<string, unknown>[]).find(method => method && method.id === template.id)
    if (!method || method.name !== template.name || typeof method.enabled !== 'boolean') throw new InputError('Invalid payment method.')
    const next = { ...template, recipient: text(method.recipient, 'recipient', 200), accountName: text(method.accountName, 'recipient name', 120), asset: text(method.asset, 'asset', 40), network: text(method.network, 'network', 80), instructions: text(method.instructions, 'instructions', 4000), enabled: method.enabled }
    const amountMinor = region === 'Rwanda' ? method.amountMinor : undefined
    if (region === 'Rwanda' && next.enabled && (!Number.isSafeInteger(amountMinor) || Number(amountMinor) < 1 || Number(amountMinor) > 999999999999 || !next.recipient)) throw new InputError('Published Rwanda methods require the activation amount in RWF and recipient details.')
    if (next.enabled && (next.instructions.length < 10 || (region !== 'Rwanda' && !next.recipient) || (next.name === 'Binance TRC' && (!next.asset || !next.network)))) throw new InputError('Published methods require complete recipient, payment and crypto network instructions.')
    return region === 'Rwanda' ? {...next, amountMinor: Number.isSafeInteger(amountMinor) ? Number(amountMinor) : null} : next
  })
  return { version: Number(input.version), methods }
}
export function screenshot(input: unknown) {
  if (!input || typeof input !== 'object') throw new InputError('Invalid screenshot.')
  const file = input as Record<string, unknown>
  const name = text(file.name, 'screenshot name', 180, 1)
  if (!['image/png', 'image/jpeg'].includes(String(file.type)) || typeof file.contentBase64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(file.contentBase64) || file.contentBase64.length > Math.ceil(proofLimits.maxFileBytes / 3) * 4) throw new InputError('Screenshots must be PNG or JPEG images of 3 MB or less.')
  const bytes = Buffer.from(file.contentBase64, 'base64')
  if (!bytes.length || bytes.length > proofLimits.maxFileBytes || bytes.toString('base64') !== file.contentBase64) throw new InputError('Invalid screenshot encoding or size.')
  let width = 0; let height = 0
  if (file.type === 'image/png') {
    if (bytes.length < 33 || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) || bytes.toString('ascii', 12, 16) !== 'IHDR') throw new InputError('Invalid PNG screenshot.')
    width = bytes.readUInt32BE(16); height = bytes.readUInt32BE(20)
  } else {
    if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255 || bytes[bytes.length - 2] !== 255 || bytes[bytes.length - 1] !== 217) throw new InputError('Invalid JPEG screenshot.')
    let offset = 2
    while (offset + 4 <= bytes.length) {
      if (bytes[offset] !== 255) break
      const marker = bytes[offset + 1]; const length = bytes.readUInt16BE(offset + 2)
      if (length < 2 || offset + length + 2 > bytes.length) break
      if ([192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker) && length >= 8) { height = bytes.readUInt16BE(offset + 5); width = bytes.readUInt16BE(offset + 7); break }
      offset += length + 2
    }
  }
  if (width < 1 || height < 1 || width > 12000 || height > 12000 || width * height > 20000000) throw new InputError('Screenshot dimensions are invalid or too large.')
  return { name, type: String(file.type), bytes, extension: file.type === 'image/png' ? 'png' : 'jpg' }
}
