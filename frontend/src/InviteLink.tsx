import { useId, useRef, useState } from 'react'
import { ChevronDown, EllipsisVertical } from 'lucide-react'
import { Panel } from './components'
import { ShareIcon } from './ShareIcon'
import { useApp } from './state'
import { shareInvitationReference } from './lib/invitations'
import './InviteLink.css'

export function InviteLink() {
  const { demo, session, t } = useApp()
  const id = useId()
  const [expanded, setExpanded] = useState<'primary' | 'alternative' | null>('primary')
  const [notice, setNotice] = useState('')
  const inputs = useRef<Record<string, HTMLInputElement | null>>({})
  const account = demo ? { name: demo.name, id: demo.id } : session ? { name: session.user.user_metadata.username || session.user.user_metadata.display_name, id: session.user.id } : null
  const reference = account ? shareInvitationReference(account.name, account.id) : null
  const primary = new URL('/register', window.location.origin)
  const alternative = new URL('/', window.location.origin)
  if (reference) { primary.searchParams.set('ref', reference); alternative.searchParams.set('ref', reference) }
  const shareText = `Join me on LipaHub: ${primary.href}`
  const sections = [{ key: 'primary' as const, title: 'Invite link', url: primary.href }, { key: 'alternative' as const, title: 'Alternative link', url: alternative.href }]
  async function copy(key: string, url: string) {
    setNotice('')
    try { await navigator.clipboard.writeText(url); setNotice('Link copied.') }
    catch { inputs.current[key]?.focus(); inputs.current[key]?.select(); setNotice('Copy is unavailable. The link is selected so you can copy it manually.') }
  }
  const options = <details className="invite-link-options"><summary aria-label="Invite link options"><EllipsisVertical size={16} /></summary><div><button type="button" onClick={() => setExpanded('primary')}>Show invite link</button><button type="button" onClick={() => setExpanded('alternative')}>Show alternative link</button><button type="button" onClick={() => setExpanded(null)}>Collapse links</button></div></details>
  return <Panel title={t('invite')} className="invite-link-card" action={options}><div className="invite-link-body">
    <div className="invite-link-sections">{sections.map(section => <div className="invite-link-section" key={section.key}>
      <button type="button" className="invite-link-toggle" aria-expanded={expanded === section.key} aria-controls={`${id}-${section.key}`} onClick={() => setExpanded(value => value === section.key ? null : section.key)}><span>{section.title}</span><ChevronDown size={14} /></button>
      <div className="invite-link-collapse" data-open={expanded === section.key} id={`${id}-${section.key}`} inert={expanded !== section.key} aria-hidden={expanded !== section.key}><div className="invite-link-fields"><label className="sr-only" htmlFor={`${id}-${section.key}-url`}>{section.title} URL</label><input ref={element => { inputs.current[section.key] = element }} id={`${id}-${section.key}-url`} value={section.url} readOnly onFocus={event => event.target.select()} /><button type="button" className="button primary small" onClick={() => void copy(section.key, section.url)}>{t('copy')}</button></div></div>
    </div>)}</div>
    <p className="invite-share-caption">Or click on the icons to share</p>
    <div className="invite-share-links" aria-label="Share your invite link">
      <a className="invite-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp"><ShareIcon name="whatsapp" /></a>
      <a className="invite-twitter" href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on Twitter"><ShareIcon name="twitter" /></a>
      <a className="invite-facebook" href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(primary.href)}`} target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"><ShareIcon name="facebook" /></a>
      <a className="invite-email" href={`mailto:?subject=${encodeURIComponent('Join me on LipaHub')}&body=${encodeURIComponent(shareText)}`} aria-label="Share by email"><ShareIcon name="email" /></a>
    </div>
    <p className="invite-link-note">Your name appears on the invited signup form. Referral rewards are not enabled.</p>
    <p className="invite-link-status" role="status">{notice}</p>
  </div></Panel>
}
