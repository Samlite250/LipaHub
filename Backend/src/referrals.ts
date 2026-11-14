import express from 'express'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { authenticate, httpError, requireStorage } from './auth.js'

export function referralsRouter(auth: SupabaseClient | null, service: SupabaseClient | null) {
  const router = express.Router()
  router.use(authenticate(auth), requireStorage(service))
  router.get('/', async (_req, res) => {
    const user = res.locals.user as User
    let result
    try { result = await service!.rpc('get_member_referrals', { p_actor: user.id }) }
    catch { httpError('Referral information is temporarily unavailable.', 503) }
    if (result.error) httpError('Referral information is temporarily unavailable. Check that the referrals migration is installed.', 503)
    const members = Array.isArray(result.data) ? result.data.map(row => ({
      id: row.member_id,
      name: typeof row.name === 'string' ? row.name : 'LipaHub member',
      country: typeof row.country === 'string' ? row.country : 'International',
      level: Number(row.level),
      joinedAt: row.joined_at,
      active: row.active === true,
    })) : []
    res.json(members)
  })
  return router
}
