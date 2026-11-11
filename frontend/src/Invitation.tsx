import { useApp } from './state'
import type { useInvitation } from './lib/use-invitation'
import './Invitation.css'

export function InvitationBanner({ invitation }: { invitation: ReturnType<typeof useInvitation> }) {
  const { language } = useApp()
  if (!invitation.reference) return null
  const rw = language === 'rw'
  return <div className={`registration-invitation${invitation.error ? ' invitation-unavailable' : ''}`} role="status">
    {invitation.inviter ? <span>{rw ? 'Ufashijwe na:' : 'Invited by:'} <strong>{invitation.inviter.name}</strong></span>
      : invitation.error ? <><span>{invitation.error === 'missing' ? (rw ? 'Ubutumire ntibubonetse. Ushobora gukomeza gufungura konti.' : 'This invitation is unavailable. You can still create an account.') : (rw ? 'Ubutumire ntibushoboye kugenzurwa. Ushobora gukomeza gufungura konti.' : 'We couldn’t check this invitation. You can still create an account.')}</span>{invitation.error === 'unavailable' && <button type="button" onClick={invitation.retry}>{rw ? 'Ongera ugerageze' : 'Try again'}</button>}</>
      : <span>{rw ? 'Turagenzura ubutumire…' : 'Checking your invitation…'}</span>}
  </div>
}
