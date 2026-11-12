import { platformApi } from './platform'
import type { PaymentAccess } from '../domain/payments'
import { parseWalletAmount, storedDemoBaseline, type AccountBalance, type BalanceAdjustment, type BalanceEntry, type BalanceView } from '../domain/balances'
import type { Country } from '../domain/countries'
import { openDemoDatabase } from './demo-database'

async function api<T>(access: PaymentAccess, path: string, init: RequestInit = {}): Promise<T> {
  if (!('accessToken' in access)) throw new Error('Live authentication required.')
  return platformApi<T>(access.accessToken, path, init)
}
const database = openDemoDatabase
function result<T>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
export async function getBalance(access: PaymentAccess, userId: string, country: Country): Promise<BalanceView> {
  if ('accessToken' in access) return api(access, `/api/admin/users/${userId}/balances?country=${encodeURIComponent(country)}`)
  const db = await database()
  try {
    const tx = db.transaction(['wallets', 'entries'])
    const [wallet, entries] = await Promise.all([result<AccountBalance | undefined>(tx.objectStore('wallets').get(`${userId}:${country}`)), result<BalanceEntry[]>(tx.objectStore('entries').getAll())])
    return { wallet: wallet || storedDemoBaseline(userId, country), history: entries.filter(row => row.userId === userId && row.country === country).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 100) }
  } finally { db.close() }
}
export async function adjustBalance(access: PaymentAccess, userId: string, input: BalanceAdjustment): Promise<AccountBalance> {
  if ('accessToken' in access) return api(access, `/api/admin/users/${userId}/balances`, { method: 'POST', body: JSON.stringify(input) })
  const baseline = storedDemoBaseline(userId, input.country)
  const availableMinor = parseWalletAmount(input.available, baseline.currency); const bonusMinor = parseWalletAmount(input.bonus, baseline.currency)
  const reason = input.reason.trim()
  if (reason.length < 10 || reason.length > 500) throw new Error('Enter an adjustment reason between 10 and 500 characters.')
  const db = await database()
  try {
    const tx = db.transaction(['wallets', 'entries'], 'readwrite')
    const done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error || new Error('No balance adjustment was saved.')); tx.onerror = () => reject(tx.error) })
    try {
      const store = tx.objectStore('wallets'); const entries = tx.objectStore('entries'); const id = `${userId}:${input.country}`
      const current = await result<AccountBalance | undefined>(store.get(id)) || baseline
      const duplicate = await result<(BalanceEntry & { expectedVersion: number }) | undefined>(entries.get(input.requestId))
      if (duplicate) {
        if (duplicate.actorId !== access.demoId || duplicate.userId !== userId || duplicate.country !== input.country || duplicate.availableAfter !== availableMinor || duplicate.bonusAfter !== bonusMinor || duplicate.reason !== reason || duplicate.expectedVersion !== input.version) throw new Error('This request was already used with different adjustment details.')
        await done; return current
      }
      if (current.version !== input.version) throw new Error('This balance changed. Reload it before submitting another adjustment.')
      if (current.availableMinor === availableMinor && current.bonusMinor === bonusMinor) throw new Error('Enter a different available or bonus balance.')
      const next = { ...current, availableMinor, bonusMinor, version: current.version + 1, updatedAt: new Date().toISOString() }
      const entry: BalanceEntry & { expectedVersion: number } = { id: crypto.randomUUID(), userId, country: input.country, currency: current.currency, availableBefore: current.availableMinor, availableAfter: availableMinor, bonusBefore: current.bonusMinor, bonusAfter: bonusMinor, clearingDelta: current.availableMinor - availableMinor + current.bonusMinor - bonusMinor, reason, actorId: access.demoId, requestId: input.requestId, expectedVersion: input.version, createdAt: next.updatedAt }
      store.put({ ...next, id }); entries.put(entry)
      await done
      window.dispatchEvent(new CustomEvent('lipahub-balance-changed', { detail: { userId, country: input.country } }))
      const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lipahub-balances') : null
      channel?.postMessage({ userId, country: input.country }); channel?.close()
      return next
    } catch (error) { try { tx.abort() } catch { /* Already committed or aborted. */ } await done.catch(() => {}); throw error }
  } finally { db.close() }
}
export async function memberBalance(access: PaymentAccess, country: Country): Promise<AccountBalance> {
  return 'demoId' in access ? (await getBalance(access, access.demoId, country)).wallet : api(access, `/api/member-balances?country=${encodeURIComponent(country)}`)
}
export async function demoBalanceEntries(): Promise<BalanceEntry[]> {
  const db = await database()
  try { return await result(db.transaction('entries').objectStore('entries').getAll()) } finally { db.close() }
}
