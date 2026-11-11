import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../state'
import { invitationReference } from './invitations'

type Inviter = { id: string; name: string; username?: string }
type InvitationState = { reference: string; inviter?: Inviter; error?: 'missing' | 'unavailable' }
export function useInvitation(enabled: boolean) {
  const location = useLocation()
  const { demo } = useApp()
  const reference = enabled ? invitationReference(location.search) : null
  const [state, setState] = useState<InvitationState | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!reference) return
    const controller = new AbortController()
    let active = true
    const origin = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '')
    fetch(`${origin}/api/invitations/${encodeURIComponent(reference)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) })
      .then(async response => {
        if (!response.ok) { if (active) setState({ reference, error: response.status === 404 ? 'missing' : 'unavailable' }); return }
        const data = await response.json()
        const legacyId = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reference)
        if (typeof data.inviter?.id !== 'string' || typeof data.inviter?.name !== 'string' || (legacyId ? data.inviter.id.toLowerCase() !== reference.toLowerCase() : data.inviter.username?.toLowerCase() !== reference.toLowerCase())) throw new Error('Invalid invitation response')
        if (active) setState({ reference, inviter: data.inviter })
      })
      .catch(() => { if (active) setState({ reference, error: 'unavailable' }) })
    return () => { active = false; controller.abort() }
  }, [reference, attempt])
  const current = state?.reference === reference ? state : null
  const preview = demo && (demo.id === reference || demo.name.toLowerCase() === reference?.toLowerCase()) ? { id: demo.id, name: demo.name, username: demo.name } : undefined
  return { reference, inviter: current?.inviter || preview, error: preview ? undefined : current?.error, retry: () => { setState(null); setAttempt(value => value + 1) } }
}

