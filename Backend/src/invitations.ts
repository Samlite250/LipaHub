import express from 'express'
import type { SupabaseClient } from '@supabase/supabase-js'
import { httpError, requireStorage } from './auth.js'

export function invitationRouter(service: SupabaseClient | null) {
  const router = express.Router()
  router.get('/:reference', requireStorage(service), async (req, res) => {
    const reference = String(req.params.reference).trim()
    if (!/^[\p{L}\p{N}][\p{L}\p{N} ._'-]{1,79}$/u.test(reference)) httpError('Invitation not found.', 404)
    const legacyId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference)
    let accountId = reference.toLowerCase()
    let username = ''
    if (!legacyId) {
      let lookup
      try { lookup = await service!.rpc('resolve_invitation_username', { p_username: reference }) }
      catch { httpError('Invitations are temporarily unavailable.', 503) }
      if (lookup.error) httpError('Invitations are temporarily unavailable.', 503)
      if (!Array.isArray(lookup.data) || lookup.data.length !== 1) httpError('Invitation not found. The username may be unavailable or shared by multiple accounts.', 404)
      accountId = lookup.data[0].id
      username = lookup.data[0].username
    }
    let result
    try { result = await service!.auth.admin.getUserById(accountId) }
    catch { httpError('Invitations are temporarily unavailable.', 503) }
    if (result.error && result.error.status !== 404) httpError('Invitations are temporarily unavailable.', 503)
    const user = result.data.user
    if (!user || user.id !== accountId || (user.banned_until && Date.parse(user.banned_until) > Date.now())) httpError('Invitation not found.', 404)
    if (!username) username = user.user_metadata?.username || user.user_metadata?.display_name || 'LipaHub member'
    const name = typeof username === 'string' ? [...username].filter(char => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127).join('').trim().slice(0, 80) : ''
    res.json({ inviter: { id: user.id, name: name || 'LipaHub member', username: name || 'LipaHub member' } })
  })
  return router
}
