import { platformApi } from './platform'
import type { PaymentAccess } from '../domain/payments'
import { defaultSettings, type AuditRecord, type Collection, type ContentDraft, type ContentRecord, type ManagedUser, type SiteSettings, type UserDraft } from '../domain/admin'
import { normalizeCountry } from '../domain/countries'
import { demoBalanceEntries } from './balances'

async function api<T>(access: PaymentAccess, path: string, init: RequestInit = {}): Promise<T> {
  if (!('accessToken' in access)) throw new Error('Live administrator access required.')
  return platformApi<T>(access.accessToken, `/api/admin${path}`, init)
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const open = indexedDB.open('lipahub-system-preview', 1)
    open.onupgradeneeded = () => { for (const name of ['users', 'records', 'settings', 'audit']) open.result.createObjectStore(name, { keyPath: 'id' }) }
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(new Error('Browser storage is unavailable. No change was saved.'))
  })
}
function result<T>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
async function readAll<T>(store: string): Promise<T[]> { const db = await database(); try { return await result(db.transaction(store).objectStore(store).getAll()) } finally { db.close() } }
async function mutate<T>(store: string, actor: string, action: string, id: string, operation: (store: IDBObjectStore) => Promise<T>): Promise<T> {
  const db = await database()
  try {
    const tx = db.transaction([store, 'audit'], 'readwrite')
    const done = new Promise<void>((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error || new Error('No change was saved.')); tx.onerror = () => reject(tx.error) })
    try {
      const value = await operation(tx.objectStore(store))
      tx.objectStore('audit').put({ id: crypto.randomUUID(), actor_id: actor, action, target_id: id, outcome: 'succeeded', created_at: new Date().toISOString() })
      await done; return value
    } catch (error) { try { tx.abort() } catch { /* Transaction already finished. */ } await done.catch(() => {}); throw error }
  } finally { db.close() }
}
export async function ensureDemoAdmin(id: string, name: string, country: string) {
  const users = await readAll<ManagedUser>('users')
  const current = users.find(user => user.id === id)
  const normalized = normalizeCountry(country) || 'Rwanda'
  if (current) {
    if (current.name !== name || current.country !== normalized) await mutate('users', id, 'users.demo.profile.sync', id, async store => {
      const latest = await result<ManagedUser | undefined>(store.get(id))
      if (latest) store.put({ ...latest, name, country: normalized, updatedAt: new Date().toISOString() })
    })
    return
  }
  const now = new Date().toISOString()
  await mutate('users', id, 'users.demo.open', id, async store => { store.put({ id, name, phone: '', country: normalizeCountry(country) || 'Rwanda', email: `demo-${id.slice(0, 8)}@example.invalid`, role: 'admin', status: 'active', createdAt: now, updatedAt: now, lastSignInAt: null }) })
}
export async function listUsers(access: PaymentAccess, page: number) {
  if ('accessToken' in access) return api<{ users: ManagedUser[]; page: number; hasMore: boolean }>(access, `/users?page=${page}`)
  const users = (await readAll<ManagedUser>('users')).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return { users: users.slice((page - 1) * 50, page * 50), page, hasMore: users.length > page * 50 }
}
export async function saveUser(access: PaymentAccess, input: UserDraft, existing?: ManagedUser) {
  if (input.name.trim().length < 2 || input.name.trim().length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) throw new Error('Enter a valid display name and email address.')
  if (input.phone && !/^\+[1-9]\d{6,14}$/.test(input.phone)) throw new Error('Use a phone number including its country code.')
  if ('accessToken' in access) return api<ManagedUser>(access, existing ? `/users/${existing.id}` : '/users', { method: existing ? 'PUT' : 'POST', body: JSON.stringify({ ...input, updatedAt: existing?.updatedAt }) })
  const id = existing?.id || crypto.randomUUID()
  return mutate('users', access.demoId, existing ? 'users.update' : 'users.create', id, async store => {
    const current = existing ? await result<ManagedUser | undefined>(store.get(id)) : null
    if (existing && (!current || current.updatedAt !== existing.updatedAt)) throw new Error('User changed. Reload before saving.')
    if (id === access.demoId && (input.role !== 'admin' || input.status !== 'active')) throw new Error('You cannot remove your own administrator access or suspend yourself.')
    if ((await result<ManagedUser[]>(store.getAll())).some(user => user.id !== id && user.email.toLowerCase() === input.email.trim().toLowerCase())) throw new Error('This email is already in use.')
    const { password: _password, ...profile } = input
    const row: ManagedUser = { ...profile, email: input.email.trim().toLowerCase(), name: input.name.trim(), id, createdAt: current?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(), lastSignInAt: current?.lastSignInAt || null }
    store.put(row); return row
  })
}
export async function deleteUser(access: PaymentAccess, user: ManagedUser, confirmEmail: string) {
  if (confirmEmail !== user.email) throw new Error('Enter the user’s exact email address to confirm.')
  if ('accessToken' in access) return api<void>(access, `/users/${user.id}`, { method: 'DELETE', body: JSON.stringify({ confirmEmail, updatedAt: user.updatedAt }) })
  if (user.id === access.demoId) throw new Error('You cannot delete your own administrator account.')
  if ((await demoBalanceEntries()).some(entry => entry.userId === user.id)) throw new Error('This user has balance adjustment history. Suspend the account to preserve its records.')
  return mutate('users', access.demoId, 'users.delete', user.id, async store => {
    const current = await result<ManagedUser | undefined>(store.get(user.id))
    if (!current || current.updatedAt !== user.updatedAt) throw new Error('User changed. Reload before deleting.')
    store.delete(user.id)
  })
}
export async function listRecords(access: PaymentAccess, collection: Collection) {
  return 'accessToken' in access ? api<ContentRecord[]>(access, `/records/${collection}`) : (await readAll<ContentRecord>('records')).filter(row => row.collection === collection).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}
