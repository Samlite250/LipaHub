import express from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import { httpError, requireStorage } from './auth.js'

export function invitationRouter(service: SupabaseClient | null) {
  const router = express.Router()
  router.get('/:reference', requireStorage(service), async (req, res) => {
    const reference = String(req.params.reference).toLowerCase()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference)) httpError('Invitation not found.', 404)
    let result
    try { result = await service!.auth.admin.getUserById(reference) }
    catch { httpError('Invitations are temporarily unavailable.', 503) }
    if (result.error && result.error.status !== 404) httpError('Invitations are temporarily unavailable.', 503)
    const user = result.data.user
    if (!user || user.id !== reference || (user.banned_until && Date.parse(user.banned_until) > Date.now())) httpError('Invitation not found.', 404)
    const name = typeof user.user_metadata?.display_name === 'string' ? [...user.user_metadata.display_name].filter(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127).join('').trim().slice(0, 80) : ''
    res.json({ inviter: { id: user.id, name: name || 'LipaHub member' } })
  })
  return router
}
