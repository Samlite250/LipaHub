import { expect, test } from '@playwright/test'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { withdrawalRouter } from '../Backend/src/withdrawals/router'

const memberId = '22222222-2222-4222-8222-222222222222'
const otherId = '33333333-3333-4333-8333-333333333333'
const withdrawalId = '99999999-9999-4999-8999-999999999991'
const header = { Authorization: 'Bearer member-token' }
const adminHeader = { Authorization: 'Bearer admin-token' }
const makeUser = (id: string, role: string) => ({ id, app_metadata: { role }, user_metadata: { role: 'admin', country: 'Rwanda' }, created_at: '2026-01-01T00:00:00Z' }) as unknown as User
const member = makeUser(memberId, 'member')
const admin = makeUser('11111111-1111-4111-8111-111111111111', 'admin')
const auth = { auth: { getUser: async (token: string) => ({ data: { user: token === 'admin-token' ? admin : token === 'member-token' ? member : token === 'banned-token' ? { ...member, banned_until: '2099-01-01T00:00:00Z' } : null }, error: null }) } } as unknown as SupabaseClient

function fixture() {
  const rows = new Map<string, Record<string, unknown>>()
  const own = { id: withdrawalId, user_id: memberId, country: 'Rwanda', currency: 'RWF', channel: 'main', amount_minor: 40000, destination: { method: 'mobile_money', account: '+250788000000' }, status: 'requested', version: 1, review_note: '', decided_by: null, decided_at: null, paid_at: null, created_at: '2026-11-12T10:00:00Z', updated_at: '2026-11-12T10:00:00Z' }
  rows.set(withdrawalId, { ...own })
  rows.set('99999999-9999-4999-8999-999999999992', { ...own, id: '99999999-9999-4999-8999-999999999992', user_id: otherId })
  let lastRpc: Record<string, unknown> = {}
  let failureCode: string | null = null
  const service = {
    from: (table: string) => {
      let userId = ''
      const query = {
        select: () => query,
        eq: (field: string, value: string) => { if (field === 'user_id') userId = value; return query },
        order: () => query,
        limit: async () => ({ data: table === 'withdrawal_requests' ? [...rows.values()].filter(row => !userId || row.user_id === userId) : [], error: null }),
      }
      return query
    },
    rpc: async (name: string, args: Record<string, unknown>) => {
      lastRpc = { name, ...args }
      if (failureCode) return { data: null, error: { code: failureCode } }
      if (name === 'request_withdrawal') {
        const payload = args.p_payload as Record<string, unknown>
        const saved = { ...own, id: payload.id, country: payload.country, channel: payload.channel, amount_minor: payload.amountMinor, destination: payload.destination }
        rows.set(String(payload.id), saved)
        return { data: saved, error: null }
      }
      const current = rows.get(String(args.p_id)) || own
      const updated = { ...current, status: name === 'cancel_withdrawal' ? 'cancelled' : args.p_status, version: Number(current.version) + 1 }
      rows.set(String(args.p_id), updated)
      return { data: updated, error: null }
    },
  } as unknown as SupabaseClient
  return { service, rows, lastRpc: () => lastRpc, fail: (code: string | null) => { failureCode = code } }
}

async function start(service: SupabaseClient, enabled: boolean) {
  const app = express()
  app.use('/api/withdrawals', withdrawalRouter(auth, service, enabled))
  const server = app.listen(0, '127.0.0.1')
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve))
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }
}
async function stop(server: Server) {
  await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections() })
}

