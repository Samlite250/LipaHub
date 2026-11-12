import { platformApi } from './platform'
import { countries, type Country } from '../domain/countries'
import { validateInstructions, validateProofImages, type PaymentAccess, type PaymentInstructions, type PaymentRequest, type SubmitProof } from '../domain/payments'
import { demoInstructions, demoRequests, reviewDemoProof, saveDemoInstructions, submitDemoProof } from './demo-payments'

async function api<T>(access: PaymentAccess, path: string, init: RequestInit = {}): Promise<T> {
  if (!('accessToken' in access)) throw new Error('A real signed-in account is required.')
  return platformApi<T>(access.accessToken, `/api/robot-payments${path}`, init)
}
export function loadInstructions(access: PaymentAccess, country: Country) { return 'demoId' in access ? demoInstructions(country) : api<PaymentInstructions>(access, `/instructions/${encodeURIComponent(country)}`) }
export function loadAllInstructions(access: PaymentAccess) { return 'demoId' in access ? Promise.all(countries.map(country => demoInstructions(country))) : api<PaymentInstructions[]>(access, '/instructions') }
export function saveInstructions(access: PaymentAccess, value: PaymentInstructions) {
  const error = validateInstructions(value)
  if (error) return Promise.reject(new Error(error))
  return 'demoId' in access ? saveDemoInstructions(value) : api<PaymentInstructions>(access, `/admin/instructions/${encodeURIComponent(value.country)}`, { method: 'PUT', body: JSON.stringify(value) })
}
export function loadRequests(access: PaymentAccess, admin = false): Promise<PaymentRequest[]> {
  return 'demoId' in access ? demoRequests(admin ? undefined : access.demoId) : api(access, admin ? '/admin/requests' : '/requests')
}
function base64(file: File): Promise<string> { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Unable to read screenshot.')); reader.readAsDataURL(file) }) }
export async function submitProof(access: PaymentAccess, input: SubmitProof): Promise<PaymentRequest> {
  if ('demoId' in access && input.purpose === 'account_activation') throw new Error('A real registered account is required for account activation.')
  if (input.fullName.trim().length < 2 || input.fullName.trim().length > 120 || [...input.fullName].some(char => char.charCodeAt(0) < 32)) throw new Error('Enter your full name (2–120 characters).')
  if (!/^\+[1-9]\d{6,14}$/.test(input.phone.trim())) throw new Error('Enter a phone number including its country code, such as +25712345678.')
  if (input.transactionReference.length > 100) throw new Error('The payment reference is too long.')
  await validateProofImages(input.files)
  if ('demoId' in access) return submitDemoProof(access.demoId, input)
  const files = await Promise.all(input.files.map(async file => ({ name: file.name, type: file.type, contentBase64: await base64(file) })))
  return api(access, '/requests', { method: 'POST', body: JSON.stringify({ ...input, files }) })
}
export function reviewProof(access: PaymentAccess, id: string, status: 'under_review' | 'rejected' | 'verified', note: string, version = 1) {
  return 'demoId' in access ? reviewDemoProof(id, status, note, version, access.demoId) : api<void>(access, `/admin/requests/${id}`, { method: 'PATCH', body: JSON.stringify({ status, note, version }) })
}
export async function proofImageUrl(access: PaymentAccess, request: PaymentRequest, fileId: string): Promise<string> {
  if ('demoId' in access) {
    const file = request.files.find(file => file.id === fileId)
    if (!file?.blob) throw new Error('This preview image is unavailable.')
    return URL.createObjectURL(file.blob)
  }
  return (await api<{ url: string }>(access, `/requests/${request.id}/files/${fileId}`)).url
}
