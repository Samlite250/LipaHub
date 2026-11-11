import { randomUUID } from 'node:crypto'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'
import type { BackendConfig } from './config.js'
import { authenticate, requireAdmin, apiError } from './auth.js'
import { readinessCheck } from './readiness.js'
import { paymentRouter } from './payments/router.js'
import { adminRouter, memberContentRouter } from './admin/router.js'
import { memberBalanceRouter } from './admin/balances.js'
import { supportRouter } from './support/router.js'
import { invitationRouter } from './invitations.js'

export function createApp(config: BackendConfig, clients: { auth?: SupabaseClient | null; service?: SupabaseClient | null } = {}) {
  const timedFetch: typeof fetch = (input, init = {}) => fetch(input, { ...init, signal: init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(config.upstreamTimeoutMs)]) : AbortSignal.timeout(config.upstreamTimeoutMs) })
  const client = (key: string) => config.supabaseUrl && key ? createClient(config.supabaseUrl, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: timedFetch } }) : null
  const auth = clients.auth === undefined ? client(config.anonKey) : clients.auth
  const db = clients.service === undefined ? client(config.serviceKey) : clients.service
  const ready = readinessCheck(auth, db)
  const app = express()
  app.disable('x-powered-by')
  app.set('trust proxy', config.trustProxy)
  app.use(helmet())
  app.use((_req, res, next) => { res.locals.requestId = randomUUID(); res.setHeader('X-Request-ID', res.locals.requestId); res.setHeader('Cache-Control', 'no-store'); next() })
  app.use(cors({ origin: config.webOrigin, exposedHeaders: ['X-Request-ID'] }))
  app.use(rateLimit({ windowMs: 60000, limit: 60, standardHeaders: 'draft-8', legacyHeaders: false,
    skip: req => ['/api/health', '/api/ready'].includes(req.path),
    handler: (_req, res) => { res.status(429).json({ error: 'Too many requests. Please try again shortly.', requestId: res.locals.requestId }) },
  }))
  app.get('/api/health', (_req, res) => { res.json({ service: 'LipaHub API', phase: 1, authenticationConfigured: !!auth, paymentsEnabled: false, paymentProofIntakeEnabled: config.proofIntake && !!auth && !!db, tradingMode: 'simulation' }) })
  app.get('/api/ready', async (_req, res) => { const status = await ready(); res.status(status.ready ? 200 : 503).json({ ready: status.ready }) })
  app.get('/api/admin/system/status', authenticate(auth), requireAdmin, async (_req, res) => { const status = await ready(); res.status(status.ready ? 200 : 503).json(status) })
  app.get('/api/me', authenticate(auth), (_req, res) => { const user = res.locals.user as User; res.json({ id: user.id, email: user.email }) })
  app.use('/api/robot-payments', paymentRouter(auth, db, config.proofIntake))
  app.use('/api/admin', adminRouter(auth, db))
  app.use('/api/member-content', memberContentRouter(auth, db))
  app.use('/api/member-balances', memberBalanceRouter(auth, db))
  app.use('/api/support', supportRouter(auth, db))
  app.use('/api/invitations', invitationRouter(db))
  app.use((_req, res) => { res.status(404).json({ error: 'Not found', requestId: res.locals.requestId }) })
  app.use(apiError())
  return app
}
