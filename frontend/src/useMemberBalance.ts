import { useEffect, useMemo, useState } from 'react'
import { useApp } from './state'
import { normalizeCountry } from './domain/countries'
import { demoBalance, type AccountBalance } from './domain/balances'
import type { PaymentAccess } from './domain/payments'
import { memberBalance } from './lib/balances'

export function useMemberBalance() {
  const { demo, session } = useApp()
  const country = normalizeCountry(demo?.country || session?.user.user_metadata.country) || 'International'
  const userId = demo?.id || session?.user.id || ''; const token = session?.access_token; const demoId = demo?.id
  const access = useMemo<PaymentAccess | null>(() => demoId ? { demoId } : token ? { accessToken: token } : null, [demoId, token])
  const key = `${userId}:${country}`
  const [state, setState] = useState<{ key: string; wallet: AccountBalance | null; error: string }>({ key: '', wallet: null, error: '' })
  const [revision, setRevision] = useState(0)
  const ids = JSON.stringify(demo?.robotIdsByCountry[country] || [])
  useEffect(() => {
    if (!access) return
    let active = true; let sequence = 0
    const refresh = () => {
      const request = ++sequence
      memberBalance(access, country).then(wallet => { if (active && request === sequence) setState({ key, wallet, error: '' }) }).catch(error => { if (active && request === sequence) setState({ key, wallet: null, error: error.message || 'Account balance is unavailable.' }) })
    }
    refresh()
    const changed = (event: Event) => { const detail = (event as CustomEvent).detail; if (!detail || (detail.userId === userId && detail.country === country)) refresh() }
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lipahub-balances') : null
    if (channel) channel.onmessage = event => { if (event.data.userId === userId && event.data.country === country) refresh() }
    const timer = window.setInterval(visible, 30_000)
    window.addEventListener('focus', refresh); window.addEventListener('lipahub-balance-changed', changed); document.addEventListener('visibilitychange', visible)
    return () => { active = false; channel?.close(); window.clearInterval(timer); window.removeEventListener('focus', refresh); window.removeEventListener('lipahub-balance-changed', changed); document.removeEventListener('visibilitychange', visible) }
  }, [access, country, key, userId, ids, revision])
  const baseline = demo ? demoBalance(userId, country, JSON.parse(ids)) : null
  return { wallet: state.key === key ? state.wallet : baseline, error: state.key === key ? state.error : '', refresh: () => setRevision(value => value + 1) }
}
