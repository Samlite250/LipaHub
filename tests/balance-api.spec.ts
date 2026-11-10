import { expect, test } from '@playwright/test'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { adminRouter } from '../Backend/src/admin/router'
import { memberBalanceRouter } from '../Backend/src/admin/balances'

test('balance API uses verified identity, validates adjustments and rejects stale or reused requests', async ({ request }) => {
  const adminId = '11111111-1111-4111-8111-111111111111'
  const memberId = '22222222-2222-4222-8222-222222222222'
  const otherId = '33333333-3333-4333-8333-333333333333'
  const makeUser = (id: string, role: string) => ({ id, app_metadata: { role }, user_metadata: { role: 'admin', country: 'Rwanda', balance: 999999999 }, created_at: '2026-01-01T00:00:00Z' }) as unknown as User
  const admin = makeUser(adminId, 'admin'); const member = makeUser(memberId, 'member')
  const auth = { auth: { getUser: async (token: string) => ({ data: { user: token === 'admin-token' ? admin : token === 'member-token' ? member : token === 'banned-token' ? { ...member, banned_until: '2099-01-01T00:00:00Z' } : null }, error: null }) } } as unknown as SupabaseClient
  let selectedUser = ''; let lastRpc: Record<string, unknown> = {}; let failureCode: string | null = null
  const rows = new Map<string, Record<string, unknown>>()
  const service = {
    auth: { admin: { getUserById: async (id: string) => ({ data: { user: id === memberId ? member : null }, error: null }) } },
    from: (table: string) => {
      let user = ''; let country = ''
      const query = {
        select: () => query,
        eq: (field: string, value: string) => { if (field === 'user_id') { user = value; selectedUser = value } if (field === 'country') country = value; return query },
        maybeSingle: async () => ({ data: rows.get(`${user}:${country}`) || null, error: null }),
        order: () => query,
        limit: async () => ({ data: table === 'system_balance_adjustments' ? [] : null, error: null }),
      }
      return query
    },
    rpc: async (_name: string, args: Record<string, unknown>) => {
      lastRpc = args
      if (failureCode) return { data: null, error: { code: failureCode } }
      const data = { user_id: args.p_user, country: args.p_country, currency: 'RWF', available_minor: args.p_available, bonus_minor: args.p_bonus, version: Number(args.p_version) + 1, updated_at: '2026-11-10T10:00:00Z' }
      rows.set(`${args.p_user}:${args.p_country}`, data)
      return { data, error: null }
    },
  } as unknown as SupabaseClient
  const app = express(); app.use('/api/admin', adminRouter(auth, service)); app.use('/api/member-balances', memberBalanceRouter(auth, service))
  const server = app.listen(0, '127.0.0.1')
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const headers = { Authorization: 'Bearer admin-token' }; const memberHeaders = { Authorization: 'Bearer member-token' }
  const input = { country: 'Rwanda', available: '10000', bonus: '250', reason: 'Correcting the controlled test account balance', version: 0, requestId: '44444444-4444-4444-8444-444444444444' }
  try {
    const url = `${base}/api/admin/users/${memberId}/balances`
    expect((await request.post(url, { data: input })).status()).toBe(401)
    expect((await request.post(url, { headers: memberHeaders, data: { ...input, role: 'admin' } })).status()).toBe(403)
    expect((await request.get(`${base}/api/member-balances?country=Rwanda`, { headers: { Authorization: 'Bearer banned-token' } })).status()).toBe(403)
    const memberRead = await request.get(`${base}/api/member-balances?country=Rwanda&userId=${otherId}`, { headers: memberHeaders })
    expect(memberRead.status()).toBe(200)
    expect((await memberRead.json()).availableMinor).toBe(0)
    expect(selectedUser).toBe(memberId)
    const historyRead = await request.get(`${base}/api/member-balances?country=Rwanda&history=true&userId=${otherId}`, { headers: memberHeaders })
    expect(historyRead.status()).toBe(200)
    expect(await historyRead.json()).toMatchObject({ wallet: { userId: memberId }, history: [] })
    expect(selectedUser).toBe(memberId)
    expect((await request.get(`${url}?country=Rwanda`, { headers })).status()).toBe(200)
    expect((await request.get(`${base}/api/admin/users/${otherId}/balances?country=Rwanda`, { headers })).status()).toBe(404)
    for (const patch of [{ available: '-1' }, { available: '1.25' }, { country: 'Unknown' }, { reason: 'short' }, { version: -1 }, { requestId: 'invalid' }]) expect((await request.post(url, { headers, data: { ...input, ...patch } })).status()).toBe(400)
    const saved = await request.post(url, { headers, data: { ...input, actorId: otherId, currency: 'USD' } })
    expect(saved.status()).toBe(200)
    expect(await saved.json()).toMatchObject({ userId: memberId, currency: 'RWF', availableMinor: 10000, bonusMinor: 250, version: 1 })
    expect(lastRpc).toMatchObject({ p_actor: adminId, p_user: memberId, p_country: 'Rwanda', p_available: 10000, p_bonus: 250, p_request: input.requestId })
    expect((await (await request.get(`${base}/api/member-balances?country=Rwanda`, { headers: memberHeaders })).json()).availableMinor).toBe(10000)
    failureCode = '40001'; expect((await request.post(url, { headers, data: input })).status()).toBe(409)
    failureCode = '23505'; expect((await request.post(url, { headers, data: input })).status()).toBe(409)
    failureCode = '22023'; expect((await request.post(url, { headers, data: input })).status()).toBe(400)
    failureCode = '42P01'; expect((await request.post(url, { headers, data: input })).status()).toBe(503)
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
})
