import { normalizeCountry, type Country } from './countries'
import { robotWallet } from './robots'

export type WalletCurrency = 'RWF' | 'BIF' | 'UGX' | 'KES' | 'ZAR' | 'USD'
export type AccountBalance = { userId: string; country: Country; currency: WalletCurrency; availableMinor: number; bonusMinor: number; version: number; updatedAt: string | null }
export type BalanceEntry = { id: string; userId: string; country: Country; currency: WalletCurrency; availableBefore: number; availableAfter: number; bonusBefore: number; bonusAfter: number; clearingDelta: number; reason: string; actorId: string; requestId: string; createdAt: string }
export type BalanceView = { wallet: AccountBalance; history: BalanceEntry[] }
export type BalanceAdjustment = { country: Country; available: string; bonus: string; reason: string; version: number; requestId: string }
export function walletCurrency(country: Country): WalletCurrency { return ({ Rwanda: 'RWF', Burundi: 'BIF', Uganda: 'UGX', Kenya: 'KES', 'South Africa': 'ZAR', International: 'USD' } as Partial<Record<Country, WalletCurrency>>)[country] || 'USD' }
export function walletDigits(currency: WalletCurrency) { return ['RWF', 'BIF', 'UGX'].includes(currency) ? 0 : 2 }
export function parseWalletAmount(value: string, currency: WalletCurrency): number {
  const digits = walletDigits(currency)
  if (!(digits ? /^(0|[1-9]\d*)(\.\d{1,2})?$/ : /^(0|[1-9]\d*)$/).test(value)) throw new Error(`Enter a non-negative amount with ${digits ? 'at most two decimal places' : 'no decimal places'} for ${currency}.`)
  const [whole, fraction = ''] = value.split('.')
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'))
  if (!Number.isSafeInteger(minor) || minor > 1_000_000_000_000) throw new Error('The amount exceeds the supported account balance.')
  return minor
}
export function walletInput(minor: number, currency: WalletCurrency) { return (minor / 10 ** walletDigits(currency)).toFixed(walletDigits(currency)) }
export function walletMoney(minor: number, currency: WalletCurrency) {
  const digits = walletDigits(currency); const number = (minor / 10 ** digits).toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return currency === 'RWF' ? `RF ${number}` : `${number} ${currency === 'BIF' ? 'Fbu' : currency}`
}
export function emptyBalance(userId: string, country: Country): AccountBalance { return { userId, country, currency: walletCurrency(country), availableMinor: 0, bonusMinor: 0, version: 0, updatedAt: null } }
export function demoBalance(userId: string, country: Country, ids: readonly string[] = []): AccountBalance {
  const legacy = robotWallet(ids, country)
  return { ...emptyBalance(userId, country), availableMinor: country === 'Rwanda' ? 6800 : legacy.availableMinor, bonusMinor: country === 'Rwanda' ? 0 : legacy.bonusMinor }
}
export function storedDemoBaseline(userId: string, country: Country) {
  try {
    const profile = JSON.parse(sessionStorage.getItem('lipahub-demo') || 'null')
    const ids = profile?.id === userId && normalizeCountry(profile.country) && Array.isArray(profile.robotIdsByCountry?.[country]) ? profile.robotIdsByCountry[country].filter((id: unknown) => typeof id === 'string') : []
    return demoBalance(userId, country, ids)
  } catch { return demoBalance(userId, country) }
}
