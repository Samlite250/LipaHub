import { countries, hasRobotDashboard, normalizeCountry, type Country } from './countries'
import catalog from '../../../shared/robot-catalog.json' with { type: 'json' }
const fx = catalog.fx

export type Robot = { id: string; name: string; number: number; color: string }
export type Currency = keyof typeof fx.rates
export type RobotTerms = { value: number; bonus: number; valueMinor: number; bonusMinor: number; currency: Currency }
export type RobotActivations = Partial<Record<Country, string[]>>
export const ROBOT_CATALOG_VERSION = catalog.version
export const ROBOT_FX_REFERENCE = fx
export const ROBOT_CATALOG: Robot[] = Array.from({ length: 33 }, (_, index) => ({
  id: `robot-${String(index + 1).padStart(2, '0')}`,
  name: `Robot ${String(index + 1).padStart(2, '0')}`,
  number: index + 1,
  color: ['teal', 'blue', 'violet', 'indigo', 'pink', 'amber'][index % 6],
}))

const MARKET_CURRENCIES: Partial<Record<Country, Currency>> = {
  Burundi: 'BIF', Uganda: 'UGX', Kenya: 'KES', 'South Africa': 'ZAR', International: 'USD',
  'Tanzania': 'USD', 'Malawi': 'USD', 'Cameroon': 'USD', 'Nigeria': 'USD', 'Ghana': 'USD', 'DR Congo': 'USD', 'Mozambique': 'USD', 'Botswana': 'USD', 'South Sudan': 'USD', 'Zambia': 'USD', 'Zimbabwe': 'USD',
}
export function currencyDigits(currency: Currency): number { return currency === 'BIF' || currency === 'UGX' ? 0 : 2 }

// Uganda and Burundi carry explicit owner-supplied plan tables. Other markets
// interpolate the BIF endpoints and convert once to minor units.
const COUNTRY_PLANS = catalog.plans as Partial<Record<Country, readonly { value: number; bonus: number }[]>>
export function getRobotTerms(id: string, country: unknown): RobotTerms | null {
  const robot = ROBOT_CATALOG.find(robot => robot.id === id)
  const region = normalizeCountry(country)
  const currency = region && region !== 'Rwanda' ? MARKET_CURRENCIES[region] || 'USD' : null
  if (!robot || !currency) return null
  const factor = 10 ** currencyDigits(currency)
  const plan = region ? COUNTRY_PLANS[region]?.[robot.number - 1] : undefined
  if (plan) {
    const valueMinor = Math.round(plan.value * factor)
    const bonusMinor = Math.round(plan.bonus * factor)
    return { currency, valueMinor, bonusMinor, value: valueMinor / factor, bonus: bonusMinor / factor }
  }
  const fraction = (robot.number - 1) / 32
  const baseValue = Math.round(catalog.minimumValue + fraction * (catalog.maximumValue - catalog.minimumValue))
  const baseBonus = Math.round(catalog.minimumBonus + fraction * (catalog.maximumBonus - catalog.minimumBonus))
  const valueMinor = Math.round(baseValue * fx.rates[currency] * factor)
  const bonusMinor = Math.round(baseBonus * fx.rates[currency] * factor)
  return { currency, valueMinor, bonusMinor, value: valueMinor / factor, bonus: bonusMinor / factor }
}
export function robotMarket(country: unknown) {
  const region = normalizeCountry(country)
  const currency = region && region !== 'Rwanda' ? MARKET_CURRENCIES[region] || 'USD' : null
  const startingBalanceMinor = getRobotTerms('robot-33', country)?.valueMinor || 0
  const factor = currency ? 10 ** currencyDigits(currency) : 1
  return { country: region, currency, startingBalanceMinor, startingBalance: startingBalanceMinor / factor }
}
export function formatRobotMoney(value: number, country: unknown): string {
  const currency = robotMarket(country).currency
  if (!currency) return 'Not available'
  return `${formatRobotAmount(value, country)} ${currency === 'BIF' ? 'Fbu' : currency}`
}
export function formatRobotAmount(value: number, country: unknown): string {
  const currency = robotMarket(country).currency
  const digits = currency ? currencyDigits(currency) : 0
  return value.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
export function robotWallet(ids: readonly string[], country: unknown) {
  const active = ROBOT_CATALOG.filter(robot => ids.includes(robot.id) && getRobotTerms(robot.id, country))
  const market = robotMarket(country)
  const factor = market.currency ? 10 ** currencyDigits(market.currency) : 1
  const spentMinor = active.reduce((sum, robot) => sum + getRobotTerms(robot.id, country)!.valueMinor, 0)
  const bonusMinor = active.reduce((sum, robot) => sum + getRobotTerms(robot.id, country)!.bonusMinor, 0)
  const availableMinor = market.startingBalanceMinor - spentMinor
  return { active, spentMinor, bonusMinor, availableMinor, spent: spentMinor / factor, bonus: bonusMinor / factor, available: availableMinor / factor }
}

// Local demo transition only. A one-time simulated bonus is recorded per plan.
// Bonuses are kept separate and cannot fund another activation.
export function activateRobot(ids: readonly string[], robotId: string, country: unknown): string[] {
  const robot = ROBOT_CATALOG.find(robot => robot.id === robotId)
  const terms = getRobotTerms(robotId, country)
  if (!hasRobotDashboard(country) || !robot || !terms || ids.includes(robotId) || robotWallet(ids, country).availableMinor < terms.valueMinor) return [...ids]
  return [...ids, robotId]
}
export function restoreRobotActivations(value: unknown): RobotActivations {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: RobotActivations = {}
  for (const country of countries) {
    const ids = (value as Record<string, unknown>)[country]
    if (!Array.isArray(ids)) continue
    result[country] = ids.reduce<string[]>((active, id) => typeof id === 'string' ? activateRobot(active, id, country) : active, [])
  }
  return result
}
