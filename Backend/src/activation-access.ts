import type { RequestHandler } from 'express'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { httpError } from './auth.js'

export async function ensureAccountActivated(service: SupabaseClient | null, user: User) {
  if (user.app_metadata?.role === 'admin' || user.app_metadata?.activation_required !== true) return
  if (!service) httpError('Account activation service is unavailable.', 503)
  const { data, error } = await service!.from('rwanda_account_activations').select('activated_at').eq('user_id', user.id).maybeSingle()
  if (error) httpError('Unable to check account activation.', 503)
  if (!data?.activated_at) throw Object.assign(new Error('Payment approval is required to access your dashboard.'), {status: 403, activationRequired: true})
}
export function requireAccountActivation(service: SupabaseClient | null): RequestHandler {
  return (_req, res, next) => { void ensureAccountActivated(service, res.locals.user as User).then(() => next()).catch(next) }
}
