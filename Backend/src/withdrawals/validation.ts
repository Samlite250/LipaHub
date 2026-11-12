import { balanceCountry, balanceCurrency, minorAmount } from '../admin/balances.js'
import { AdminInputError, text, uuid, version } from '../admin/validation.js'

export const withdrawalChannels = ['main', 'youtube', 'trivia', 'games', 'tiktok', 'socials', 'chat'] as const
export const withdrawalStatuses = ['under_review', 'approved', 'rejected', 'paid'] as const

function destinationInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AdminInputError('Enter valid payout details.')
  const raw = value as Record<string, unknown>
  const method = raw.method
  if (typeof method !== 'string' || !['mobile_money', 'bank', 'wallet'].includes(method)) throw new AdminInputError('Select a valid payout method.')
  const account = text(raw.account, 'payout account', 200, 2)
  const holder = text(raw.holder ?? '', 'account holder', 120)
  return holder ? { method, account, holder } : { method, account }
}

export function withdrawalInput(body: Record<string, unknown>) {
  const country = balanceCountry(body.country)
  const currency = balanceCurrency(country)
  const channel = body.channel
  if (typeof channel !== 'string' || !(withdrawalChannels as readonly string[]).includes(channel)) throw new AdminInputError('Select a valid withdrawal channel.')
  if (channel !== 'main') throw new AdminInputError('Only the main balance can be withdrawn right now.')
  return { id: uuid(body.requestId), country, currency, channel, amountMinor: minorAmount(body.amount, currency), destination: destinationInput(body.destination) }
}

export function cancellationInput(body: Record<string, unknown>) {
  return { note: text(body.note ?? '', 'cancellation note', 1000), version: version(body.version) }
}

export function reviewInput(body: Record<string, unknown>) {
  const status = body.status
  if (typeof status !== 'string' || !(withdrawalStatuses as readonly string[]).includes(status)) throw new AdminInputError('Choose a valid withdrawal decision.')
  const note = text(body.note ?? '', 'review note', 1000, status === 'under_review' ? 0 : 3)
  return { status, note, version: version(body.version) }
}
