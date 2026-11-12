import type { Country } from './countries'
import type { WalletCurrency } from './balances'

export type WithdrawalStatus = 'requested' | 'under_review' | 'approved' | 'rejected' | 'cancelled' | 'paid'
export type WithdrawalMethod = 'mobile_money' | 'bank' | 'wallet'
export type WithdrawalDestination = { method: WithdrawalMethod; account: string; holder?: string }
export type Withdrawal = {
  id: string
  userId: string
  country: Country
  currency: WalletCurrency
  channel: string
  amountMinor: number
  destination: WithdrawalDestination
  status: WithdrawalStatus
  version: number
  note: string
  decidedBy: string | null
  decidedAt: string | null
  paidAt: string | null
  createdAt: string
  updatedAt: string
}
export type WithdrawalDecision = 'under_review' | 'approved' | 'rejected' | 'paid'

export const withdrawalStatusLabels: Record<WithdrawalStatus, string> = {
  requested: 'Requested',
  under_review: 'Under review',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  paid: 'Paid',
}
export const withdrawalMethodLabels: Record<WithdrawalMethod, string> = {
  mobile_money: 'Mobile money',
  bank: 'Bank transfer',
  wallet: 'Wallet',
}
export function withdrawalNeedsAttention(row: Pick<Withdrawal, 'status'>) {
  return row.status === 'requested' || row.status === 'under_review'
}
export function withdrawalActions(status: WithdrawalStatus): WithdrawalDecision[] {
  if (status === 'requested' || status === 'under_review') return ['under_review', 'approved', 'rejected']
  if (status === 'approved') return ['paid', 'rejected']
  return []
}
