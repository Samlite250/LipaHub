import { authenticate, requireAdmin, requireStorage, apiError } from '../auth.js'
import express from 'express'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { uuid } from '../admin/validation.js'
import { cancellationInput, reviewInput, withdrawalInput } from './validation.js'

type Row = Record<string, unknown>
function fail(message: string, status = 500): never { throw Object.assign(new Error(message), { status }) }
function databaseError(error: { code?: string } | null) {
  if (!error) return
  if (error.code === '42501') fail('This withdrawal action is not permitted.', 403)
  if (error.code === 'P0002') fail('Withdrawal not found.', 404)
  if (error.code === '23503') fail('User not found.', 404)
  if (['22023', '23514', '23502'].includes(error.code || '')) fail('Invalid withdrawal details or balance.', 400)
  if (['23505', '40001'].includes(error.code || '')) fail('This withdrawal changed or the request was already used. Reload before continuing.', 409)
  fail('Withdrawal storage is unavailable. Check the server configuration and migration.', 503)
}
export function mapWithdrawal(row: Row) {
  return {
    id: row.id, userId: row.user_id, country: row.country, currency: row.currency, channel: row.channel,
    amountMinor: Number(row.amount_minor), destination: row.destination, status: row.status, version: Number(row.version),
    note: row.review_note || '', decidedBy: row.decided_by || null, decidedAt: row.decided_at || null, paidAt: row.paid_at || null,
    createdAt: row.created_at, updatedAt: row.updated_at,
  }
}
export function withdrawalRouter(auth: SupabaseClient | null, service?: SupabaseClient | null, intakeEnabled?: boolean) {
  const router = express.Router()
  const enabled = intakeEnabled ?? (process.env.WITHDRAWAL_REQUESTS_ENABLED === 'true')
  const db = service === undefined ? process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null : service
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
  router.use(authenticate(auth), requireStorage(db))
  router.get('/', async (_req, res) => {
    const user = res.locals.user as User
    const { data, error } = await db!.from('withdrawal_requests').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100)
    databaseError(error); res.json((data || []).map(mapWithdrawal))
  })
  router.post('/', (_req, res, next) => {
    if (!enabled) { res.status(503).json({ error: 'Withdrawal requests are disabled' }); return }
    next()
  }, express.json({ limit: '8kb' }), async (req, res) => {
    const user = res.locals.user as User
    const input = withdrawalInput(req.body || {})
    const { data, error } = await db!.rpc('request_withdrawal', { p_actor: user.id, p_payload: { id: input.id, country: input.country, channel: input.channel, amountMinor: input.amountMinor, destination: input.destination } })
    databaseError(error); res.status(201).json(mapWithdrawal(data as Row))
  })
  router.post('/:id/cancel', express.json({ limit: '4kb' }), async (req, res) => {
    const user = res.locals.user as User
    const input = cancellationInput(req.body || {})
    const { data, error } = await db!.rpc('cancel_withdrawal', { p_actor: user.id, p_id: uuid(req.params.id), p_note: input.note, p_expected_version: input.version })
    databaseError(error); res.json(mapWithdrawal(data as Row))
  })
  router.get('/admin/requests', requireAdmin, async (_req, res) => {
    const { data, error } = await db!.from('withdrawal_requests').select('*').order('created_at', { ascending: false }).limit(200)
    databaseError(error); res.json((data || []).map(mapWithdrawal))
  })
  router.patch('/admin/requests/:id', requireAdmin, express.json({ limit: '8kb' }), async (req, res) => {
    const user = res.locals.user as User
    const input = reviewInput(req.body || {})
    const { data, error } = await db!.rpc('review_withdrawal', { p_id: uuid(req.params.id), p_status: input.status, p_note: input.note, p_actor: user.id, p_expected_version: input.version })
    databaseError(error); res.json(mapWithdrawal(data as Row))
  })
  router.use(apiError('Unable to complete this withdrawal request.'))
  return router
}
