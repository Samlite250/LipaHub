import { expect, test } from '@playwright/test'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { AddressInfo } from 'node:net'
import { createApp } from '../Backend/src/app'
import { readConfig } from '../Backend/src/config'

test('payment approvals use trusted admin identity, saved amounts and a required review version', async ({ request }) => {
  const id = '11111111-1111-4111-8111-111111111111'
  const member = {id, app_metadata: {}, user_metadata: {role: 'admin'}} as unknown as User
  const admin = {...member, id: '22222222-2222-4222-8222-222222222222', app_metadata: {role: 'admin'}}
  const calls: Record<string, unknown>[] = []
  let failure: string | null = null
  const auth = {auth: {getUser: async (token: string) => ({data: {user: token === 'admin-token' ? admin : member}, error: null})}} as unknown as SupabaseClient
  const service = {rpc: async (_name: string, args: Record<string, unknown>) => { calls.push(args); return {error: failure ? {code: failure} : null} }} as unknown as SupabaseClient
  const server = createApp(readConfig({}), {auth, service}).listen(0, '127.0.0.1')
  if (!server.listening) await new Promise<void>(resolve => server.once('listening', resolve))
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/robot-payments/admin/requests/${id}`
  try {
    const data = {status: 'verified', note: 'Matched payment records', version: 1, bonusMinor: 999999, actor: member.id}
    expect((await request.patch(url, {headers: {Authorization: 'Bearer member-token'}, data})).status()).toBe(403)
    expect(calls).toHaveLength(0)
    expect((await request.patch(url, {headers: {Authorization: 'Bearer admin-token'}, data: {...data, version: undefined}})).status()).toBe(400)
    expect((await request.patch(url, {headers: {Authorization: 'Bearer admin-token'}, data})).status()).toBe(204)
    expect(calls[0]).toEqual({p_id: id, p_actor: admin.id, p_status: 'verified', p_note: data.note, p_expected_version: 1})
    failure = '40001'
    expect((await request.patch(url, {headers: {Authorization: 'Bearer admin-token'}, data})).status()).toBe(409)
    failure = '42501'
    expect((await request.patch(url, {headers: {Authorization: 'Bearer admin-token'}, data})).status()).toBe(403)
  } finally { await new Promise<void>(resolve => { server.close(() => resolve()); server.closeIdleConnections() }) }
})

test('legacy preview proofs and wallets migrate together and concurrent approvals credit once', async ({ page }) => {
  await page.goto('/login')
  const outcome = await page.evaluate(async () => {
    async function open(name: string, stores: [string, string][]) {
      return new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(name, 1)
        request.onupgradeneeded = () => { for (const [store, keyPath] of stores) request.result.createObjectStore(store, {keyPath}) }
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
      })
    }
    const id = crypto.randomUUID(); const userId = crypto.randomUUID()
    const old = await open('lipahub-payment-preview', [['instructions', 'country'], ['requests', 'id']])
    const proof = {id, userId, country: 'Burundi', planId: 'robot-01', status: 'pending_review', fullName: 'Legacy test', phone: '+25779000000', submittedAt: new Date().toISOString(), reviewNote: '', transactionReference: '', instructionVersion: 1, paymentMethod: {name: 'Lumicash'}, quote: {value: 60000, bonus: 261000, bonusMinor: 261000, currency: 'BIF'}, files: [{id: crypto.randomUUID(), name: 'TEST-NOT-RECEIPT.png', type: 'image/png', size: 1}]}
    await new Promise<void>(resolve => { const tx = old.transaction('requests', 'readwrite'); tx.objectStore('requests').put(proof); tx.oncomplete = () => resolve() }); old.close()
    const balances = await open('lipahub-balance-preview', [['wallets', 'id'], ['entries', 'requestId']])
    await new Promise<void>(resolve => { const tx = balances.transaction('wallets', 'readwrite'); tx.objectStore('wallets').put({id: `${userId}:Burundi`, userId, country: 'Burundi', currency: 'BIF', availableMinor: 1000000, bonusMinor: 100, version: 1, updatedAt: null}); tx.oncomplete = () => resolve() }); balances.close()
    const paymentPath = '/src/lib/payments.ts'; const balancePath = '/src/lib/balances.ts'
    const payments = await import(paymentPath); const wallet = await import(balancePath)
    const access = {demoId: 'local-qa-admin'}
    await Promise.all([payments.reviewProof(access, id, 'verified', 'Matched legacy test', 1), payments.reviewProof(access, id, 'verified', 'Matched legacy test', 1)])
    const state = await wallet.getBalance(access, userId, 'Burundi')
    const receipt = (await payments.loadRequests(access, true)).find((row: {id: string}) => row.id === id)
    return {bonus: state.wallet.bonusMinor, available: state.wallet.availableMinor, entries: state.history.length, status: receipt.status}
  })
  expect(outcome).toEqual({bonus: 261100, available: 1000000, entries: 1, status: 'verified'})
})
