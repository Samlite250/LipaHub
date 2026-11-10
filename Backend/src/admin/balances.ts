import { authenticate, requireStorage, apiError } from '../auth.js'
import express, { type Router } from 'express'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { AdminInputError, adminCountries, text, uuid } from './validation.js'

export function balanceCountry(value: unknown) { if (typeof value !== 'string' || !adminCountries.includes(value)) throw new AdminInputError('Select a supported wallet country.'); return value }
export function balanceCurrency(country: string) { return ({ Rwanda: 'RWF', Burundi: 'BIF', Uganda: 'UGX', Kenya: 'KES', 'South Africa': 'ZAR', International: 'USD' } as Record<string, string>)[country] || 'USD' }
export function minorAmount(value: unknown, currency: string) {
  const digits = ['RWF', 'BIF', 'UGX'].includes(currency) ? 0 : 2
  if (typeof value !== 'string' || value.length > 16 || !(digits ? /^(0|[1-9]\d*)(\.\d{1,2})?$/ : /^(0|[1-9]\d*)$/).test(value)) throw new AdminInputError(`Enter a non-negative ${currency} amount with ${digits ? 'at most two decimal places' : 'no decimal places'}.`)
  const [whole, fraction = ''] = value.split('.')
  const minor = Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, '0'))
  if (!Number.isSafeInteger(minor) || minor > 1_000_000_000_000) throw new AdminInputError('The amount exceeds the supported account balance.')
  return minor
}
export function balanceInput(body: Record<string, unknown>) {
  const country = balanceCountry(body.country); const currency = balanceCurrency(country)
  if (!Number.isSafeInteger(body.version) || Number(body.version) < 0) throw new AdminInputError('Reload the wallet before making an adjustment.')
  return { country, availableMinor: minorAmount(body.available, currency), bonusMinor: minorAmount(body.bonus, currency), reason: text(body.reason, 'adjustment reason', 500, 10), version: Number(body.version), requestId: uuid(body.requestId) }
}
function failure(message: string, status: number): never { throw Object.assign(new Error(message), { status }) }
function storage(error: { code?: string } | null) { if (error) failure('Balance storage is unavailable. Apply the account-balances migration and check the server configuration.', 503) }
export function mapBalance(row: Record<string, unknown> | null, userId: string, country: string) {
  return { userId, country, currency: balanceCurrency(country), availableMinor: Number(row?.available_minor || 0), bonusMinor: Number(row?.bonus_minor || 0), version: Number(row?.version || 0), updatedAt: row?.updated_at || null }
}
function mapEntry(row: Record<string, unknown>) { return { id: row.id, userId: row.user_id, country: row.country, currency: row.currency, availableBefore: Number(row.available_before), availableAfter: Number(row.available_after), bonusBefore: Number(row.bonus_before), bonusAfter: Number(row.bonus_after), clearingDelta: Number(row.clearing_delta), reason: row.reason, actorId: row.actor_id, requestId: row.request_id, createdAt: row.created_at } }
async function wallet(db: SupabaseClient, userId: string, country: string) {
  const { data, error } = await db.from('system_balance_accounts').select('*').eq('user_id', userId).eq('country', country).maybeSingle()
  storage(error); return mapBalance(data, userId, country)
}
export function installAdminBalanceRoutes(router: Router, db: SupabaseClient | null) {
  router.get('/users/:id/balances', async (req, res) => {
    const userId = uuid(req.params.id); const country = balanceCountry(req.query.country)
    const { data, error } = await db!.auth.admin.getUserById(userId)
    if (error || !data.user) failure('User not found.', 404)
    const current = await wallet(db!, userId, country)
    const history = await db!.from('system_balance_adjustments').select('*').eq('user_id', userId).eq('country', country).order('created_at', { ascending: false }).limit(100)
    storage(history.error); res.json({ wallet: current, history: (history.data || []).map(mapEntry) })
  })
  router.post('/users/:id/balances', async (req, res) => {
    const userId = uuid(req.params.id); const input = balanceInput(req.body || {})
    const { data, error } = await db!.rpc('adjust_system_balance', { p_actor: (res.locals.user as User).id, p_user: userId, p_country: input.country, p_available: input.availableMinor, p_bonus: input.bonusMinor, p_reason: input.reason, p_version: input.version, p_request: input.requestId })
    if (error?.code === '40001') failure('This balance changed. Reload it before submitting another adjustment.', 409)
    if (error?.code === '23505') failure('This request was already used with different adjustment details.', 409)
    if (error?.code === '22023') failure('The adjustment is invalid or does not change the balance.', 400)
    if (error?.code === '23503') failure('User not found.', 404)
    if (error?.code === '42501') failure('Administrator access required.', 403)
    storage(error); res.json(mapBalance(data, userId, input.country))
  })
}
export function memberBalanceRouter(auth: SupabaseClient | null, service?: SupabaseClient | null) {
  const router = express.Router()
  const db = service === undefined ? process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null : service
  router.use(authenticate(auth), requireStorage(db))
  router.get('/', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    const user = res.locals.user as User
    try {
      const country = balanceCountry(req.query.country)
      const current = await wallet(db!, user.id, country)
      if (req.query.history === 'true') {
        const history = await db!.from('system_balance_adjustments').select('*').eq('user_id', user.id).eq('country', country).order('created_at', { ascending: false }).limit(100)
        storage(history.error)
        res.json({ wallet: current, history: (history.data || []).map(row => {
          const entry = mapEntry(row)
          return { id: entry.id, country: entry.country, currency: entry.currency, availableBefore: entry.availableBefore, availableAfter: entry.availableAfter, bonusBefore: entry.bonusBefore, bonusAfter: entry.bonusAfter, createdAt: entry.createdAt }
        }) })
      } else res.json(current)
    } catch (error) { const err = error as Error & { status?: number }; res.status(err.status || 503).json({ error: err.status && err.status < 500 ? err.message : 'Account balances are unavailable. Please try again later.' }) }
  })
  router.use(apiError('Account balances are unavailable.'))
  return router
}
