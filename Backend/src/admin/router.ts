import { authenticate, requireAdmin, requireStorage, apiError } from '../auth.js'
import express from 'express'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { AdminInputError, adminCountries, recordInput, settingsInput, userInput, uuid, version } from './validation.js'
import { installAdminBalanceRoutes } from './balances.js'

function fail(message: string, status: number): never { throw Object.assign(new Error(message), { status }) }
function check(error: { code?: string } | null) { if (error) fail(error.code === '23505' ? 'This record already exists.' : 'Admin storage is unavailable. Check the server configuration and admin migration.', error.code === '23505' ? 409 : 503) }
function safeUser(user: User) {
  return { id: user.id, email: user.email || '', phone: typeof user.user_metadata.phone === 'string' ? user.user_metadata.phone : '', name: typeof user.user_metadata.display_name === 'string' ? user.user_metadata.display_name : '', country: adminCountries.includes(user.user_metadata.country) ? user.user_metadata.country : 'International', role: user.app_metadata.role === 'admin' ? 'admin' : 'member', status: user.banned_until && Date.parse(user.banned_until) > Date.now() ? 'suspended' : 'active', createdAt: user.created_at, updatedAt: user.updated_at || user.created_at, lastSignInAt: user.last_sign_in_at || null }
}
function safeRecord(row: Record<string, unknown>) { return { id: row.id, collection: row.collection, title: row.title, description: row.description, category: row.category, status: row.status, url: row.url, country: row.country, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at } }
const defaults = { siteName: 'LipaHub', supportEmail: '', supportMessage: '', showAnnouncements: true }
export function adminRouter(auth: SupabaseClient | null, service?: SupabaseClient | null) {
  const router = express.Router()
  const db = service === undefined ? process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null : service
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
  router.use(authenticate(auth), requireAdmin, requireStorage(db), express.json({ limit: '24kb' }))
  installAdminBalanceRoutes(router, db)
  async function audited<T>(actor: string, action: string, target: string, operation: () => Promise<T>) {
    const { data, error } = await db!.from('system_admin_audit').insert({ actor_id: actor, action, target_id: target, outcome: 'started' }).select('id').single()
    check(error)
    try {
      const value = await operation()
      // Auth and Postgres are separate services. A started record remains if finalization fails.
      await db!.from('system_admin_audit').update({ outcome: 'succeeded' }).eq('id', data!.id)
      return value
    } catch (error) { await db!.from('system_admin_audit').update({ outcome: 'failed' }).eq('id', data!.id); throw error }
  }
  router.get('/users', async (req, res) => {
    const page = Number(req.query.page || 1)
    if (!Number.isInteger(page) || page < 1 || page > 100000) throw new AdminInputError('Invalid page.')
    const { data, error } = await db!.auth.admin.listUsers({ page, perPage: 50 })
    if (error) fail('Unable to load users.', 503)
    res.json({ users: data.users.map(safeUser), page, hasMore: data.users.length === 50 })
  })
  router.get('/users/:id', async (req, res) => {
    const { data, error } = await db!.auth.admin.getUserById(uuid(req.params.id))
    if (error || !data.user) fail('User not found.', 404)
    res.json(safeUser(data.user))
  })
  router.post('/users', async (req, res) => {
    const input = userInput(req.body || {}, true)
    const value = await audited((res.locals.user as User).id, 'users.create', input.email, async () => {
      const { data, error } = await db!.auth.admin.createUser({ email: input.email, password: req.body.password, email_confirm: false, user_metadata: { display_name: input.name, country: input.country, phone: input.phone }, app_metadata: { role: input.role }, ban_duration: input.status === 'suspended' ? '876000h' : 'none' })
      if (error || !data.user) fail('Unable to create user. The email may already exist or the password may not meet the project policy.', 400)
      return safeUser(data.user)
    })
    res.status(201).json(value)
  })
  router.put('/users/:id', async (req, res) => {
    const id = uuid(req.params.id); const input = userInput(req.body || {})
    const actor = res.locals.user as User
    if (id === actor.id && (input.role !== 'admin' || input.status !== 'active')) fail('You cannot remove your own administrator access or suspend yourself.', 409)
    const value = await audited(actor.id, 'users.update', id, async () => {
      const { data: current, error: readError } = await db!.auth.admin.getUserById(id)
      if (readError || !current.user) fail('User not found.', 404)
      if (req.body?.updatedAt !== (current.user.updated_at || current.user.created_at)) fail('This user changed. Reload before saving.', 409)
      const { data, error } = await db!.auth.admin.updateUserById(id, { email: input.email, user_metadata: { ...current.user.user_metadata, display_name: input.name, country: input.country, phone: input.phone }, app_metadata: { ...current.user.app_metadata, role: input.role }, ban_duration: input.status === 'suspended' ? '876000h' : 'none' })
      if (error || !data.user) fail('Unable to update user. Check the email and project policy.', 400)
      return safeUser(data.user)
    })
    res.json(value)
  })
  router.delete('/users/:id', async (req, res) => {
    const id = uuid(req.params.id); const actor = res.locals.user as User
    if (id === actor.id) fail('You cannot delete your own administrator account.', 409)
    await audited(actor.id, 'users.delete', id, async () => {
      const { data, error } = await db!.auth.admin.getUserById(id)
      if (error || !data.user) fail('User not found.', 404)
      if (req.body?.confirmEmail !== data.user.email || req.body?.updatedAt !== (data.user.updated_at || data.user.created_at)) fail('The confirmation or user version changed. Reload and try again.', 409)
      const { error: deleteError } = await db!.auth.admin.deleteUser(id)
      if (deleteError) fail('Unable to delete this user. Accounts linked to balance, payment or audit records must be suspended to preserve their history.', 409)
    })
    res.status(204).end()
  })
  router.get('/records/:collection', async (req, res) => {
    if (!['resources', 'announcements'].includes(String(req.params.collection))) throw new AdminInputError('Unknown collection.')
    const { data, error } = await db!.from('system_content').select('*').eq('collection', req.params.collection).order('updated_at', { ascending: false }).limit(500)
    check(error); res.json((data || []).map(safeRecord))
  })
  router.post('/records/:collection', async (req, res) => {
    const value = recordInput(req.body || {}, String(req.params.collection))
    const { data, error } = await db!.rpc('manage_system_content', { p_actor: (res.locals.user as User).id, p_action: 'create', p_id: null, p_collection: req.params.collection, p_version: 0, p_value: value })
    check(error); res.status(201).json(safeRecord(data))
  })
  router.put('/records/:collection/:id', async (req, res) => {
    const value = recordInput(req.body || {}, String(req.params.collection))
    const { data, error } = await db!.rpc('manage_system_content', { p_actor: (res.locals.user as User).id, p_action: 'update', p_id: uuid(req.params.id), p_collection: req.params.collection, p_version: version(req.body.version), p_value: value })
    if (error?.code === '40001') fail('This record changed. Reload before saving.', 409)
    check(error); res.json(safeRecord(data))
  })
  router.delete('/records/:collection/:id', async (req, res) => {
    if (!['resources', 'announcements'].includes(String(req.params.collection))) throw new AdminInputError('Unknown collection.')
    const { error } = await db!.rpc('manage_system_content', { p_actor: (res.locals.user as User).id, p_action: 'delete', p_id: uuid(req.params.id), p_collection: req.params.collection, p_version: version(req.body?.version), p_value: {} })
    if (error?.code === '40001') fail('This record changed. Reload before deleting.', 409)
    check(error); res.status(204).end()
  })
  router.get('/settings', async (_req, res) => {
    const { data, error } = await db!.from('system_settings').select('*').eq('id', 'general').single()
    check(error); res.json({ ...data.value, version: data.version })
  })
  router.put('/settings', async (req, res) => {
    const value = settingsInput(req.body || {})
    const { data, error } = await db!.rpc('save_system_settings', { p_actor: (res.locals.user as User).id, p_version: version(req.body?.version), p_value: value })
    if (error?.code === '40001') fail('Settings changed. Reload before saving.', 409)
    check(error); res.json({ ...data.value, version: data.version })
  })
  router.get('/audit', async (_req, res) => {
    const { data, error } = await db!.from('system_admin_audit').select('id,actor_id,action,target_id,outcome,created_at').order('created_at', { ascending: false }).limit(200)
    check(error); res.json(data || [])
  })
  router.use(apiError('Unable to complete this admin operation.'))
  return router
}

export function memberContentRouter(auth: SupabaseClient | null, service?: SupabaseClient | null) {
  const router = express.Router()
  const db = service === undefined ? process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null : service
  router.use(authenticate(auth), requireStorage(db))
  router.get('/', async (_req, res) => {
    const user = res.locals.user as User
    const [content, settings] = await Promise.all([db!.from('system_content').select('*').eq('status', 'published').order('updated_at', { ascending: false }).limit(500), db!.from('system_settings').select('value').eq('id', 'general').single()])
    if (content.error || settings.error) { res.status(503).json({ error: 'Member content is unavailable.' }); return }
    const region = String(user.user_metadata.country || '')
    res.json({ records: (content.data || []).filter(row => row.country === 'All countries' || row.country === region).map(safeRecord), settings: settings.data?.value || defaults })
  })
  router.use(apiError('Member content is unavailable.'))
  return router
}
