import { useEffect, useId, useRef, useState } from 'react'
import { ChevronDown, MoreVertical } from 'lucide-react'
import { Panel } from './components'
import { useApp } from './state'
import { invitationCode, shareInvitationReference } from './lib/invitations'
import { supabase } from './lib/supabase'
import { ShareIcon } from './ShareIcon'
import './InviteLink.css'

export function InviteLink() {
  const { demo, session, t } = useApp()
  const id = useId()
  const [notice, setNotice] = useState('')
  const [expanded, setExpanded] = useState<'primary' | 'alternative'>('primary')
  const [menuOpen, setMenuOpen] = useState(false)
  const [shortCode, setShortCode] = useState('')
  const [codeError, setCodeError] = useState(false)
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
  useEffect(() => {
    let active = true
    setShortCode('')
    setCodeError(false)
    if (!reference) return () => { active = false }
    void invitationCode(reference).then(code => {
      if (active) setShortCode(code)
    }).catch(() => {
      if (active) setCodeError(true)
    })
    return () => { active = false }
  }, [reference])
  const alternative = new URL(shortCode ? `/i/${shortCode}` : '/register', window.location.origin)
  const activeUrl = expanded === 'primary' ? primary.href : alternative.href
  const shareText = `Join me on LipaHub: ${activeUrl}`
  async function copy(url = activeUrl) {
    setNotice('')
    try { await navigator.clipboard.writeText(url); setNotice('Link copied.') }
    catch { input.current?.focus(); input.current?.select(); setNotice('Copy is unavailable. The link is selected so you can copy it manually.') }
  }
  const links = [
    { name: 'WhatsApp', icon: 'whatsapp' as const, color: 'whatsapp', href: `https://wa.me/?text=${encodeURIComponent(shareText)}` },
    { name: 'Twitter', icon: 'twitter' as const, color: 'twitter', href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}` },
    { name: 'Facebook', icon: 'facebook' as const, color: 'facebook', href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(activeUrl)}` },
    { name: 'Email', icon: 'email' as const, color: 'email', href: `mailto:?subject=${encodeURIComponent('Join me on LipaHub')}&body=${encodeURIComponent(shareText)}` },
  ]
  return <Panel title={t('invite')} className="invite-link-card" action={<div className="invite-link-menu-wrap">
    <button type="button" className="invite-link-menu-trigger" aria-label="Invite link options" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}><MoreVertical size={17} /></button>
    {menuOpen && <div className="invite-link-menu">
      <button type="button" onClick={() => { setExpanded('primary'); setMenuOpen(false); void copy(primary.href) }}>Copy invite link</button>
      <button type="button" disabled={!shortCode} onClick={() => { setExpanded('alternative'); setMenuOpen(false); void copy(alternative.href) }}>Copy alternative link</button>
    </div>}
  </div>}>
    <div className="invite-link-body">
      <div className="invite-link-accordion">
        <button type="button" className="invite-link-toggle" aria-expanded={expanded === 'primary'} aria-controls={`${id}-primary`} onClick={() => setExpanded(expanded === 'primary' ? 'alternative' : 'primary')}>
          <span>Invite link</span><ChevronDown size={15} />
        </button>
        {expanded === 'primary' && <div id={`${id}-primary`} className="invite-link-content">
          <label className="sr-only" htmlFor={`${id}-url`}>Invite link URL</label>
          <input ref={input} id={`${id}-url`} aria-label="Invite link URL" value={primary.href} placeholder="Preparing your link…" readOnly onFocus={event => event.target.select()} />
          <button type="button" className="button primary small" onClick={() => void copy()}>{t('copy')}</button>
        </div>}
        <button type="button" className="invite-link-toggle" aria-expanded={expanded === 'alternative'} aria-controls={`${id}-alternative`} onClick={() => setExpanded(expanded === 'alternative' ? 'primary' : 'alternative')}>
          <span>Alternative link</span><ChevronDown size={15} />
        </button>
        {expanded === 'alternative' && <div id={`${id}-alternative`} className="invite-link-content">
          <label className="sr-only" htmlFor={`${id}-alternative-url`}>Alternative invite link URL</label>
          <input ref={input} id={`${id}-alternative-url`} aria-label="Alternative invite link URL" value={alternative.href} placeholder={reference ? 'Preparing your link…' : 'A username is required to create a link'} readOnly onFocus={event => event.target.select()} />
          <button type="button" className="button primary small" onClick={() => void copy()} disabled={!shortCode}>{t('copy')}</button>
        </div>}
      </div>
      {!reference && <p className="invite-link-note">Your username is needed to share an invitation. Update your profile if it does not appear.</p>}
      {codeError && <p className="invite-link-note" role="alert">The alternative link could not be prepared. Please try again later.</p>}
      <p className="invite-link-share-label">Or click on the icons to share</p>
      <div className="invite-share-links" aria-label="Share invitation">
        {links.map(link => <a key={link.name} className={link.color} href={link.href} aria-label={`Share with ${link.name}`} target={link.name === 'Email' ? undefined : '_blank'} rel={link.name === 'Email' ? undefined : 'noreferrer'} onClick={event => { if (!reference) event.preventDefault() }}><ShareIcon name={link.icon} /></a>)}
      </div>
      <p className="invite-link-status" role="status">{notice}</p>
    </div>
  </Panel>
}

export function InviteEarnPage() {
  return <div className="invite-earn-page"><InviteLink /></div>
}
