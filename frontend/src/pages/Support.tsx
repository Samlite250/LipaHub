import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MessageCircle, RefreshCw, Send } from 'lucide-react'
import { useApp } from '../state'
import { useMemberContent } from '../MemberContent'
import { platformApi } from '../lib/platform'
import './Support.css'

type Ticket = { id: string; user_id: string; subject: string; status: 'open' | 'closed'; version: number; created_at: string; updated_at: string }
type Thread = { ticket: Ticket; messages: { id: string; body: string; author_role: 'member' | 'admin'; created_at: string }[] }
const time = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
export function SupportPage({ admin = false }: { admin?: boolean }) {
  const { session } = useApp()
  const { settings } = useMemberContent()
  const token = session?.access_token
  const contact = <div className="panel member-support-card support-form"><h3>Contact our team</h3><p>{settings.supportMessage || 'You can track private requests here after signing in.'}</p>{settings.supportEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.supportEmail) && <a className="text-link" href={`mailto:${encodeURIComponent(settings.supportEmail)}`}>Email support</a>}</div>
  const [rows, setRows] = useState<Ticket[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [thread, setThread] = useState<Thread | null>(null)
  const [subject, setSubject] = useState(''); const [message, setMessage] = useState(''); const [reply, setReply] = useState('')
  const [loading, setLoading] = useState(false); const [threadLoading, setThreadLoading] = useState(false)
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [revision, setRevision] = useState(0)
  const [creationId, setCreationId] = useState(() => crypto.randomUUID()); const [replyId, setReplyId] = useState(() => crypto.randomUUID())
  useEffect(() => {
    if (!token) return
    let active = true; setRows([]); setLoading(true); setError('')
    platformApi<Ticket[]>(token, '/api/support').then(data => { if (active) setRows(data) }).catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token, revision])
  useEffect(() => {
    setThread(null); setReply(''); setReplyId(crypto.randomUUID())
    if (!token || !selected) return
    let active = true; setThreadLoading(true)
    platformApi<Thread>(token, `/api/support/${selected}`).then(data => { if (active) setThread(data) }).catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setThreadLoading(false) })
    return () => { active = false }
  }, [token, selected, revision])
  async function create(event: FormEvent) {
    event.preventDefault(); if (!token) return
    setBusy(true); setError(''); setNotice('')
    try {
      const ticket = await platformApi<Ticket>(token, '/api/support', { method: 'POST', body: JSON.stringify({ subject, message, requestId: creationId }) })
      setSubject(''); setMessage(''); setCreationId(crypto.randomUUID()); setSelected(ticket.id); setRevision(value => value + 1); setNotice('Your support request has been received.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to send request.') } finally { setBusy(false) }
  }
  async function respond(event: FormEvent) {
    event.preventDefault(); if (!token || !thread) return
    setBusy(true); setError(''); setNotice('')
    try {
      await platformApi(token, `/api/support/${thread.ticket.id}/messages`, { method: 'POST', body: JSON.stringify({ message: reply, requestId: replyId, version: thread.ticket.version }) })
      setRevision(value => value + 1); setNotice('Reply sent.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to send reply.') } finally { setBusy(false) }
  }
  async function changeStatus() {
    if (!token || !thread) return
    setBusy(true); setError(''); setNotice('')
    try {
      await platformApi(token, `/api/support/${thread.ticket.id}`, { method: 'PATCH', body: JSON.stringify({ status: thread.ticket.status === 'open' ? 'closed' : 'open', version: thread.ticket.version }) })
      setRevision(value => value + 1); setNotice('Request status updated.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to update status.') } finally { setBusy(false) }
  }
  if (!token) return <section className="member-managed-page"><div className="panel support-empty"><MessageCircle size={32} /><h2>Member support</h2><p>Sign in with a real account to submit a private support request and receive replies from our team.</p><Link className="button primary" to="/login">Sign in</Link></div>{contact}</section>
  return <section className="support-workspace">
    <div className="support-heading"><div><span className="eyebrow">{admin ? 'MEMBER CARE' : 'HERE TO HELP'}</span><h2>{admin ? 'Support inbox' : 'Member support'}</h2><p>{admin ? 'Respond to member requests and close resolved conversations.' : settings.supportMessage || 'Send a private request to our team and follow its progress here.'}</p></div><button className="button secondary small" disabled={busy || loading || threadLoading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={14} />Refresh</button></div>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}
    {!admin && contact}<div className="support-grid"><div>
      {!admin && <form className="panel support-form" onSubmit={create}><h3>New request</h3><fieldset disabled={busy}><label>Subject<input required minLength={3} maxLength={160} value={subject} onChange={e => { setSubject(e.target.value); setCreationId(crypto.randomUUID()) }} /></label><label>How can we help?<textarea required minLength={10} maxLength={4000} rows={4} value={message} onChange={e => { setMessage(e.target.value); setCreationId(crypto.randomUUID()) }} /></label></fieldset><p className="muted">Please leave out passwords and payment credentials.</p><button className="button primary" disabled={busy}><Send size={15} />{busy ? 'Sending…' : 'Submit request'}</button></form>}
      <div className="panel support-list"><h3>{admin ? 'Recent requests' : 'Your requests'}</h3>{loading ? <p role="status">Loading requests…</p> : rows.length ? rows.map(row => <button disabled={busy} key={row.id} aria-pressed={selected === row.id} onClick={() => { setSelected(row.id); setError(''); setNotice('') }}><strong>{row.subject}</strong><span className="pill neutral-pill">{row.status}</span><small>Updated {time(row.updated_at)}</small>{admin && <small>Member {row.user_id}</small>}</button>) : !error && <p>No support requests yet.</p>}<small>Latest 100 requests</small></div>
    </div><div className="panel support-thread">{threadLoading ? <p role="status">Loading conversation…</p> : thread ? <><div className="support-heading"><div><h3>{thread.ticket.subject}</h3><small>Request {thread.ticket.id}</small></div><span className="pill neutral-pill">{thread.ticket.status}</span></div><div className="support-messages">{thread.messages.map(item => <article className={`support-message ${item.author_role}`} key={item.id}><strong>{item.author_role === 'admin' ? 'Support team' : 'Member'}</strong><time dateTime={item.created_at}>{time(item.created_at)}</time><p>{item.body}</p></article>)}</div>{thread.messages.length === 500 && <p className="muted">Showing the first 500 messages. Start a new request to continue this conversation.</p>}{thread.ticket.status === 'open' ? <form className="support-form" onSubmit={respond}><label>Reply<textarea rows={3} required maxLength={4000} value={reply} disabled={busy} onChange={e => { setReply(e.target.value); setReplyId(crypto.randomUUID()) }} /></label><button className="button primary" disabled={busy || !reply.trim()}><Send size={15} />Send reply</button></form> : <p>This request is closed.{!admin && ' Create a new request if you need more help.'}</p>}{admin && <button className="button secondary" disabled={busy} onClick={() => void changeStatus()}>{thread.ticket.status === 'open' ? 'Close request' : 'Reopen request'}</button>}</> : <div className="support-empty"><MessageCircle size={32} /><h3>Select a request</h3><p>Your conversation and replies will appear here.</p></div>}</div></div>
  </section>
}
