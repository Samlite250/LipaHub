import { expect, test } from '@playwright/test'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { SupabaseClient } from '@supabase/supabase-js'
import { invitationRouter } from '../Backend/src/invitations'
import { apiError } from '../Backend/src/auth'

test('public invitation lookup exposes only a display name and rejects invalid or suspended inviters', async ({ request }) => {
  const id = '11111111-1111-4111-8111-111111111111'
  let calls = 0
  let banned = false
  let missing = false
  let offline = false
  const service = {auth: {admin: {getUserById: async () => {
    calls++
    if (offline) throw new Error('Private upstream secret')
    return {data: {user: missing ? null : {id, email: 'private@example.invalid', app_metadata: {role: 'admin'}, user_metadata: {display_name: 'Cynthia', phone: '+250790000000'}, banned_until: banned ? '2099-01-01' : null}}, error: null}
  }}}} as unknown as SupabaseClient
  const app = express()
  app.use('/invitations', invitationRouter(service)); app.use(apiError())
  const server = app.listen(0, '127.0.0.1')
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve))
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}/invitations`
  try {
    expect((await request.get(`${origin}/invalid`)).status()).toBe(404)
    expect(calls).toBe(0)
    const response = await request.get(`${origin}/${id}`)
    expect(response.status()).toBe(200)
    expect(await response.json()).toEqual({inviter: {id, name: 'Cynthia'}})
    banned = true
    expect((await request.get(`${origin}/${id}`)).status()).toBe(404)
    banned = false; missing = true
    expect((await request.get(`${origin}/${id}`)).status()).toBe(404)
    offline = true
    const failure = await request.get(`${origin}/${id}`)
    expect(failure.status()).toBe(503)
    expect(await failure.text()).not.toContain('secret')
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); server.closeIdleConnections() }
})
