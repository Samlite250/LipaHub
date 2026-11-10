import { expect, test } from '@playwright/test'
import { activateRobot, getRobotTerms, robotWallet, ROBOT_CATALOG } from '../frontend/src/domain/robots'
import { countries } from '../frontend/src/domain/countries'
import { quote, screenshot } from '../Backend/src/payments/validation'
import express from 'express'
import { once } from 'node:events'
import type { AddressInfo } from 'node:net'
import type { SupabaseClient } from '@supabase/supabase-js'
import { paymentRouter } from '../Backend/src/payments/router'

test('server-authoritative quotes match all displayed country prices and currency precision', () => {
  for (const country of countries.filter(country => country !== 'Rwanda')) {
    for (const robot of ROBOT_CATALOG) {
      const displayed = getRobotTerms(robot.id, country)!
      expect(quote(robot.id, country)).toMatchObject(displayed)
    }
  }
  expect(() => quote('robot-01', 'Rwanda')).toThrow()
  expect(() => quote('robot-99', 'Burundi')).toThrow()
})
test('legacy demo activation arithmetic stays idempotent and cannot spend bonus credits', () => {
  const ids = activateRobot([], 'robot-01', 'Burundi')
  expect(activateRobot(ids, 'robot-01', 'Burundi')).toEqual(ids)
  expect(activateRobot(ids, 'robot-33', 'Burundi')).toEqual(ids)
  expect(robotWallet(ids, 'Burundi')).toMatchObject({ available: 940000, bonus: 261000, spent: 60000 })
  expect(activateRobot([], 'robot-01', 'Rwanda')).toEqual([])
  const kenya = robotWallet(activateRobot([], 'robot-01', 'Kenya'), 'Kenya')
  expect(kenya.availableMinor).toBe(4059108)
  expect(kenya.bonusMinor).toBe(1127050)
})
test('backend proof validation rejects disguised images, oversized dimensions and unsafe formats', () => {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aMr8AAAAASUVORK5CYII=', 'base64')
  expect(screenshot({ name: 'proof.png', type: 'image/png', contentBase64: png.toString('base64') }).bytes.length).toBe(png.length)
  expect(() => screenshot({ name: 'proof.png', type: 'image/png', contentBase64: Buffer.from('<script>bad</script>').toString('base64') })).toThrow()
  expect(() => screenshot({ name: 'proof.svg', type: 'image/svg+xml', contentBase64: png.toString('base64') })).toThrow()
  const huge = Buffer.from(png); huge.writeUInt32BE(50000, 16)
  expect(() => screenshot({ name: 'proof.png', type: 'image/png', contentBase64: huge.toString('base64') })).toThrow()
})
test('admin routes trust verified app metadata instead of user metadata or submitted roles', async () => {
  const originalUrl = process.env.SUPABASE_URL
  const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  process.env.SUPABASE_URL = 'http://127.0.0.1:9'
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key-not-a-live-credential'
  const verifiedMember = { id: '11111111-1111-4111-8111-111111111111', app_metadata: { role: 'member' }, user_metadata: { role: 'admin' }, aud: 'authenticated', created_at: '2026-11-09T00:00:00Z' }
  const auth = { auth: { getUser: async () => ({ data: { user: verifiedMember }, error: null }) } } as unknown as SupabaseClient
  const app = express(); app.use('/payments', paymentRouter(auth))
  const server = app.listen(0, '127.0.0.1')
  try {
    await once(server, 'listening')
    const port = (server.address() as AddressInfo).port
    const response = await fetch(`http://127.0.0.1:${port}/payments/admin/instructions/Burundi`, { method: 'PUT', headers: { Authorization: 'Bearer test-member-session', 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'admin', methods: [] }) })
    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: 'Administrator access required' })
  } finally {
    await new Promise<void>((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeAllConnections() })
    if (originalUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = originalUrl
    if (originalKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY; else process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey
  }
})
