import { authenticate, requireAdmin, requireStorage, apiError } from '../auth.js'
import { randomUUID } from 'node:crypto'
import express from 'express'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import { countries, country, defaultMethods, InputError, instructions, quote, screenshot, text, proofLimits } from './validation.js'

const bucket = 'robot-payment-proofs'
function fail(message: string, status = 500): never { throw Object.assign(new Error(message), { status }) }
function databaseError(error: { code?: string } | null) {
  if (!error) return
  if (error.code === '42501') fail('This payment review is not permitted.', 403)
  if (error.code === 'P0002') fail('Payment request not found.', 404)
  if (['22023', '23514'].includes(error.code || '')) fail('Invalid payment review or saved bonus. Check the request details.', 400)
  if (error.code === '23505' || error.code === '40001') fail('A request already exists or the instructions changed. Reload before continuing.', 409)
  fail('Payment storage is unavailable. Check the server configuration and migration.', 503)
}
type Row = Record<string, unknown>
function mapRequest(row: Row) {
  return { id: row.id, userId: row.user_id, country: row.country, planId: row.plan_id, status: row.status, fullName: row.full_name, phone: row.phone, transactionReference: row.transaction_reference, instructionVersion: row.instruction_version, paymentMethod: row.payment_method, quote: row.quote, submittedAt: row.submitted_at, reviewNote: row.review_note, reviewVersion: row.review_version || 1, reviewedAt: row.reviewed_at, bonusCreditedMinor: Number(row.bonus_credited_minor || 0),
    files: ((row.robot_payment_proofs || []) as Row[]).map(file => ({ id: file.id, name: file.original_name, type: file.mime_type, size: file.size_bytes })) }
}
export function paymentRouter(auth: SupabaseClient | null, service?: SupabaseClient | null, proofIntake?: boolean) {
  const router = express.Router()
  const enabled = proofIntake ?? (process.env.PAYMENT_PROOF_INTAKE_ENABLED === 'true')
  const db = service === undefined ? process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY ? createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }) : null : service
  const admin = requireAdmin
  router.use((_req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next() })
  router.use(authenticate(auth), requireStorage(db))
  function visibleMethods(value: Row[], user: User) {
    return user.app_metadata.role === 'admin' ? value : value.filter(method => method.enabled === true)
  }
  router.get('/instructions', async (_req, res) => {
    const { data, error } = await db!.from('robot_payment_instructions').select('*').limit(countries.length)
    databaseError(error)
    const saved = new Map((data || []).map(row => [row.country, row]))
    res.json(countries.map(region => {
      const row = saved.get(region)
      return { country: region, version: row?.version || 0, methods: visibleMethods(row?.methods || defaultMethods(region), res.locals.user as User), updatedAt: row?.updated_at || null, intakeEnabled: enabled }
    }))
  })
  router.get('/instructions/:country', async (req, res) => {
    const region = country(req.params.country)
    const { data, error } = await db!.from('robot_payment_instructions').select('*').eq('country', region).maybeSingle()
    databaseError(error)
    res.json({ country: region, version: data?.version || 0, methods: visibleMethods(data?.methods || defaultMethods(region), res.locals.user as User), updatedAt: data?.updated_at || null, intakeEnabled: enabled })
  })
  router.put('/admin/instructions/:country', admin, express.json({ limit: '16kb' }), async (req, res) => {
    const region = country(req.params.country)
    const value = instructions(req.body || {}, region)
    const { data, error } = await db!.rpc('save_robot_payment_instructions', { p_country: region, p_methods: value.methods, p_expected_version: value.version, p_actor: (res.locals.user as User).id })
    databaseError(error)
    const row = Array.isArray(data) ? data[0] : data
    res.json({ country: region, version: row.version, methods: row.methods, updatedAt: row.updated_at, intakeEnabled: enabled })
  })
  router.get('/requests', async (_req, res) => {
    const { data, error } = await db!.from('robot_activation_requests').select('*, robot_payment_proofs(*)').eq('user_id', (res.locals.user as User).id).order('submitted_at', { ascending: false }).limit(200)
    databaseError(error); res.json((data || []).map(mapRequest))
  })
  router.get('/admin/requests', admin, async (_req, res) => {
    const { data, error } = await db!.from('robot_activation_requests').select('*, robot_payment_proofs(*)').order('submitted_at', { ascending: false }).limit(200)
    databaseError(error); res.json((data || []).map(mapRequest))
  })
  router.post('/requests', (_req, res, next) => { if (!enabled) { res.status(503).json({ error: 'Live payment proof intake is disabled' }); return } next() }, express.json({ limit: '4300kb' }), async (req, res) => {
    const input = req.body || {}; const user = res.locals.user as User
    const region = country(input.country); const serverQuote = quote(input.planId, region)
    const fullName = text(input.fullName, 'full name', 120, 2); const phone = text(input.phone, 'phone', 16, 8)
    if (!/^\+[1-9]\d{6,14}$/.test(phone)) throw new InputError('Phone number must include its country code.')
    if (!Number.isInteger(input.instructionVersion) || input.instructionVersion < 1) throw new InputError('Invalid instruction version.')
    const methodId = text(input.methodId, 'payment method', 80, 1)
    const transactionReference = text(input.transactionReference || '', 'transaction reference', 100)
    if (!Array.isArray(input.files) || !input.files.length || input.files.length > proofLimits.maxFiles) throw new InputError('Attach 1–3 payment screenshots.')
    const files: ReturnType<typeof screenshot>[] = input.files.map(screenshot)
    if (files.reduce((total, file) => total + file.bytes.length, 0) > proofLimits.maxTotalBytes) throw new InputError('Screenshots must total 3 MB or less.')
    const { data: config, error: configError } = await db!.from('robot_payment_instructions').select('*').eq('country', region).maybeSingle()
    databaseError(configError)
    const method = (config?.methods as Row[] | undefined)?.find(method => method.id === methodId && method.enabled === true)
    if (!config || !method || config.version !== input.instructionVersion) fail('Payment instructions changed or are unavailable. Reopen the plan before submitting.', 409)
    const id = randomUUID(); const uploaded: string[] = []
    let submissionStarted = false; let rollbackConfirmed = false
    try {
      const metadata: Row[] = []
      for (const file of files) {
        const fileId = randomUUID(); const path = `${user.id}/${id}/${fileId}.${file.extension}`
        const { error } = await db!.storage.from(bucket).upload(path, file.bytes, { contentType: file.type, upsert: false, cacheControl: '0' })
        if (error) fail('Unable to store screenshot privately. No request was submitted.', 503)
        uploaded.push(path); metadata.push({ id: fileId, object_path: path, original_name: file.name, mime_type: file.type, size_bytes: file.bytes.length })
      }
      submissionStarted = true
      const { error } = await db!.rpc('submit_robot_activation_request', { p_actor: user.id, p_payload: { id, country: region, plan_id: input.planId, full_name: fullName, phone, transaction_reference: transactionReference, instruction_version: input.instructionVersion, method_id: methodId, quote: serverQuote, files: metadata } })
      rollbackConfirmed = !!error?.code && ['23505', '23514', '23502', '23503', '40001', '42501', '22023'].includes(error.code)
      databaseError(error)
    } catch (err) {
      if (submissionStarted && !rollbackConfirmed) {
        // A network failure can occur after COMMIT. Never delete potentially referenced proof objects.
        try {
          const receipt = await db!.from('robot_activation_requests').select('*, robot_payment_proofs(*)').eq('id', id).eq('user_id', user.id).maybeSingle()
          if (!receipt.error && receipt.data) { res.status(201).json(mapRequest(receipt.data)); return }
        } catch { /* Keep private objects for reconciliation when the outcome cannot be read. */ }
        fail('Submission outcome is uncertain. Check your request history before retrying.', 503)
      }
      if (uploaded.length) {
        try {
          const cleanup = await db!.storage.from(bucket).remove(uploaded)
          if (cleanup.error) console.error('Private proof cleanup requires reconciliation.', { requestId: id })
        } catch { console.error('Private proof cleanup requires reconciliation.', { requestId: id }) }
      }
      throw err
    }
    const { data: row, error } = await db!.from('robot_activation_requests').select('*, robot_payment_proofs(*)').eq('id', id).eq('user_id', user.id).single()
    databaseError(error); res.status(201).json(mapRequest(row!))
  })
  router.patch('/admin/requests/:id', admin, express.json({ limit: '8kb' }), async (req, res) => {
    if (!['under_review', 'rejected', 'verified'].includes(req.body?.status)) throw new InputError('Choose approve, reject or under review.')
    const note = text(req.body?.note || '', 'review note', 1000, req.body.status === 'under_review' ? 0 : 3)
    if (!Number.isInteger(req.body?.version) || req.body.version < 1) throw new InputError('Reload this submission before reviewing it.')
    const id = text(req.params.id, 'request ID', 36, 36)
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new InputError('Invalid request ID.')
    const { error } = await db!.rpc('review_robot_activation_request', { p_id: id, p_status: req.body.status, p_note: note, p_actor: (res.locals.user as User).id, p_expected_version: req.body.version })
    databaseError(error); res.status(204).end()
  })
  router.get('/requests/:id/files/:fileId', async (req, res) => {
    const user = res.locals.user as User
    let query = db!.from('robot_activation_requests').select('id').eq('id', req.params.id)
    if (user.app_metadata.role !== 'admin') query = query.eq('user_id', user.id)
    const { data: request, error: requestError } = await query.maybeSingle(); databaseError(requestError)
    if (!request) fail('Proof not found', 404)
    const { data: file, error } = await db!.from('robot_payment_proofs').select('object_path').eq('id', req.params.fileId).eq('request_id', req.params.id).maybeSingle()
    databaseError(error); if (!file) fail('Proof not found', 404)
    const { data, error: storageError } = await db!.storage.from(bucket).createSignedUrl(file.object_path, 60)
    if (storageError || !data) fail('Unable to open the private proof', 503)
    res.setHeader('Cache-Control', 'no-store'); res.json({ url: data.signedUrl })
  })
  router.use(apiError('Unable to complete this payment request.'))
  return router
}
