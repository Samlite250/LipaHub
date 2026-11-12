import express from 'express'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { authenticate, httpError, requireStorage } from './auth.js'
import { defaultMethods } from './payments/validation.js'
import { mapRequest } from './payments/router.js'

export { requireAccountActivation } from './activation-access.js'
export function accountActivationRouter(auth: SupabaseClient | null, service: SupabaseClient | null, intakeEnabled: boolean) {
  const router = express.Router()
  router.get('/', authenticate(auth), requireStorage(service), async (_req, res) => {
    const user = res.locals.user as User
    const [requirement, instructions, requests] = await Promise.all([
      service!.from('rwanda_account_activations').select('activated_at').eq('user_id', user.id).maybeSingle(),
      service!.from('robot_payment_instructions').select('*').eq('country', 'Rwanda').maybeSingle(),
      service!.from('robot_activation_requests').select('*, robot_payment_proofs(*)').eq('user_id', user.id).eq('purpose', 'account_activation').order('submitted_at', {ascending: false}).limit(1),
    ])
    if (requirement.error || instructions.error || requests.error) httpError('Account activation is temporarily unavailable.', 503)
    const required = user.app_metadata?.role !== 'admin' && (!!requirement.data || user.app_metadata?.activation_required === true)
    res.json({required, active: !required || !!requirement.data?.activated_at, request: requests.data?.[0] ? mapRequest(requests.data[0]) : null,
      instructions: {country: 'Rwanda', version: instructions.data?.version || 0, intakeEnabled, methods: (instructions.data?.methods || defaultMethods('Rwanda')).filter((method: {enabled: boolean; name: string}) => method.enabled && ['MTN', 'Airtel'].includes(method.name))}})
  })
  return router
}