test('withdrawal API scopes members, validates payouts and gates intake', async ({ request }) => {
  const { service, lastRpc, fail } = fixture()
  const { server, base } = await start(service, true)
  try {
    expect((await request.get(`${base}/api/withdrawals`)).status()).toBe(401)
    expect((await request.get(`${base}/api/withdrawals`, { headers: { Authorization: 'Bearer banned-token' } })).status()).toBe(403)
    const list = await request.get(`${base}/api/withdrawals`, { headers: header })
    expect(list.status()).toBe(200)
    expect(await list.json()).toHaveLength(1)
    expect((await list.json())[0]).toMatchObject({ userId: memberId, status: 'requested' })
    for (const body of [
      { country: 'Unknown', amount: '40000', requestId: withdrawalId, destination: { method: 'bank', account: '1234' } },
      { country: 'Rwanda', amount: '1.25', requestId: withdrawalId, destination: { method: 'bank', account: '1234' } },
      { country: 'Rwanda', amount: '40000', channel: 'youtube', requestId: withdrawalId, destination: { method: 'bank', account: '1234' } },
      { country: 'Rwanda', amount: '40000', requestId: withdrawalId, destination: { method: 'cheque', account: '1234' } },
      { country: 'Rwanda', amount: '40000', requestId: 'invalid', destination: { method: 'bank', account: '1234' } },
    ]) expect((await request.post(`${base}/api/withdrawals`, { headers: header, data: body })).status()).toBe(400)
    const created = await request.post(`${base}/api/withdrawals`, { headers: header, data: { country: 'Rwanda', amount: '40000', channel: 'main', requestId: '99999999-9999-4999-8999-999999999993', destination: { method: 'mobile_money', account: '+250788000000', holder: 'Test Member' } } })
    expect(created.status()).toBe(201)
    expect(await created.json()).toMatchObject({ userId: memberId, currency: 'RWF', amountMinor: 40000 })
    expect(lastRpc()).toMatchObject({ name: 'request_withdrawal', p_actor: memberId, p_payload: { id: '99999999-9999-4999-8999-999999999993', country: 'Rwanda', channel: 'main', amountMinor: 40000 } })
    const cancelled = await request.post(`${base}/api/withdrawals/${withdrawalId}/cancel`, { headers: header, data: { note: 'Changed my mind', version: 1 } })
    expect(cancelled.status()).toBe(200)
    expect(await cancelled.json()).toMatchObject({ status: 'cancelled', version: 2 })
    expect((await request.post(`${base}/api/withdrawals/${withdrawalId}/cancel`, { headers: header, data: { note: 'x', version: 0 } })).status()).toBe(400)
    for (const [code, status] of [['40001', 409], ['23505', 409], ['42501', 403], ['P0002', 404], ['22023', 400], ['42P01', 503]] as const) {
      fail(code); expect((await request.post(`${base}/api/withdrawals`, { headers: header, data: { country: 'Rwanda', amount: '40000', channel: 'main', requestId: withdrawalId, destination: { method: 'bank', account: '1234' } } })).status()).toBe(status)
    }
  } finally { await stop(server) }
})

test('withdrawal administration requires an administrator and forwards reviewed decisions', async ({ request }) => {
  const { service, lastRpc, fail } = fixture()
  const { server, base } = await start(service, true)
  try {
    expect((await request.get(`${base}/api/withdrawals/admin/requests`, { headers: header })).status()).toBe(403)
    const all = await request.get(`${base}/api/withdrawals/admin/requests`, { headers: adminHeader })
    expect(all.status()).toBe(200)
    expect(await all.json()).toHaveLength(2)
    expect((await request.patch(`${base}/api/withdrawals/admin/requests/${withdrawalId}`, { headers: header, data: { status: 'approved', note: 'Approved payout', version: 1 } })).status()).toBe(403)
    for (const body of [{ status: 'paid', note: 'x', version: 1 }, { status: 'approved', note: '', version: 1 }, { status: 'approved', note: 'Approved payout', version: 0 }]) {
      expect((await request.patch(`${base}/api/withdrawals/admin/requests/${withdrawalId}`, { headers: adminHeader, data: body })).status()).toBe(400)
    }
    const reviewed = await request.patch(`${base}/api/withdrawals/admin/requests/${withdrawalId}`, { headers: adminHeader, data: { status: 'approved', note: 'Approved payout', version: 1 } })
    expect(reviewed.status()).toBe(200)
    expect(await reviewed.json()).toMatchObject({ status: 'approved', version: 2 })
    expect(lastRpc()).toMatchObject({ name: 'review_withdrawal', p_id: withdrawalId, p_status: 'approved', p_actor: admin.id, p_expected_version: 1 })
    fail('40001'); expect((await request.patch(`${base}/api/withdrawals/admin/requests/${withdrawalId}`, { headers: adminHeader, data: { status: 'paid', note: 'Sent by operator', version: 2 } })).status()).toBe(409)
    fail('P0002'); expect((await request.patch(`${base}/api/withdrawals/admin/requests/${withdrawalId}`, { headers: adminHeader, data: { status: 'paid', note: 'Sent by operator', version: 2 } })).status()).toBe(404)
  } finally { await stop(server) }
})

test('withdrawal intake stays disabled until explicitly enabled', async ({ request }) => {
  const { service } = fixture()
  const { server, base } = await start(service, false)
  try {
    expect((await request.get(`${base}/api/withdrawals`, { headers: header })).status()).toBe(200)
    expect((await request.post(`${base}/api/withdrawals`, { headers: header, data: { country: 'Rwanda', amount: '40000', requestId: withdrawalId, destination: { method: 'bank', account: '1234' } } })).status()).toBe(503)
  } finally { await stop(server) }
})
