import { authenticate, requireStorage, apiError } from '../auth.js'
import express from 'express'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { AdminInputError, text, uuid, version } from '../admin/validation.js'

function fail(message: string, status: number): never { throw Object.assign(new Error(message), { status }) }
function check(error: { code?: string } | null) {
  if (!error) return
  if (error.code === '42501') fail('You cannot access this support request.', 403)
  if (error.code === 'P0002') fail('Support request not found.', 404)
  if (['40001', '23505'].includes(error.code || '')) fail('This request changed. Refresh before trying again.', 409)
  if (error.code === '22023') fail('This support request is invalid or closed.', 400)
  fail('Support storage is unavailable. Please try again later.', 503)
}
export function supportRouter(auth: SupabaseClient | null, service?: SupabaseClient | null) {
  const router = express.Router()
  const db = service === undefined ? process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null : service
  router.use(authenticate(auth), requireStorage(db), express.json({ limit: '16kb' }))
  router.get('/', async (_req, res) => {
    const user = res.locals.user as User
    let query = db!.from('support_tickets').select('*')
    if (user.app_metadata.role !== 'admin') query = query.eq('user_id', user.id)
    const { data, error } = await query.order('updated_at', { ascending: false }).limit(100)
    check(error); res.json(data || [])
  })
  router.get('/:id', async (req, res) => {
    const user = res.locals.user as User
    let query = db!.from('support_tickets').select('*').eq('id', uuid(req.params.id))
    if (user.app_metadata.role !== 'admin') query = query.eq('user_id', user.id)
    const { data: ticket, error } = await query.maybeSingle()
    check(error); if (!ticket) fail('Support request not found.', 404)
    const messages = await db!.from('support_messages').select('id,ticket_id,body,author_role,created_at').eq('ticket_id', ticket.id).order('created_at', { ascending: true }).limit(500)
    check(messages.error); res.json({ ticket, messages: messages.data || [] })
  })
  router.post('/', async (req, res) => {
    const body = req.body || {}
    const { data, error } = await db!.rpc('create_support_ticket', { p_actor: (res.locals.user as User).id, p_id: uuid(body.requestId), p_subject: text(body.subject, 'subject', 160, 3), p_body: text(body.message, 'message', 4000, 10) })
    check(error); res.status(201).json(data)
  })
  router.post('/:id/messages', async (req, res) => {
    const body = req.body || {}
    const { data, error } = await db!.rpc('reply_support_ticket', { p_actor: (res.locals.user as User).id, p_ticket: uuid(req.params.id), p_id: uuid(body.requestId), p_body: text(body.message, 'message', 4000, 1), p_version: version(body.version) })
    check(error); res.status(201).json(data)
  })
  router.patch('/:id', async (req, res) => {
    const user = res.locals.user as User
    if (user.app_metadata.role !== 'admin') fail('Administrator access required.', 403)
    if (!['open', 'closed'].includes(req.body?.status)) throw new AdminInputError('Select an open or closed status.')
    const { data, error } = await db!.rpc('set_support_ticket_status', { p_actor: user.id, p_ticket: uuid(req.params.id), p_status: req.body.status, p_version: version(req.body.version) })
    check(error); res.json(data)
  })
  router.use(apiError('Unable to complete this support request.'))
  return router
}
