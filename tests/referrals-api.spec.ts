import { expect, test } from '@playwright/test'
import type { AddressInfo } from 'node:net'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { createApp } from '../Backend/src/app'
import { readConfig } from '../Backend/src/config'

test('referral API requires authentication and returns activation status from the private referral query', async ({ request }) => {
  const memberId = '55555555-5555-4555-8555-555555555555'
  const referredId = '66666666-6666-4666-8666-666666666666'
  let actorId = ''
  const user = { id: memberId, app_metadata: {}, user_metadata: { country: 'Rwanda' } } as unknown as User
  const auth = { auth: { getUser: async (token: string) => token === 'member-token' ? { data: { user }, error: null } : { data: { user: null }, error: { status: 401 } } } } as unknown as SupabaseClient
  const service = { rpc: async (name: string, args: { p_actor: string }) => {
    actorId = args.p_actor
    return name === 'get_member_referrals' ? { data: [{ member_id: referredId, name: 'Rwanda Member', country: 'Rwanda', level: 1, joined_at: '2026-11-14T12:00:00Z', active: true }], error: null } : { data: null, error: { message: 'Unexpected RPC' } }
  } } as unknown as SupabaseClient
  const server = createApp({ ...readConfig({}), proofIntake: false }, { auth, service }).listen(0, '127.0.0.1')
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/referrals`
  try {
    expect((await request.get(url)).status()).toBe(401)
    const response = await request.get(url, { headers: { Authorization: 'Bearer member-token' } })
    expect(response.status()).toBe(200)
    expect(actorId).toBe(memberId)
    expect(await response.json()).toEqual([{ id: referredId, name: 'Rwanda Member', country: 'Rwanda', level: 1, joinedAt: '2026-11-14T12:00:00Z', active: true }])
    expect((await request.get(url, { headers: { Authorization: 'Bearer invalid' } })).status()).toBe(401)
  } finally { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeIdleConnections() }) }
})
