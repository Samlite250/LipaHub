import { useEffect, useState } from 'react'
import { platformApi } from './platform'
import type { PaymentInstructions, PaymentRequest } from '../domain/payments'

export type AccountActivationStatus = {required: boolean; active: boolean; request: PaymentRequest | null; instructions: Pick<PaymentInstructions, 'country' | 'version' | 'methods' | 'intakeEnabled'>}
export function useAccountActivation(token: string | undefined, enabled: boolean, poll = false) {
  const [state, setState] = useState<{token: string; data?: AccountActivationStatus; error?: string}>({token: ''})
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!enabled || !token) return
    let active = true; let sequence = 0
    const load = () => {
      const request = ++sequence
      void platformApi<AccountActivationStatus>(token, '/api/account-activation').then(data => { if (active && sequence === request) setState({token, data}) }).catch(error => { if (active && sequence === request) setState({token, error: error.message || 'Unable to check account activation.'}) })
    }
    load()
    const visible = () => { if (document.visibilityState === 'visible') load() }
    const timer = poll ? window.setInterval(visible, 15000) : null
    if (poll) window.addEventListener('focus', visible)
    return () => { active = false; if (timer) window.clearInterval(timer); window.removeEventListener('focus', visible) }
  }, [token, enabled, poll, revision])
  const current = enabled && state.token === token ? state : null
  return {data: current?.data, error: current?.error, loading: enabled && !!token && !current?.data && !current?.error, refresh: () => setRevision(value => value + 1)}
}
