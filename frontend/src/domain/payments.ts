import proofLimits from '../../../shared/proof-limits.json' with { type: 'json' }
import { countries, type Country } from './countries'

export type PaymentMethod = { id: string; name: string; recipient: string; accountName: string; asset: string; network: string; instructions: string; enabled: boolean }
export type PaymentInstructions = { country: Country; version: number; methods: PaymentMethod[]; updatedAt: string | null; intakeEnabled: boolean }
export type ProofStatus = 'pending_review' | 'under_review' | 'rejected' | 'verified'
export type ProofAttachment = { id: string; name: string; type: string; size: number; blob?: Blob }
export type PaymentRequest = {
  id: string; userId: string; country: Country; planId: string; status: ProofStatus; fullName: string; phone: string; transactionReference: string
  instructionVersion: number; paymentMethod: PaymentMethod; quote: { value: number; bonus: number; currency: string }; files: ProofAttachment[]; submittedAt: string; reviewNote: string
}
export type PaymentAccess = { demoId: string } | { accessToken: string }
export type SubmitProof = { country: Country; planId: string; methodId: string; instructionVersion: number; fullName: string; phone: string; transactionReference: string; files: File[] }

export function defaultInstructions(country: Country): PaymentInstructions {
  const names = country === 'Burundi' ? ['Lumicash', 'Code'] : country === 'Rwanda' ? ['Payment instructions'] : ['Binance TRC']
  return { country, version: 0, updatedAt: null, intakeEnabled: false, methods: names.map((name, i) => ({ id: `${country.toLowerCase().replaceAll(' ', '-')}-${i + 1}`, name, recipient: '', accountName: '', asset: '', network: name === 'Binance TRC' ? 'TRC' : '', instructions: '', enabled: false })) }
}
export function validateInstructions(value: PaymentInstructions): string | null {
  if (!countries.includes(value.country) || !Number.isInteger(value.version) || value.version < 0 || !Array.isArray(value.methods) || value.methods.length < 1 || value.methods.length > 5) return 'Invalid payment configuration.'
  const ids = new Set<string>()
  for (const method of value.methods) {
    if (!method.id || method.id.length > 80 || ids.has(method.id) || !method.name.trim() || method.name.length > 80) return 'Payment methods need unique IDs and names.'
    ids.add(method.id)
    if ([method.recipient, method.accountName, method.asset, method.network, method.instructions].some(item => typeof item !== 'string') || method.recipient.length > 200 || method.accountName.length > 120 || method.asset.length > 40 || method.network.length > 80 || method.instructions.length > 4000) return 'Payment instructions exceed the allowed length.'
    if (method.enabled && method.instructions.trim().length < 10) return `Enter clear instructions before publishing ${method.name}.`
    if (method.enabled && value.country !== 'Rwanda' && !method.recipient.trim()) return `Enter the recipient details for ${method.name}.`
    if (method.enabled && method.name === 'Binance TRC' && (!method.asset.trim() || !method.network.trim())) return 'Specify the crypto asset and network before publishing Binance TRC.'
  }
  return null
}
export async function validateProofImages(files: File[]) {
  if (!files.length || files.length > proofLimits.maxFiles) throw new Error('Attach 1–3 payment screenshots.')
  if (files.reduce((total, file) => total + file.size, 0) > proofLimits.maxTotalBytes) throw new Error('Screenshots must total 3 MB or less. Use smaller images.')
  for (const file of files) {
    if (!['image/png', 'image/jpeg'].includes(file.type)) throw new Error('Screenshots must be PNG or JPEG images.')
    if (!file.size || file.size > proofLimits.maxFileBytes) throw new Error('Each screenshot must be 3 MB or smaller.')
    let image: ImageBitmap
    try { image = await createImageBitmap(file) } catch { throw new Error('One screenshot is not a valid image.') }
    const invalid = image.width > 12000 || image.height > 12000 || image.width * image.height > 20000000
    image.close()
    if (invalid) throw new Error('Screenshot dimensions are too large. Use a smaller image.')
  }
}
