import { platformApi } from './platform'
import type { PaymentAccess } from '../domain/payments'
import type { Withdrawal, WithdrawalDecision } from '../domain/withdrawals'

export function listWithdrawals(access: PaymentAccess): Promise<Withdrawal[]> {
  if (!('accessToken' in access)) return Promise.reject(new Error('Live administrator access is required to review withdrawals.'))
  return platformApi<Withdrawal[]>(access.accessToken, '/api/withdrawals/admin/requests')
}
export function reviewWithdrawal(access: PaymentAccess, row: Withdrawal, decision: WithdrawalDecision, note: string): Promise<Withdrawal> {
  if (!('accessToken' in access)) return Promise.reject(new Error('Live administrator access is required to review withdrawals.'))
  return platformApi<Withdrawal>(access.accessToken, `/api/withdrawals/admin/requests/${row.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: decision, note, version: row.version }),
  })
}
