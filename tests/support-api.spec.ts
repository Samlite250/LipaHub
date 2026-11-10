import { expect, test } from '@playwright/test'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { supportRouter } from '../Backend/src/support/router'

test('support API enforces ownership, staff roles, verified actors and conflict handling', async ({ request }) => {
  const memberId = '11111111-1111-4111-8111-111111111111'
  const otherId = '22222222-2222-4222-8222-222222222222'
  const adminId = '33333333-3333-4333-8333-333333333333'
  const ticketId = '44444444-4444-4444-8444-444444444444'
  const messageId = '55555555-5555-4555-8555-555555555555'
  const user = (id: string, role = 'member') => ({ id, app_metadata: { role }, user_metadata: { role: 'admin' } }) as unknown as User
  const auth = { auth: { getUser: async (token: string) => ({ data: { user: token === 'member-token' ? user(memberId) : token === 'other-token' ? user(otherId) : token === 'admin-token' ? user(adminId, 'admin') : token === 'banned-token' ? { ...user(memberId), banned_until: '2099-01-01' } : null }, error: null }) } } as unknown as SupabaseClient
  const ticket = { id: ticketId, user_id: memberId, subject: 'Account question', version: 1, status: 'open' }
  let lastRpc: { name: string; args: Record<string, unknown> } | null = null
  let failureCode: string | null = null
  const service = {
    from: (table: string) => {
      const filters = new Map<string, string>()
      const query = {
        select: () => query,
        eq: (key: string, value: string) => { filters.set(key, value); return query },
        order: () => query,
        maybeSingle: async () => ({ data: filters.get('id') === ticketId && (!filters.has('user_id') || filters.get('user_id') === memberId) ? ticket : null, error: null }),
        limit: async () => ({ data: table === 'support_messages' ? [{ id: messageId, body: 'A private message', author_role: 'member' }] : !filters.has('user_id') || filters.get('user_id') === memberId ? [ticket] : [], error: null }),
      }
      return query
    },
    rpc: async (name: string, args: Record<string, unknown>) => { lastRpc = { name, args }; return { data: ticket, error: failureCode ? { code: failureCode } : null } },
  } as unknown as SupabaseClient
  const app = express(); app.use('/api/support', supportRouter(auth, service))
  const server = app.listen(0, '127.0.0.1')
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/support`
  const headers = { Authorization: 'Bearer member-token' }; const staff = { Authorization: 'Bearer admin-token' }
  try {
    expect((await request.get(base)).status()).toBe(401)
    expect((await request.get(base, { headers: { Authorization: 'Bearer invalid-token' } })).status()).toBe(401)
    expect((await request.get(base, { headers: { Authorization: 'Bearer banned-token' } })).status()).toBe(403)
    const list = await request.get(`${base}?userId=${otherId}`, { headers })
    expect(await list.json()).toEqual([ticket]); expect(list.headers()['cache-control']).toBe('no-store')
    const otherHeaders = { Authorization: 'Bearer other-token' }
    expect(await (await request.get(base, { headers: otherHeaders })).json()).toEqual([])
    expect((await request.get(`${base}/${ticketId}`, { headers: otherHeaders })).status()).toBe(404)
    expect((await request.get(`${base}/${ticketId}`, { headers: staff })).status()).toBe(200)
    expect((await request.get(`${base}/invalid`, { headers })).status()).toBe(400)
    const input = { requestId: ticketId, subject: 'Account question', message: 'Please help with this account issue.', userId: otherId, role: 'admin' }
    expect((await request.post(base, { headers, data: input })).status()).toBe(201)
    expect(lastRpc).toEqual({ name: 'create_support_ticket', args: { p_actor: memberId, p_id: ticketId, p_subject: input.subject, p_body: input.message } })
    for (const patch of [{ requestId: 'invalid' }, { subject: 'a' }, { message: 'short' }, { message: 'a'.repeat(4001) }]) expect((await request.post(base, { headers, data: { ...input, ...patch } })).status()).toBe(400)
    const reply = { requestId: messageId, message: 'More information', version: 1, actorId: adminId }
    expect((await request.post(`${base}/${ticketId}/messages`, { headers, data: reply })).status()).toBe(201)
    expect(lastRpc).toEqual({ name: 'reply_support_ticket', args: { p_actor: memberId, p_ticket: ticketId, p_id: messageId, p_body: reply.message, p_version: 1 } })
    expect((await request.patch(`${base}/${ticketId}`, { headers, data: { status: 'closed', version: 1, role: 'admin' } })).status()).toBe(403)
    expect((await request.patch(`${base}/${ticketId}`, { headers: staff, data: { status: 'closed', version: 1 } })).status()).toBe(200)
    expect(lastRpc).toEqual({ name: 'set_support_ticket_status', args: { p_actor: adminId, p_ticket: ticketId, p_status: 'closed', p_version: 1 } })
    expect((await request.patch(`${base}/${ticketId}`, { headers: staff, data: { status: 'invalid', version: 1 } })).status()).toBe(400)
    for (const [code, status] of [['42501', 403], ['P0002', 404], ['40001', 409], ['23505', 409], ['22023', 400], ['42P01', 503]] as const) {
      failureCode = code
      expect((await request.post(`${base}/${ticketId}/messages`, { headers, data: reply })).status()).toBe(status)
    }
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
})
