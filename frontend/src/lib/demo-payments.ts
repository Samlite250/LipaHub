import { getRobotTerms } from '../domain/robots'
import { defaultInstructions, validateInstructions, type PaymentInstructions, type PaymentRequest, type SubmitProof } from '../domain/payments'
import type { Country } from '../domain/countries'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('lipahub-payment-preview', 1)
    request.onupgradeneeded = () => {
      request.result.createObjectStore('instructions', { keyPath: 'country' })
      request.result.createObjectStore('requests', { keyPath: 'id' })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Browser storage is unavailable. No proof was saved.'))
  })
}
function result<T>(request: IDBRequest<T>): Promise<T> { return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }) }
function complete(tx: IDBTransaction): Promise<void> { return new Promise((resolve, reject) => { tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error || new Error('Unable to save this preview.')); tx.onerror = () => reject(tx.error) }) }

export async function demoInstructions(country: Country): Promise<PaymentInstructions> {
  const db = await openDatabase()
  try { return await result<PaymentInstructions | undefined>(db.transaction('instructions').objectStore('instructions').get(country)) || { ...defaultInstructions(country), intakeEnabled: true } } finally { db.close() }
}
export async function saveDemoInstructions(value: PaymentInstructions): Promise<PaymentInstructions> {
  const error = validateInstructions(value)
  if (error) throw new Error(error)
  const db = await openDatabase()
  try {
    const tx = db.transaction('instructions', 'readwrite'); const done = complete(tx)
    const store = tx.objectStore('instructions')
    const current = await result<PaymentInstructions | undefined>(store.get(value.country))
    if ((current?.version || 0) !== value.version) { tx.abort(); await done.catch(() => {}); throw new Error('Instructions changed. Reload them before saving.') }
    const next = { ...value, version: value.version + 1, updatedAt: new Date().toISOString(), intakeEnabled: true }
    store.put(next); await done; return next
  } finally { db.close() }
}
export async function demoRequests(userId?: string): Promise<PaymentRequest[]> {
  const db = await openDatabase()
  try { const rows = await result<PaymentRequest[]>(db.transaction('requests').objectStore('requests').getAll()); return rows.filter(row => !userId || row.userId === userId).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)) } finally { db.close() }
}
export async function submitDemoProof(userId: string, input: SubmitProof): Promise<PaymentRequest> {
  const quote = getRobotTerms(input.planId, input.country)
  if (!quote) throw new Error('This plan is unavailable for the selected country.')
  const db = await openDatabase()
  try {
    const tx = db.transaction(['instructions', 'requests'], 'readwrite'); const done = complete(tx)
    const instructions = await result<PaymentInstructions | undefined>(tx.objectStore('instructions').get(input.country))
    const method = instructions?.methods.find(item => item.id === input.methodId && item.enabled)
    const rows = await result<PaymentRequest[]>(tx.objectStore('requests').getAll())
    const duplicate = rows.find(row => row.userId === userId && row.country === input.country && row.planId === input.planId && row.status !== 'rejected')
    if (!instructions || !method || instructions.version !== input.instructionVersion || duplicate) {
      tx.abort(); await done.catch(() => {}); throw new Error(duplicate ? 'This plan already has a pending request.' : 'Payment instructions changed. Close and reopen this plan before submitting.')
    }
    const row: PaymentRequest = { id: crypto.randomUUID(), userId, country: input.country, planId: input.planId, status: 'pending_review', fullName: input.fullName.trim(), phone: input.phone.trim(), transactionReference: input.transactionReference.trim(), instructionVersion: instructions.version, paymentMethod: method, quote, files: input.files.map(file => ({ id: crypto.randomUUID(), name: file.name, type: file.type, size: file.size, blob: file })), submittedAt: new Date().toISOString(), reviewNote: '' }
    tx.objectStore('requests').put(row); await done; return row
  } finally { db.close() }
}
export async function reviewDemoProof(id: string, status: 'under_review' | 'rejected', note: string): Promise<void> {
  const db = await openDatabase()
  try {
    const tx = db.transaction('requests', 'readwrite'); const done = complete(tx); const store = tx.objectStore('requests')
    const row = await result<PaymentRequest | undefined>(store.get(id))
    if (!row || !['pending_review', 'under_review'].includes(row.status)) { tx.abort(); await done.catch(() => {}); throw new Error('This request cannot be changed.') }
    store.put({ ...row, status, reviewNote: note.trim() }); await done
  } finally { db.close() }
}
