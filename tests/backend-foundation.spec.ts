import { expect, test } from '@playwright/test'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { AddressInfo } from 'node:net'
import type { Server } from 'node:http'
import { createServer } from 'node:http'
import { createApp } from '../Backend/src/app'
import { readConfig } from '../Backend/src/config'
import { countries } from '../Backend/src/countries'

const config = readConfig({})
const member = { id: '11111111-1111-4111-8111-111111111111', email: 'member@example.invalid', app_metadata: {}, user_metadata: { role: 'admin' }, aud: 'authenticated', created_at: '2026-01-01T00:00:00Z' } as User
const staff = { ...member, app_metadata: { role: 'admin' } } as User
const auth = { auth: { getUser: async (token: string) => {
  if (token === 'offline-token') throw new Error('Upstream internal credentials must not be returned')
  return { data: { user: token === 'member-token' ? member : token === 'staff-token' ? staff : token === 'banned-token' ? { ...staff, banned_until: '2099-01-01' } : null }, error: null }
} } } as unknown as SupabaseClient
function storage(failedTable = '', publicBucket = false, revision = 8) {
  let instructionReads = 0
  const service = {
    from: (table: string) => ({ select: (_fields: string, options?: { head: boolean }) => ({ limit: async () => {
      if (table === 'robot_payment_instructions' && !options?.head) instructionReads++
      return { data: table === 'robot_payment_instructions' ? [{ country: 'Burundi', version: 2, methods: [{ id: 'draft', enabled: false, recipient: 'DRAFT-PRIVATE-RECIPIENT' }, { id: 'published', enabled: true, recipient: 'PUBLISHED-RECIPIENT' }], updated_at: null }] : [], error: table === failedTable ? { message: 'Private database details' } : null }
    } }) }),
    rpc: async (name: string) => ({ data: name === 'backend_schema_revision' ? revision : false, error: null }),
    storage: { getBucket: async () => ({ data: { public: publicBucket, file_size_limit: 5242880, allowed_mime_types: ['image/png', 'image/jpeg'] }, error: null }) },
  } as unknown as SupabaseClient
  return { service, instructionReads: () => instructionReads }
}
async function start(clients: { auth?: SupabaseClient | null; service?: SupabaseClient | null }) {
  const server = createApp(config, clients).listen(0, '127.0.0.1')
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve))
  return { server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }
}
async function stop(server: Server) { await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections() }) }

test('configuration rejects unsafe keys, malformed origins, invalid limits and premature intake', () => {
  expect(readConfig({})).toMatchObject({ host: '127.0.0.1', port: 3001, proofIntake: false, withdrawalRequests: false, trustProxy: 0 })
  for (const patch of [
    { PORT: 'NaN' }, { PORT: '65536' }, { TRUST_PROXY_HOPS: 'true' }, { UPSTREAM_TIMEOUT_MS: '0' },
    { WEB_ORIGIN: 'https://user:password@example.com' }, { WEB_ORIGIN: 'https://example.com/path' },
    { NODE_ENV: 'production', WEB_ORIGIN: 'http://example.com' }, { SUPABASE_URL: 'https://example.com' },
    { SUPABASE_URL: 'https://example.com', SUPABASE_ANON_KEY: 'sb_secret_server-only' },
    { SUPABASE_URL: 'https://example.com', SUPABASE_ANON_KEY: 'sb_publishable_public', SUPABASE_SERVICE_ROLE_KEY: 'sb_publishable_public' },
    { PAYMENT_PROOF_INTAKE_ENABLED: 'true' }, { PAYMENT_PROOF_INTAKE_ENABLED: 'yes' },
    { WITHDRAWAL_REQUESTS_ENABLED: 'true' }, { WITHDRAWAL_REQUESTS_ENABLED: 'yes' },
  ]) expect(() => readConfig(patch)).toThrow()
  expect(readConfig({ SUPABASE_URL: 'http://127.0.0.1:54321', SUPABASE_ANON_KEY: 'sb_publishable_local' }).supabaseUrl).toContain('54321')
})

