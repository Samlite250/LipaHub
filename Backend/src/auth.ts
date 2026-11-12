import type { RequestHandler, ErrorRequestHandler } from 'express'
import type { SupabaseClient, User } from '@supabase/supabase-js'

export function httpError(message: string, status: number): never { throw Object.assign(new Error(message), { status }) }
export function authenticate(auth: SupabaseClient | null): RequestHandler {
  return async (req, res, next) => {
    if (res.locals.authenticated === true) { next(); return }
    try {
      res.setHeader('Cache-Control', 'no-store')
      const bearer = /^Bearer ([^\s]{8,8192})$/.exec(req.headers.authorization || '')
      if (!bearer) httpError('Authentication required', 401)
      if (!auth) httpError('Authentication is not configured', 503)
      let result
      try { result = await auth.auth.getUser(bearer[1]) }
      catch { httpError('Authentication service unavailable', 503) }
      if (result.error && (!result.error.status || (result.error.status >= 500 || result.error.status === 429))) httpError('Authentication service unavailable', 503)
      if (result.error || !result.data.user) httpError('Invalid or expired session', 401)
      if (result.data.user.banned_until && Date.parse(result.data.user.banned_until) > Date.now()) httpError('This account is suspended', 403)
      res.locals.user = result.data.user
      res.locals.authenticated = true
      next()
    } catch (error) { next(error) }
  }
}
export const requireAdmin: RequestHandler = (_req, res, next) => {
  if ((res.locals.user as User | undefined)?.app_metadata?.role !== 'admin') { next(Object.assign(new Error('Administrator access required'), { status: 403 })); return }
  next()
}
export function requireStorage(service: SupabaseClient | null): RequestHandler {
  return (_req, _res, next) => { if (!service) next(Object.assign(new Error('This service is not configured'), { status: 503 })); else next() }
}
export function apiError(fallback = 'Internal server error'): ErrorRequestHandler {
  return (error: Error & { status?: number; type?: string; activationRequired?: boolean }, _req, res, _next) => {
    const status = Number.isInteger(error.status) && error.status! >= 400 && error.status! <= 599 ? error.status! : 500
    const message = error.type === 'entity.parse.failed' ? 'Malformed JSON request.' : status === 413 ? 'Request body is too large.'
      : status < 500 || status === 503 ? error.message : fallback
    res.status(status).json({ error: message, ...(res.locals.requestId ? { requestId: res.locals.requestId } : {}), ...(error.activationRequired ? {activationRequired: true} : {}) })
  }
}
