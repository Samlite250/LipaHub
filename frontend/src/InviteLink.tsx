import { useEffect, useId, useRef, useState } from 'react'
import { Panel } from './components'
import { useApp } from './state'
import { shareInvitationReference } from './lib/invitations'
import { supabase } from './lib/supabase'
import './InviteLink.css'

export function InviteLink() {
  const { demo, session, t } = useApp()
  const id = useId()
  const [notice, setNotice] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const userId = session?.user.id
  const savedUsername = session?.user.user_metadata.username
  const displayName = session?.user.user_metadata.display_name
  const [current, setCurrent] = useState<{ userId: string; reference: string | null } | null>(null)
  useEffect(() => {
    if (!userId || !supabase) return
    let active = true
    // Existing sessions can predate the username backfill or a profile update.
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!active || error || data.user?.id !== userId) return
      const metadata = data.user.user_metadata
      setCurrent({ userId, reference: shareInvitationReference(metadata.username) || shareInvitationReference(metadata.display_name) })
    }).catch(() => { /* A valid cached username can still be shared offline. */ })
    return () => { active = false }
  }, [userId, savedUsername, displayName])
  const reference = demo ? shareInvitationReference(demo.name) : current?.userId === userId ? current?.reference : shareInvitationReference(savedUsername) || shareInvitationReference(displayName)
  const primary = new URL('/register', window.location.origin)
  if (reference) primary.searchParams.set('ref', reference)
  async function copy() {
    setNotice('')
    try { await navigator.clipboard.writeText(primary.href); setNotice('Link copied.') }
    catch { input.current?.focus(); input.current?.select(); setNotice('Copy is unavailable. The link is selected so you can copy it manually.') }
  }
  return <Panel title={t('invite')} className="invite-link-card"><div className="invite-link-body">
    <div className="invite-link-fields">
      <label className="sr-only" htmlFor={id}>Invite link URL</label>
      <input ref={input} id={id} value={primary.href} placeholder="Preparing your link…" readOnly onFocus={event => event.target.select()} />
      <button type="button" className="button primary small" onClick={() => void copy()}>{t('copy')}</button>
    </div>
    {!reference && <p className="invite-link-note">Your username is needed to share an invitation. Update your profile if it does not appear.</p>}
    <p className="invite-link-status" role="status">{notice}</p>
  </div></Panel>
}