test('API applies security headers, fresh identity verification and consistent auth errors', async ({ request }) => {
  const { server, base } = await start({ auth, service: storage().service })
  try {
    const health = await request.get(`${base}/api/health`, { headers: { 'X-Request-ID': 'untrusted-id' } })
    expect(health.status()).toBe(200)
    expect(health.headers()['cache-control']).toBe('no-store')
    expect(health.headers()['x-content-type-options']).toBe('nosniff')
    expect(health.headers()['x-request-id']).toMatch(/^[0-9a-f-]{36}$/)
    expect(health.headers()['x-powered-by']).toBeUndefined()
    for (const path of ['/api/me', '/api/admin/users', '/api/robot-payments/instructions', '/api/member-content', '/api/member-balances?country=Rwanda', '/api/support', '/api/withdrawals', '/api/withdrawals/admin/requests']) {
      expect((await request.get(`${base}${path}`)).status()).toBe(401)
      expect((await request.get(`${base}${path}`, { headers: { Authorization: 'Bearer banned-token' } })).status()).toBe(403)
      const offline = await request.get(`${base}${path}`, { headers: { Authorization: 'Bearer offline-token' } })
      expect(offline.status()).toBe(503)
      expect(await offline.text()).not.toContain('credentials')
    }
    for (const token of ['short', 'member-token extra', 'bad-token']) expect((await request.get(`${base}/api/me`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(401)
    const me = await request.get(`${base}/api/me`, { headers: { Authorization: 'Bearer member-token' } })
    expect(await me.json()).toEqual({ id: member.id, email: member.email })
    expect((await request.get(`${base}/api/admin/system/status`, { headers: { Authorization: 'Bearer member-token' } })).status()).toBe(403)
  } finally { await stop(server) }
})

test('readiness detects missing schema and unsafe buckets without leaking details publicly', async ({ request }) => {
  for (const [service, ready] of [[null, false], [storage().service, true], [storage('support_tickets').service, false], [storage('', true).service, false], [storage('', false, 7).service, false]] as const) {
    const { server, base } = await start({ auth, service })
    try {
      const response = await request.get(`${base}/api/ready`)
      expect(response.status()).toBe(ready ? 200 : 503)
      expect(await response.json()).toEqual({ ready })
      const details = await request.get(`${base}/api/admin/system/status`, { headers: { Authorization: 'Bearer staff-token' } })
      expect(details.status()).toBe(ready ? 200 : 503)
      expect((await details.json()).checks.every((check: { ready: boolean }) => check.ready)).toBe(ready)
    } finally { await stop(server) }
  }
})

test('bulk payment instruction endpoint returns every country with a single database read', async ({ request }) => {
  const fixture = storage()
  const { server, base } = await start({ auth, service: fixture.service })
  try {
    const response = await request.get(`${base}/api/robot-payments/instructions`, { headers: { Authorization: 'Bearer staff-token' } })
    expect(response.status()).toBe(200)
    const rows = await response.json()
    expect(rows).toHaveLength(countries.length)
    expect(rows.find((row: { country: string }) => row.country === 'Burundi').version).toBe(2)
    expect(rows.find((row: { country: string }) => row.country === 'Japan').version).toBe(0)
    expect(fixture.instructionReads()).toBe(1)
    const memberResponse = await request.get(`${base}/api/robot-payments/instructions`, { headers: { Authorization: 'Bearer member-token' } })
    expect(memberResponse.status()).toBe(200)
    expect(await memberResponse.text()).not.toContain('DRAFT-PRIVATE-RECIPIENT')
    expect(await memberResponse.text()).toContain('PUBLISHED-RECIPIENT')
  } finally { await stop(server) }
})

test('API returns safe JSON for invalid request bodies and rate limiting', async ({ request }) => {
  const { server, base } = await start({ auth, service: storage().service })
  try {
    const headers = { Authorization: 'Bearer staff-token', 'Content-Type': 'application/json' }
    const malformed = await request.post(`${base}/api/support`, { headers, data: '{"password":"private-value"' })
    expect(malformed.status()).toBe(400)
    expect((await malformed.json()).error).toBe('Malformed JSON request.')
    expect(await malformed.text()).not.toContain('private-value')
    const large = await request.post(`${base}/api/support`, { headers, data: JSON.stringify({ message: 'x'.repeat(18000) }) })
    expect(large.status()).toBe(413)
    let limited = false
    for (let index = 0; index < 61; index++) {
      const response = await request.get(`${base}/not-found`)
      if (response.status() === 429) { expect((await response.json()).error).toContain('Too many requests'); limited = true; break }
    }
    expect(limited).toBe(true)
    expect((await request.get(`${base}/api/health`)).status()).toBe(200)
  } finally { await stop(server) }
})

test('live payment client makes one bulk request and accepts successful empty review responses', async ({ page }) => {
  let calls = 0
  await page.route('http://127.0.0.1:3001/api/robot-payments/**', async route => {
    const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,PATCH,OPTIONS', 'Access-Control-Allow-Headers': 'Authorization,Content-Type' }
    if (route.request().method() === 'OPTIONS') { await route.fulfill({ status: 204, headers }); return }
    calls++
    if (route.request().method() === 'PATCH') await route.fulfill({ status: 204, headers })
    else await route.fulfill({ status: 200, headers, json: [{ country: 'Burundi', version: 1 }] })
  })
  await page.goto('/login')
  const rows = await page.evaluate(async () => {
    const path = '/src/lib/payments.ts'
    const api = await import(path)
    const access = { accessToken: 'controlled-test-token' }
    const result = await api.loadAllInstructions(access)
    await api.reviewProof(access, 'controlled-request', 'under_review', '')
    return result
  })
  expect(rows).toEqual([{ country: 'Burundi', version: 1 }])
  expect(calls).toBe(2)
})

test('ambiguous proof commits preserve stored objects and recover confirmed submissions', async ({ request }) => {
  for (const outcome of ['committed', 'unknown', 'rejected']) {
    let removed = 0
    let receipt: Record<string, unknown> | null = null
    const service = {
      from: (table: string) => {
        const query = {
          select: () => query, eq: () => query,
          maybeSingle: async () => ({ data: table === 'robot_payment_instructions' ? { version: 1, methods: [{ id: 'test-method', enabled: true }] } : receipt, error: null }),
          single: async () => ({ data: receipt, error: null }),
        }
        return query
      },
      storage: { from: () => ({ upload: async () => ({ error: null }), remove: async () => { removed++; return { error: null } } }) },
      rpc: async (_name: string, args: { p_payload: Record<string, unknown> }) => {
        if (outcome === 'rejected') return { error: { code: '23505' } }
        if (outcome === 'committed') receipt = { ...args.p_payload, user_id: member.id, status: 'pending_review', robot_payment_proofs: [] }
        throw new Error('Connection lost after sending transaction')
      },
    } as unknown as SupabaseClient
    const server = createApp({ ...config, proofIntake: true }, { auth, service }).listen(0, '127.0.0.1')
    if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve))
    try {
      const response = await request.post(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/robot-payments/requests`, {
        headers: { Authorization: 'Bearer member-token' }, data: {
          country: 'Burundi', planId: 'robot-01', fullName: 'Controlled Member', phone: '+25779000000', methodId: 'test-method', instructionVersion: 1,
          files: [{ name: 'proof.png', type: 'image/png', contentBase64: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMr8AAAAASUVORK5CYII=' }],
        },
      })
      expect(response.status()).toBe(outcome === 'committed' ? 201 : outcome === 'unknown' ? 503 : 409)
      expect(removed).toBe(outcome === 'rejected' ? 1 : 0)
      if (outcome === 'unknown') expect((await response.json()).error).toContain('Check your request history')
    } finally { await stop(server) }
  }
})

test('a stalled Supabase authentication request times out without accepting a session', async ({ request }) => {
  const upstream = createServer((_req, res) => {
    const timeout = setTimeout(() => { res.writeHead(503); res.end() }, 5000)
    res.on('close', () => clearTimeout(timeout))
  }).listen(0, '127.0.0.1')
  if (!upstream.listening) await new Promise<void>(resolve => upstream.once('listening', resolve))
  const settings = readConfig({ SUPABASE_URL: `http://127.0.0.1:${(upstream.address() as AddressInfo).port}`, SUPABASE_ANON_KEY: 'sb_publishable_test', UPSTREAM_TIMEOUT_MS: '1000' })
  const server = createApp(settings).listen(0, '127.0.0.1')
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve))
  try {
    const started = Date.now()
    const response = await request.get(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/me`, { headers: { Authorization: 'Bearer member-token' }, timeout: 7000 })
    expect(response.status()).toBe(503)
    expect(Date.now() - started).toBeLessThan(6000)
  } finally { upstream.closeAllConnections(); await stop(upstream); await stop(server) }
})