export async function saveRecord(access: PaymentAccess, collection: Collection, input: ContentDraft, existing?: ContentRecord) {
  if (input.title.trim().length < 2 || input.title.trim().length > 160 || input.description.trim().length < 2 || input.description.trim().length > 8000) throw new Error('Enter a title and description within the allowed lengths.')
  input = { ...input, title: input.title.trim(), description: input.description.trim(), url: input.url.trim() }
  if (input.url) { const url = new URL(input.url); if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Use an HTTPS link without credentials.') }
  if ('accessToken' in access) return api<ContentRecord>(access, `/records/${collection}${existing ? `/${existing.id}` : ''}`, { method: existing ? 'PUT' : 'POST', body: JSON.stringify({ ...input, version: existing?.version }) })
  const id = existing?.id || crypto.randomUUID()
  return mutate('records', access.demoId, `${collection}.${existing ? 'update' : 'create'}`, id, async store => {
    const current = existing ? await result<ContentRecord | undefined>(store.get(id)) : null
    if (existing && (!current || current.version !== existing.version)) throw new Error('Record changed. Reload before saving.')
    const row: ContentRecord = { ...input, id, collection, version: (current?.version || 0) + 1, createdAt: current?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() }
    store.put(row); return row
  })
}
export async function deleteRecord(access: PaymentAccess, row: ContentRecord) {
  if ('accessToken' in access) return api<void>(access, `/records/${row.collection}/${row.id}`, { method: 'DELETE', body: JSON.stringify({ version: row.version }) })
  return mutate('records', access.demoId, `${row.collection}.delete`, row.id, async store => {
    const current = await result<ContentRecord | undefined>(store.get(row.id))
    if (!current || current.version !== row.version) throw new Error('Record changed. Reload before deleting.')
    store.delete(row.id)
  })
}
export async function loadSettings(access: PaymentAccess): Promise<SiteSettings> {
  if ('accessToken' in access) return api(access, '/settings')
  return (await readAll<SiteSettings & { id: string }>('settings'))[0] || { ...defaultSettings }
}
export async function saveSettings(access: PaymentAccess, input: SiteSettings) {
  if (input.siteName.trim().length < 2 || input.siteName.trim().length > 60) throw new Error('Enter a site name between 2 and 60 characters.')
  if (input.supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.supportEmail.trim())) throw new Error('Enter a valid support email.')
  input = { ...input, siteName: input.siteName.trim(), supportEmail: input.supportEmail.trim(), supportMessage: input.supportMessage.trim() }
  if ('accessToken' in access) return api<SiteSettings>(access, '/settings', { method: 'PUT', body: JSON.stringify(input) })
  return mutate('settings', access.demoId, 'settings.update', 'general', async store => {
    const current = await result<(SiteSettings & { id: string }) | undefined>(store.get('general'))
    if ((current?.version || 1) !== input.version) throw new Error('Settings changed. Reload before saving.')
    const next = { ...input, version: input.version + 1 }; store.put({ ...next, id: 'general' }); return next
  })
}
export async function loadAudit(access: PaymentAccess) {
  if ('accessToken' in access) return api<AuditRecord[]>(access, '/audit')
  const [records, balances] = await Promise.all([readAll<AuditRecord>('audit'), demoBalanceEntries()])
  const adjustments: AuditRecord[] = balances.map(entry => ({ id: entry.id, actor_id: entry.actorId, action: 'balances.adjust', target_id: `${entry.userId}:${entry.country}`, outcome: 'succeeded', created_at: entry.createdAt }))
  return [...records, ...adjustments].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 200)
}
export async function memberContent(access: PaymentAccess, country: string): Promise<{ records: ContentRecord[]; settings: SiteSettings }> {
  if ('demoId' in access) return { records: (await readAll<ContentRecord>('records')).filter(row => row.status === 'published' && (row.country === 'All countries' || row.country === normalizeCountry(country))), settings: await loadSettings(access) }
  return platformApi(access.accessToken, '/api/member-content')
}
