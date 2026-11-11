import { useEffect, useId, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, EllipsisVertical } from 'lucide-react'
import { Panel } from './components'
import { ShareIcon } from './ShareIcon'
import { useApp } from './state'
import { invitationCode, shareInvitationReference } from './lib/invitations'
import { supabase } from './lib/supabase'
import './InviteLink.css'

export function InviteLink() {
  const { demo, session, t } = useApp()
  const id = useId()
  const [expanded, setExpanded] = useState<'primary' | 'alternative' | null>('primary')
  const [notice, setNotice] = useState('')
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})
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
  const [short, setShort] = useState<{ reference: string; code: string } | null>(null)
  useEffect(() => {
    if (!reference) return
    let active = true
    void invitationCode(reference).then(code => { if (active) setShort({ reference, code }) }).catch(() => { /* The primary invitation remains available. */ })
    return () => { active = false }
  }, [reference])
  const primary = new URL('/register', window.location.origin)
  const code = short?.reference === reference ? short?.code : null
  const alternative = code ? new URL(`/i/${code}`, window.location.origin).href : ''
  if (reference) primary.searchParams.set('ref', reference)
  const shareText = `Join me on LipaHub: ${primary.href}`
  const sections = [{ key: 'primary' as const, title: 'Invite link', url: primary.href }, { key: 'alternative' as const, title: 'Alternative link', url: alternative }]
  async function copy(key: string, url: string) {
    setNotice('')
    try { await navigator.clipboard.writeText(url); setNotice('Link copied.') }
    catch { inputs.current[key]?.focus(); inputs.current[key]?.select(); setNotice('Copy is unavailable. The link is selected so you can copy it manually.') }
  }
  const options = <details className="invite-link-options"><summary aria-label="Invite link options"><EllipsisVertical size={16} /></summary><div><button type="button" onClick={() => setExpanded('primary')}>Show invite link</button><button type="button" onClick={() => setExpanded('alternative')}>Show alternative link</button><button type="button" onClick={() => setExpanded(null)}>Collapse links</button></div></details>
  return <Panel title={t('invite')} className="invite-link-card" action={options}><div className="invite-link-body">
    <p className="invite-link-username">{t('username')}: <strong>{reference || 'Unavailable'}</strong></p>
    {reference ? <>
    <div className="invite-link-sections">{sections.map(section => <div className="invite-link-section" key={section.key}>
      <button type="button" className="invite-link-toggle" aria-expanded={expanded === section.key} aria-controls={`${id}-${section.key}`} onClick={() => setExpanded(value => value === section.key ? null : section.key)}><span>{section.title}</span><ChevronDown size={14} /></button>
      <div className="invite-link-collapse" data-open={expanded === section.key} id={`${id}-${section.key}`} inert={expanded !== section.key} aria-hidden={expanded !== section.key}><div className="invite-link-fields"><label className="sr-only" htmlFor={`${id}-${section.key}-url`}>{section.title} URL</label><input ref={element => { inputs.current[section.key] = element }} id={`${id}-${section.key}-url`} value={section.url} placeholder="Preparing your link…" readOnly onFocus={event => event.target.select()} /><button type="button" className="button primary small" disabled={!section.url} onClick={() => void copy(section.key, section.url)}>{t('copy')}</button></div></div>
    </div>)}</div>
    <p className="invite-share-caption">Or click on the icons to share</p>
    <div className="invite-share-links" aria-label="Share your invite link">
      <a className="invite-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><ShareIcon name="whatsapp" /></a>
      <a className="invite-twitter" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on Twitter"><ShareIcon name="twitter" /></a>
      <a className="invite-facebook" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(primary.href)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"><ShareIcon name="facebook" /></a>
      <a className="invite-email" href={`mailto:?subject=${encodeURIComponent('Join me on LipaHub')}&body=${encodeURIComponent(shareText)}`} aria-label="Share by email"><ShareIcon name="email" /></a>
    </div>
    <p className="invite-link-note">Your name appears on the invited signup form. Referral rewards are not enabled.</p>
    </> : <p className="invite-link-note">Your username is needed to share an invitation. <Link to="/dashboard/profile">Check your profile</Link> if it does not appear.</p>}
    <p className="invite-link-status" role="status">{notice}</p>
  </div></Panel>
}
