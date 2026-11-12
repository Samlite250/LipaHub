import { platformApi } from './platform'
import type { PaymentAccess } from '../domain/payments'

export type SupportTicket = { id: string; user_id: string; subject: string; status: 'open' | 'closed'; version: number; created_at: string; updated_at: string }
export function listSupportTickets(access: PaymentAccess): Promise<SupportTicket[]> {
  if (!('accessToken' in access)) return Promise.reject(new Error('Live administrator access is required to read support requests.'))
  return platformApi<SupportTicket[]>(access.accessToken, '/api/support')
}
