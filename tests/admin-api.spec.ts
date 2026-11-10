import { expect, test } from '@playwright/test'
import express from 'express'
import type { AddressInfo } from 'node:net'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import { adminRouter } from '../Backend/src/admin/router'
import { recordInput, settingsInput, userInput } from '../Backend/src/admin/validation'

test('admin API verifies trusted roles, protects self access and performs sanitized user CRUD', async ({ request }) => {
  const actorId = '11111111-1111-4111-8111-111111111111'
  const memberId = '22222222-2222-4222-8222-222222222222'
  const actor = { id: actorId, email: 'admin@example.invalid', user_metadata: { display_name: 'Admin', country: 'Rwanda', privateValue: 'not-public' }, app_metadata: { role: 'admin', retained: 'keep' }, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z' } as unknown as User
  const member = { ...actor, id: memberId, app_metadata: { role: 'member' }, user_metadata: { role: 'admin', privateValue: 'not-public', display_name: 'Member', country: 'Kenya' } } as User
  const users = new Map<string, User>([[actorId, actor], [memberId, member]])
  const audit: { outcome: string }[] = []
  let createAttributes: Record<string, unknown> = {}
  const auth = { auth: { getUser: async (token: string) => ({ data: { user: token === 'admin-token' ? actor : token === 'member-token' ? member : token === 'banned-token' ? { ...actor, banned_until: '2099-01-01T00:00:00Z' } : null }, error: null }) } } as unknown as SupabaseClient
  const service = {
    from: () => ({
      insert: () => ({ select: () => ({ single: async () => { audit.push({ outcome: 'started' }); return { data: { id: audit.length }, error: null } } }) }),
      update: (value: { outcome: string }) => ({ eq: async (_field: string, id: number) => { audit[id - 1] = value; return { error: null } } }),
    }),
    auth: { admin: {
      listUsers: async () => ({ data: { users: [...users.values()] }, error: null }),
      getUserById: async (id: string) => ({ data: { user: users.get(id) || null }, error: null }),
      createUser: async (attributes: Record<string, unknown>) => { createAttributes = attributes; const user = { ...actor, ...attributes, id: '33333333-3333-4333-8333-333333333333' } as User; users.set(user.id, user); return { data: { user }, error: null } },
      updateUserById: async (id: string, attributes: Partial<User> & { ban_duration?: string }) => { const user = { ...users.get(id)!, ...attributes, banned_until: attributes.ban_duration === 'none' ? undefined : '2099-01-01T00:00:00Z', updated_at: '2026-02-01T00:00:00Z' }; users.set(id, user); return { data: { user }, error: null } },
      deleteUser: async (id: string) => { users.delete(id); return { data: { user: null }, error: null } },
    } },
  } as unknown as SupabaseClient
  const app = express(); app.use('/api/admin', adminRouter(auth, service))
  const server = app.listen(0, '127.0.0.1')
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/admin`
  const headers = { Authorization: 'Bearer admin-token' }
  try {
    expect((await request.get(`${base}/users`)).status()).toBe(401)
    expect((await request.get(`${base}/users`, { headers: { Authorization: 'Bearer member-token' } })).status()).toBe(403)
    expect((await request.post(`${base}/users`, { headers: { Authorization: 'Bearer member-token' }, data: { role: 'admin' } })).status()).toBe(403)
    expect((await request.get(`${base}/users`, { headers: { Authorization: 'Bearer banned-token' } })).status()).toBe(403)
    expect((await request.delete(`${base}/users/${actorId}`, { headers, data: { confirmEmail: actor.email } })).status()).toBe(409)
    const fields = { email: 'new@example.invalid', name: 'New Member', phone: '+25779000000', country: 'Burundi', role: 'member', status: 'active' }
    expect((await request.put(`${base}/users/${actorId}`, { headers, data: { ...fields, status: 'suspended' } })).status()).toBe(409)
    expect((await request.post(`${base}/users`, { headers, data: { ...fields, password: 'short' } })).status()).toBe(400)
    const create = await request.post(`${base}/users`, { headers, data: { ...fields, password: 'test-password-123', email_confirm: true, app_metadata: { role: 'admin' } } })
    expect(create.status()).toBe(201)
    expect(createAttributes.email_confirm).toBe(false)
    expect(createAttributes.app_metadata).toEqual({ role: 'member' })
    const created = await create.json()
    expect(created).toMatchObject({ email: fields.email, name: fields.name, role: 'member', phone: fields.phone })
    expect(created.password).toBeUndefined()
    const listing = await (await request.get(`${base}/users`, { headers })).json()
    expect(listing.users).toHaveLength(3)
    expect(JSON.stringify(listing)).not.toContain('not-public')
    const update = await request.put(`${base}/users/${created.id}`, { headers, data: { ...fields, name: 'Updated Member', status: 'suspended', updatedAt: created.updatedAt } })
    expect(update.status()).toBe(200)
    const updated = await update.json()
    expect(updated).toMatchObject({ name: 'Updated Member', status: 'suspended' })
    expect((await request.put(`${base}/users/${created.id}`, { headers, data: { ...fields, updatedAt: created.updatedAt } })).status()).toBe(409)
    expect((await request.delete(`${base}/users/${created.id}`, { headers, data: { confirmEmail: 'wrong@example.invalid', updatedAt: updated.updatedAt } })).status()).toBe(409)
    expect((await request.delete(`${base}/users/${created.id}`, { headers, data: { confirmEmail: updated.email, updatedAt: updated.updatedAt } })).status()).toBe(204)
    expect((await request.get(`${base}/users/${created.id}`, { headers })).status()).toBe(404)
    expect(audit.some(row => row.outcome === 'succeeded')).toBeTruthy()
    expect(audit.some(row => row.outcome === 'failed')).toBeTruthy()
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
})

test('admin validators reject unsafe links, invalid countries and unrecognized access states', () => {
  const resource = { title: 'Resource', description: 'Learning material', category: 'courses', status: 'published', url: 'https://example.com', country: 'All countries' }
  expect(recordInput(resource, 'resources').url).toBe('https://example.com')
  for (const url of ['javascript:alert(1)', 'http://example.com', 'https://user:secret@example.com']) expect(() => recordInput({ ...resource, url }, 'resources')).toThrow()
  expect(() => recordInput(resource, 'payments')).toThrow()
  expect(() => recordInput({ ...resource, country: 'Unknown' }, 'resources')).toThrow()
  expect(() => userInput({ email: 'test@example.invalid', name: 'Test', country: 'Rwanda', role: 'super-admin', status: 'active' })).toThrow()
  expect(() => settingsInput({ siteName: 'LipaHub', supportEmail: 'invalid', supportMessage: '', showAnnouncements: true })).toThrow()
})
