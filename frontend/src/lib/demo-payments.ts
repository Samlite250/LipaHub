import { getRobotTerms } from '../domain/robots'
import { defaultInstructions, validateInstructions, type PaymentInstructions, type PaymentRequest, type SubmitProof } from '../domain/payments'
import type { Country } from '../domain/countries'
import { openDemoDatabase, idbResult as result, idbComplete as complete } from './demo-database'
import { storedDemoBaseline, type AccountBalance, type BalanceEntry } from '../domain/balances'

const openDatabase = openDemoDatabase

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
export async function reviewDemoProof(id: string, status: 'under_review' | 'rejected' | 'verified', note: string, version: number, actorId: string): Promise<void> {
  if (status !== 'under_review' && note.trim().length < 3) throw new Error('Enter a review note before approving or rejecting.')
  const db = await openDatabase()
  try {
    const tx = db.transaction(['requests', 'wallets', 'entries'], 'readwrite'); const done = complete(tx); const store = tx.objectStore('requests')
    const row = await result<PaymentRequest | undefined>(store.get(id))
    if (row && row.status === status && row.reviewNote === note.trim() && (row.reviewVersion || 1) === version + 1) { await done; return }
    if (!row || !['pending_review', 'under_review'].includes(row.status) || (row.reviewVersion || 1) !== version) { tx.abort(); await done.catch(() => {}); throw new Error('This request was already reviewed or changed. Reload it.') }
    let bonusCreditedMinor = 0
    if (status === 'verified') {
      const baseline = storedDemoBaseline(row.userId, row.country)
      const wallet = await result<AccountBalance | undefined>(tx.objectStore('wallets').get(`${row.userId}:${row.country}`)) || baseline
      bonusCreditedMinor = row.quote.bonusMinor || Math.round(row.quote.bonus * (['RWF', 'BIF', 'UGX'].includes(wallet.currency) ? 1 : 100))
      if (!row.files.length || !Number.isSafeInteger(bonusCreditedMinor) || bonusCreditedMinor < 1 || wallet.bonusMinor + bonusCreditedMinor > 1_000_000_000_000) { tx.abort(); await done.catch(() => {}); throw new Error('Invalid payment proof or saved bonus.') }
      const now = new Date().toISOString()
      const entry: BalanceEntry = { id: crypto.randomUUID(), userId: row.userId, country: row.country, currency: wallet.currency, availableBefore: wallet.availableMinor, availableAfter: wallet.availableMinor, bonusBefore: wallet.bonusMinor, bonusAfter: wallet.bonusMinor + bonusCreditedMinor, clearingDelta: -bonusCreditedMinor, reason: `Robot activation bonus: ${row.planId} (${row.id})`, actorId, requestId: row.id, createdAt: now }
      tx.objectStore('entries').add(entry)
      tx.objectStore('wallets').put({ ...wallet, id: `${row.userId}:${row.country}`, bonusMinor: wallet.bonusMinor + bonusCreditedMinor, version: wallet.version + 1, updatedAt: now })
    }
    store.put({ ...row, status, reviewNote: note.trim(), reviewVersion: version + 1, reviewedAt: new Date().toISOString(), bonusCreditedMinor }); await done
    window.dispatchEvent(new CustomEvent('lipahub-balance-changed', { detail: { userId: row.userId, country: row.country } }))
  } finally { db.close() }
}
