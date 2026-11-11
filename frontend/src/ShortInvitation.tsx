import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { invitationCode, shareInvitationReference } from './lib/invitations'
import { useApp } from './state'

export function ShortInvitation() {
  const { code = '' } = useParams()
  const { demo } = useApp()
  const demoUsername = demo ? shareInvitationReference(demo.name) : null
  const [result, setResult] = useState<{ code: string; username?: string; error?: boolean } | null>(null)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!/^[A-Za-z0-9_-]{8}$/.test(code)) return
    const controller = new AbortController()
    let active = true
    const origin = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:3001' : '')
    async function openInvitation() {
      if (demoUsername && await invitationCode(demoUsername) === code) {
        if (active) setResult({ code, username: demoUsername })
        return
      }
      const response = await fetch(`${origin}/api/invitations/code/${encodeURIComponent(code)}`, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]) })
      if (!response.ok) throw new Error('Invitation unavailable')
      const data = await response.json()
      const username = shareInvitationReference(data.inviter?.username)
      if (!username) throw new Error('Invalid invitation')
      if (active) setResult({ code, username })
    }
    void openInvitation().catch(() => { if (active) setResult({ code, error: true }) })
    return () => { active = false; controller.abort() }
  }, [code, attempt, demoUsername])
  const current = result?.code === code ? result : null
  if (current?.username) return <Navigate to={`/register?${new URLSearchParams({ ref: current.username })}`} replace />
  const error = !/^[A-Za-z0-9_-]{8}$/.test(code) || current?.error
  return <main className="auth-page"><div className="auth-wrap"><section className="auth-card">
    <h1>{error ? 'Invitation unavailable' : 'Opening your invitation…'}</h1>
    {error ? <><p role="alert">We couldn’t open this invitation. You can try again or create an account.</p>
      <button className="button primary" onClick={() => { setResult(null); setAttempt(value => value + 1) }}>Try again</button>
      <p><Link to="/register?ref=">Create an account</Link></p></> : <p role="status">Taking you to registration.</p>}
  </section></div></main>
}
