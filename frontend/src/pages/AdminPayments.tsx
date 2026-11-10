import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Activity, ArrowDownLeft, ArrowRight, ChevronRight, Clock3, CreditCard, FileCheck2, Globe2, Image, LayoutDashboard, Users, BookOpen, Megaphone, Settings2, ScrollText, LogOut, RefreshCw, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { Logo, Modal } from '../components'
import { CountryFlag } from '../CountryFlag'
import { countries, type Country } from '../domain/countries'
import type { PaymentAccess, PaymentInstructions, PaymentMethod, PaymentRequest } from '../domain/payments'
import { loadAllInstructions, loadRequests, proofImageUrl, reviewProof, saveInstructions } from '../lib/payments'
import { useApp } from '../state'
import './Payments.css'
import './Admin.css'
import { AdminSystem, type SystemSection } from './AdminSystem'
import './AdminSystem.css'
import { demoEnabled } from '../lib/platform'

type AdminTab = 'overview' | 'instructions' | 'proofs' | SystemSection
const sections = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, color: 'teal', path: '/admin' },
  { id: 'users', label: 'Users', icon: Users, color: 'indigo', path: '/admin/users' },
  { id: 'payments', label: 'Payments', icon: CreditCard, color: 'green', path: '/admin/payments' },
  { id: 'resources', label: 'Resources', icon: BookOpen, color: 'blue', path: '/admin/resources' },
  { id: 'announcements', label: 'Announcements', icon: Megaphone, color: 'pink', path: '/admin/announcements' },
  { id: 'settings', label: 'System settings', icon: Settings2, color: 'teal', path: '/admin/settings' },
  { id: 'support', label: 'Support inbox', icon: FileCheck2, color: 'blue', path: '/admin/support' },
  { id: 'audit', label: 'Audit log', icon: ScrollText, color: 'red', path: '/admin/audit' },
] as const
const statusLabels = { pending_review: 'Pending review', under_review: 'Under review', rejected: 'Rejected', verified: 'Verified' }
function submittedDate(value: string) { return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' }) }

export function AdminPayments() {
  const { demo, session, startDemo, signOut, dark, setDark } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const view = new URLSearchParams(location.search).get('view')
  const systemTab = location.pathname.split('/')[2]
  const isSystemTab = ['users', 'resources', 'announcements', 'settings', 'audit', 'support'].includes(systemTab)
  const tab: AdminTab = isSystemTab ? systemTab as SystemSection : view === 'proofs' || view === 'activity' ? 'proofs' : location.pathname === '/admin/payments' ? 'instructions' : 'overview'
  const [preview, setPreview] = useState(false)
  const [country, setCountry] = useState<Country>('Burundi')
  const [config, setConfig] = useState<PaymentInstructions | null>(null)
  const [markets, setMarkets] = useState<PaymentInstructions[]>([])
  const [requests, setRequests] = useState<PaymentRequest[]>([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [revision, setRevision] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('all')
  const [marketFilter, setMarketFilter] = useState('all')
  const [image, setImage] = useState<{ row: PaymentRequest; id: string } | null>(null)
  const isAdmin = session?.user.app_metadata.role === 'admin'
  const demoId = preview ? demo?.id : undefined
  const token = isAdmin && !preview ? session?.access_token : undefined
  const access = useMemo<PaymentAccess | null>(() => demoId ? { demoId } : token ? { accessToken: token } : null, [demoId, token])
  useEffect(() => { setMessage(''); setError('') }, [location.pathname, location.search])
  useEffect(() => {
    if (!access || isSystemTab) return
    let active = true
    setLoading(true); setLoaded(false); setError(''); setConfig(null)
    Promise.all([loadRequests(access, true), loadAllInstructions(access)])
      .then(([rows, values]) => { if (active) { setRequests(rows); setMarkets(values); setConfig(values.find(item => item.country === country) || null); setLoaded(true) } })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to load workspace data.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [access, country, revision, isSystemTab])
  function go(next: AdminTab) { setMessage(''); navigate(next === 'proofs' ? '/admin/payments?view=proofs' : next === 'instructions' ? '/admin/payments' : sections.find(item => item.id === next)?.path || '/admin') }
  function editMethod(id: string, patch: Partial<PaymentMethod>) { setMessage(''); setConfig(previous => previous ? { ...previous, methods: previous.methods.map(method => method.id === id ? { ...method, ...patch } : method) } : null) }
  async function save(event: FormEvent) {
    event.preventDefault(); if (!access || !config) return
    setBusy(true); setError(''); setMessage('')
    try {
      const saved = await saveInstructions(access, config)
      setConfig(saved); setMarkets(previous => previous.map(item => item.country === saved.country ? saved : item))
      setMessage(preview ? 'Demo instructions saved in this browser.' : 'Payment instructions saved. Changes are audited.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save instructions.') }
    finally { setBusy(false) }
  }
  const counts = {
    pending_review: requests.filter(row => row.status === 'pending_review').length,
    under_review: requests.filter(row => row.status === 'under_review').length,
    rejected: requests.filter(row => row.status === 'rejected').length,
    verified: requests.filter(row => row.status === 'verified').length,
  }
  const filtered = requests.filter(row => (status === 'all' || row.status === status) && (marketFilter === 'all' || row.country === marketFilter) && `${row.fullName} ${row.phone} ${row.id} ${row.transactionReference} ${row.planId}`.toLowerCase().includes(search.toLowerCase().trim()))
  const published = markets.filter(item => item.methods.some(method => method.enabled)).length
  const title = tab === 'proofs' ? 'Proof submissions' : tab === 'instructions' ? 'Payment instructions' : sections.find(item => item.id === tab)!.label
  const recent = [...requests].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 5)
  async function logout() {
    try { await signOut(); setPreview(false); navigate('/login') }
    catch { setError('Unable to sign out. Please try again.') }
  }
  return <div className="admin-shell">
    <a className="skip-link" href="#admin-main">Skip to admin content</a>
    <aside className="admin-sidebar" aria-label="Admin navigation">
      <div className="admin-brand"><Logo /><span>ADMIN CONSOLE</span></div>
      <p className="admin-nav-caption">WORKSPACE</p>
      <nav>{sections.map(item => <Link key={item.id} to={item.path} aria-current={(item.id === 'payments' ? tab === 'instructions' || tab === 'proofs' : tab === item.id) ? 'page' : undefined}><span className={`admin-nav-icon ${item.color}`}><item.icon size={17} /></span><span>{item.label}</span>{item.id === 'payments' && loaded && counts.pending_review > 0 && <b>{counts.pending_review}</b>}</Link>)}</nav>
      <div className="admin-sidebar-note"><ShieldCheck size={22} /><strong>Your system, connected.</strong><p>Manage members, publish content and oversee operations.</p></div>
      <div className="admin-sidebar-bottom"><Link to={demo || session ? '/dashboard' : '/login'}><ArrowDownLeft size={18} />Member dashboard</Link>{access && <button onClick={() => void logout()}><LogOut size={18} />Sign out</button>}<small>LipaHub administration · v1.0</small></div>
    </aside>
    <div className="admin-body">
      <header className="admin-topbar"><div><span>Workspace</span><ChevronRight size={14} /><strong>{title}</strong></div><div className="admin-topbar-actions"><Link className="admin-member-link" to={demo || session ? '/dashboard' : '/login'} aria-label="Back to dashboard" title="Back to dashboard"><ArrowDownLeft size={18} /></Link><button className="admin-appearance" onClick={() => setDark(!dark)} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}><SlidersHorizontal size={17} /></button>{access && <button className="admin-mobile-logout" aria-label="Sign out" onClick={() => void logout()}><LogOut size={17} /></button>}<span className="admin-access-badge"><span />{access ? preview ? 'Demo workspace' : 'Administrator' : 'Restricted access'}</span><span className="admin-avatar" aria-label="Administrator profile">{preview ? 'D' : String(session?.user.user_metadata.display_name || 'A').charAt(0).toUpperCase()}</span></div></header>
      <main className="admin-content" id="admin-main">
        <div className="admin-page-title"><div><span className="admin-eyebrow">LIPAHUB / ADMINISTRATION</span><h1>{tab === 'overview' ? 'Workspace overview' : title}</h1><p>{tab === 'overview' ? 'Manage your community, content and payment operations.' : isSystemTab ? 'Manage system records and keep your member experience up to date.' : tab === 'instructions' ? 'Manage payment details for every country you serve.' : tab === 'proofs' ? 'Inspect evidence, add notes and keep your review queue moving.' : 'Submission history and the latest saved review states.'}</p></div>{access && <button className="button secondary small" disabled={(!isSystemTab && loading) || busy} onClick={() => { setMessage(''); setRevision(value => value + 1) }}><RefreshCw size={15} className={loading ? 'admin-spin' : ''} />Refresh data</button>}</div>
        {!access ? <section className="admin-access-panel panel"><div className="admin-access-art"><ShieldCheck size={48} /><span>YOUR OPERATIONS, IN FOCUS</span><h2>Everything you need to manage LipaHub.</h2><p>Manage users, publish resources and announcements, configure payments and review system activity.</p><div><FileCheck2 size={18} />Evidence review<Globe2 size={18} />Country controls</div></div><div className="admin-access-copy"><span className="admin-eyebrow">WELCOME TO THE ADMIN CONSOLE</span><h2>Admin workspace</h2><p>{session && !isAdmin ? 'Your account does not have the administrator role.' : 'Sign in with an administrator account to access live operations' + (demoEnabled ? ', or explore the workspace with local demo data.' : '.')}</p>{demoEnabled && <button className="button primary" onClick={() => { if (!demo) startDemo(); setPreview(true) }}>Open admin demo<ArrowRight size={16} /></button>}{!session && <Link className="text-link" to="/login">Sign in as administrator<ChevronRight size={14} /></Link>}{demoEnabled && <small>The demo uses this browser only and does not grant live admin permissions.</small>}</div></section> : <>
          <div className="admin-environment"><ShieldCheck size={17} /><p><strong>{preview ? 'Demo workspace' : 'Admin access'}</strong>{preview ? 'You’re working with local test data. Use test details and screenshots.' : 'Private payment evidence is available to authorized administrators.'}</p><span>{preview ? 'BROWSER LOCAL' : 'AUTHENTICATED'}</span></div>
          {error && !isSystemTab && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}{loading && !isSystemTab && <p className="admin-loading" role="status">Loading workspace data…</p>}
          {!isSystemTab && <div className="admin-metrics">{[
            { label: preview ? 'Total submissions' : 'Recent submissions', value: requests.length, detail: preview ? 'Across all countries' : 'Latest 200 submissions', icon: FileCheck2, color: 'teal' },
            { label: 'Awaiting review', value: counts.pending_review, detail: 'Ready for your attention', icon: Clock3, color: 'amber' },
            { label: 'Under review', value: counts.under_review, detail: 'Evidence being checked', icon: Search, color: 'indigo' },
            { label: 'Published markets', value: published, detail: `Of ${countries.length} country options`, icon: Globe2, color: 'blue' },
          ].map(metric => <article className="admin-metric panel" key={metric.label}><div><span>{metric.label}</span><span className={`admin-metric-icon ${metric.color}`}><metric.icon size={19} /></span></div><strong>{loaded ? metric.value.toLocaleString() : '—'}</strong><small>{metric.detail}</small></article>)}</div>}
          {isSystemTab && <AdminSystem key={tab} section={tab as SystemSection} access={access} revision={revision} />}
          {tab === 'overview' && loaded && <>
            <div className="admin-overview-shortcuts">{sections.filter(item => ['users', 'resources', 'announcements', 'settings'].includes(item.id)).map(item => <Link key={item.id} to={item.path}><span className={`icon-chip ${item.color}`}><item.icon size={21} /></span><div><strong>{item.label}</strong><small>{item.id === 'users' ? 'Profiles, roles & balances' : item.id === 'resources' ? 'Courses, articles & ebooks' : item.id === 'announcements' ? 'Member updates & notices' : 'Workspace & support details'}</small></div><ChevronRight size={16} /></Link>)}</div><div className="admin-overview-grid"><section className="panel admin-recent"><div className="admin-section-heading"><div><h2>Recent submissions</h2><p>Your latest payment proof requests</p></div><button className="text-link" onClick={() => go('proofs')}>View all<ArrowRight size={14} /></button></div><RequestTable rows={recent} review={row => { setSearch(row.id); setStatus('all'); setMarketFilter('all'); go('proofs') }} /></section>
              <section className="panel admin-review-summary"><div className="admin-section-heading"><div><h2>Review snapshot</h2><p>Current submission statuses</p></div><Activity size={19} /></div><div className="admin-status-total"><strong>{requests.length}</strong><span>total submissions</span></div><div className="admin-status-track" aria-hidden="true">{Object.entries(counts).map(([key, value]) => <span key={key} className={`status-${key}`} style={{ flex: value || 0 }} />)}</div>{Object.entries(counts).map(([key, value]) => <div className="admin-status-line" key={key}><span className={`admin-status-dot status-${key}`} /><span>{statusLabels[key as keyof typeof counts]}</span><strong>{value}</strong></div>)}<p className="admin-card-footnote">Reviewing a proof does not confirm a payment or activate a plan.</p></section></div>
            <section className="panel admin-market-panel"><div className="admin-section-heading"><div><h2>Payment markets</h2><p>Published payment options by country</p></div><button className="text-link" onClick={() => go('instructions')}>Manage instructions<ArrowRight size={14} /></button></div><div className="admin-market-grid">{markets.map(market => <button key={market.country} onClick={() => { setCountry(market.country); go('instructions') }}><CountryFlag country={market.country} /><strong>{market.country}</strong><span>{market.methods.filter(method => method.enabled).length} / {market.methods.length} published</span><ChevronRight size={15} /></button>)}</div></section>
          </>}
          {(tab === 'instructions' || tab === 'proofs') && <div className="admin-payments-tabs" role="tablist" aria-label="Payment administration"><button role="tab" aria-selected={tab === 'instructions'} onClick={() => go('instructions')}>Payment instructions</button><button role="tab" aria-selected={tab === 'proofs'} onClick={() => go('proofs')}>Proof submissions</button></div>}
          {tab === 'instructions' && <section className="panel admin-payment-editor"><div className="admin-editor-heading"><div><h2>Country payment settings</h2><p>Publish the exact steps members should follow.</p></div><CreditCard size={23} /></div><label className="admin-country-field">Payment country<select value={country} disabled={busy} onChange={event => { setCountry(event.target.value as Country); setMessage('') }}>{countries.map(item => <option key={item}>{item}</option>)}</select></label>{config && <form onSubmit={save}>
            {config.methods.map(method => <section className="admin-method-editor" key={method.id}><div><h3>{method.name}</h3><label className="check-label"><input type="checkbox" checked={method.enabled} onChange={event => editMethod(method.id, { enabled: event.target.checked })} /><span>Publish {method.name}</span></label></div><div className="admin-method-fields">
              <label>Recipient phone / code / wallet address<input value={method.recipient} onChange={event => editMethod(method.id, { recipient: event.target.value })} maxLength={200} /></label>
              <label>Recipient name (if applicable)<input value={method.accountName} onChange={event => editMethod(method.id, { accountName: event.target.value })} maxLength={120} /></label>
              {method.name === 'Binance TRC' && <><label>Crypto asset<input value={method.asset} onChange={event => editMethod(method.id, { asset: event.target.value })} maxLength={40} required={method.enabled} /></label><label>Payment network<input value={method.network} onChange={event => editMethod(method.id, { network: event.target.value })} maxLength={80} required={method.enabled} /></label></>}
              <label>Instructions for {method.name}<textarea value={method.instructions} onChange={event => editMethod(method.id, { instructions: event.target.value })} maxLength={4000} required={method.enabled} placeholder="Enter the exact payment steps, recipient details and any reference the member must include." /></label>
            </div></section>)}
            <div className="admin-save-bar"><p>Version {config.version}<span>{preview ? 'Published options appear in the local member preview.' : config.intakeEnabled ? 'Proof intake enabled.' : 'Proof intake disabled on the server.'}</span></p><button className="button primary" disabled={busy || loading}>{busy ? 'Saving…' : 'Save payment instructions'}</button></div>
          </form>}</section>}
          {tab === 'proofs' && loaded && <><div className="admin-queue-toolbar"><label className="admin-search"><Search size={17} /><span className="sr-only">Search submissions</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, phone or reference…" /></label><label><span className="sr-only">Filter by status</span><select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label><span className="sr-only">Filter by country</span><select aria-label="Filter by country" value={marketFilter} onChange={event => setMarketFilter(event.target.value)}><option value="all">All countries</option>{countries.map(item => <option key={item}>{item}</option>)}</select></label></div><div className="admin-queue-count"><strong>{filtered.length} submissions</strong><span>Evidence review only · activation requires payment verification</span></div><div className="admin-proof-list">{!filtered.length && <EmptyState filtered={requests.length > 0} reset={() => { setSearch(''); setStatus('all'); setMarketFilter('all') }} />}{filtered.map(row => <ProofReview key={`${row.id}-${row.status}-${row.reviewNote}`} row={row} access={access} openImage={id => setImage({ row, id })} updated={() => setRevision(value => value + 1)} />)}</div></>}
          {image && <ProofImage access={access} row={image.row} fileId={image.id} close={() => setImage(null)} />}
        </>}
        <footer className="admin-footer"><span>© {new Date().getFullYear()} LipaHub</span><span>Built for clear decisions.</span></footer>
      </main>
    </div>
  </div>
}
function EmptyState({ filtered = false, reset }: { filtered?: boolean; reset?: () => void }) {
  return <div className="admin-empty"><FileCheck2 size={32} /><h3>{filtered ? 'No matching submissions' : 'Your queue is clear'}</h3><p>{filtered ? 'Try another search or adjust the filters.' : 'New payment proofs will appear here when members submit them.'}</p>{filtered && reset && <button className="text-link" onClick={reset}>Clear filters</button>}</div>
}
function RequestTable({ rows, review }: { rows: PaymentRequest[]; review: (row: PaymentRequest) => void }) {
  if (!rows.length) return <EmptyState />
  return <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Member / plan</th><th>Country</th><th>Status</th><th>Submitted</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.fullName}</strong><small>{row.planId.replace('robot-', 'Robot ')}</small></td><td><span className="admin-table-country"><CountryFlag country={row.country} />{row.country}</span></td><td><span className={`admin-status-badge status-${row.status}`}>{statusLabels[row.status]}</span></td><td>{submittedDate(row.submittedAt)}</td><td><button aria-label={`Review submission from ${row.fullName}`} className="icon-button" onClick={() => review(row)}><ArrowRight size={16} /></button></td></tr>)}</tbody></table></div>
}
function ProofReview({ row, access, openImage, updated }: { row: PaymentRequest; access: PaymentAccess; openImage: (id: string) => void; updated: () => void }) {
  const [note, setNote] = useState(row.reviewNote)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function review(status: 'under_review' | 'rejected') {
    if (status === 'rejected' && note.trim().length < 3) { setError('Enter a reason before rejecting a proof.'); return }
    setBusy(true); setError('')
    try { await reviewProof(access, row.id, status, note); updated() } catch (err) { setError(err instanceof Error ? err.message : 'Review failed.') } finally { setBusy(false) }
  }
  return <article className="panel admin-proof-card"><div className="admin-proof-heading"><h3>{row.planId.replace('robot-', 'Robot ')} · {row.country}</h3><span className="pill">{row.status.replaceAll('_', ' ')}</span></div><dl className="admin-proof-details"><div><dt>Request ID</dt><dd>{row.id}</dd></div><div><dt>Submitted</dt><dd>{new Date(row.submittedAt).toLocaleString('en-GB', { timeZone: 'Africa/Johannesburg' })}</dd></div><div><dt>Full names</dt><dd>{row.fullName}</dd></div><div><dt>Phone number</dt><dd>{row.phone}</dd></div><div><dt>Method / instruction version</dt><dd>{row.paymentMethod.name} · v{row.instructionVersion}</dd></div><div><dt>Transaction reference</dt><dd>{row.transactionReference || 'Not provided'}</dd></div></dl><div className="admin-proof-files">{row.files.map((file, i) => <button className="button secondary" key={file.id} onClick={() => openImage(file.id)}><Image size={14} />Screenshot {i + 1}</button>)}</div>{error && <p className="form-error" role="alert">{error}</p>}<div className="admin-proof-review"><label>Review note<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1000} disabled={row.status === 'verified' || row.status === 'rejected'} /></label><div><button className="button secondary" disabled={busy || !['pending_review', 'under_review'].includes(row.status)} onClick={() => void review('under_review')}>Mark under review</button><button className="button secondary" disabled={busy || !['pending_review', 'under_review'].includes(row.status)} onClick={() => void review('rejected')}>Reject proof</button></div></div></article>
}
function ProofImage({ access, row, fileId, close }: { access: PaymentAccess; row: PaymentRequest; fileId: string; close: () => void }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true; let resource = ''
    proofImageUrl(access, row, fileId).then(value => { resource = value; if (active) setUrl(value); else if (value.startsWith('blob:')) URL.revokeObjectURL(value) }).catch(err => { if (active) setError(err.message) })
    return () => { active = false; if (resource.startsWith('blob:')) URL.revokeObjectURL(resource) }
  }, [access, row, fileId])
  return <Modal title="Payment screenshot" close={close}>{error ? <p className="form-error" role="alert">{error}</p> : url ? <img className="proof-image-preview" src={url} alt="Submitted payment proof" /> : <p role="status">Loading screenshot…</p>}</Modal>
}
