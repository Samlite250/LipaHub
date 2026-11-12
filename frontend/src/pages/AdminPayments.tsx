import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowDownLeft, ArrowRight, Banknote, BookOpen, ChevronRight, CreditCard, FileCheck2, Globe2, Image, LayoutDashboard, LifeBuoy, LogOut, Megaphone, RefreshCw, ScrollText, Search, Settings2, ShieldCheck, SlidersHorizontal, Users } from 'lucide-react'
import { Logo, Modal } from '../components'
import { CountryFlag } from '../CountryFlag'
import { countries, type Country } from '../domain/countries'
import { withdrawalNeedsAttention } from '../domain/withdrawals'
import type { PaymentAccess, PaymentInstructions, PaymentMethod, PaymentRequest } from '../domain/payments'
import { loadAllInstructions, loadRequests, proofImageUrl, reviewProof, saveInstructions } from '../lib/payments'
import { listSupportTickets } from '../lib/support'
import { listWithdrawals } from '../lib/withdrawals'
import { useApp } from '../state'
import './Payments.css'
import './Admin.css'
import { AdminSystem, type SystemSection } from './AdminSystem'
import './AdminSystem.css'
import './AdminDashboard.css'
import { AdminWithdrawals } from './AdminWithdrawals'
import { demoEnabled } from '../lib/platform'
import { formatRobotMoney } from '../domain/robots'
import { paymentRequestTitle } from '../domain/payments'

function paymentAmount(value: number, country: string) { return country === 'Rwanda' ? `RF ${value.toLocaleString('en-US')}` : formatRobotMoney(value, country) }

type AdminTab = 'overview' | 'instructions' | 'proofs' | 'withdrawals' | 'content' | SystemSection
type NavId = 'overview' | 'payments' | 'withdrawals' | 'support' | 'users' | 'content' | 'audit' | 'settings'
const navigation: { id: NavId; label: string; icon: typeof LayoutDashboard; path: string; group: string }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/admin', group: 'Operations' },
  { id: 'payments', label: 'Payments', icon: CreditCard, path: '/admin/payments', group: 'Operations' },
  { id: 'withdrawals', label: 'Withdrawals', icon: Banknote, path: '/admin/withdrawals', group: 'Operations' },
  { id: 'support', label: 'Support', icon: LifeBuoy, path: '/admin/support', group: 'Operations' },
  { id: 'users', label: 'Members', icon: Users, path: '/admin/users', group: 'Management' },
  { id: 'content', label: 'Content', icon: BookOpen, path: '/admin/resources', group: 'Management' },
  { id: 'audit', label: 'Audit log', icon: ScrollText, path: '/admin/audit', group: 'Governance' },
  { id: 'settings', label: 'Settings', icon: Settings2, path: '/admin/settings', group: 'Governance' },
]
const groups = ['Operations', 'Management', 'Governance']
const statusLabels = { pending_review: 'Pending review', under_review: 'Under review', rejected: 'Rejected', verified: 'Approved' }
function submittedDate(value: string) { return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'Africa/Johannesburg' }) }
function tabTitle(tab: AdminTab) {
  if (tab === 'overview') return 'Operations overview'
  if (tab === 'instructions') return 'Payment instructions'
  if (tab === 'proofs') return 'Proof submissions'
  if (tab === 'withdrawals') return 'Withdrawal review'
  if (tab === 'content') return 'Content library'
  if (tab === 'users') return 'Members'
  if (tab === 'audit') return 'Audit log'
  if (tab === 'settings') return 'Settings'
  return 'Support'
}
function tabDescription(tab: AdminTab) {
  if (tab === 'overview') return 'Monitor payment reviews, payouts and member support in one place.'
  if (tab === 'instructions') return 'Publish the exact payment steps members should follow.'
  if (tab === 'proofs') return 'Inspect payment evidence and keep the review queue moving.'
  if (tab === 'withdrawals') return 'Approve, reject and settle withdrawal requests with a complete audit trail.'
  if (tab === 'content') return 'Publish learning resources and member announcements.'
  if (tab === 'users') return 'Manage accounts, access and member balances.'
  if (tab === 'audit') return 'Review every recorded administrative operation.'
  if (tab === 'settings') return 'Manage the details members see across their workspace.'
  return 'Respond to member requests and close resolved conversations.'
}

export function AdminPayments() {
  const { demo, session, startDemo, signOut, dark, setDark } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const view = new URLSearchParams(location.search).get('view')
  const segment = location.pathname.split('/')[2] || ''
  const contentCollection = segment === 'announcements' ? 'announcements' : 'resources'
  let tab: AdminTab = 'overview'
  if (location.pathname === '/admin/payments') tab = view === 'proofs' ? 'proofs' : 'instructions'
  else if (location.pathname === '/admin/withdrawals') tab = 'withdrawals'
  else if (segment === 'resources' || segment === 'announcements' || segment === 'content') tab = 'content'
  else if (['users', 'settings', 'audit', 'support'].includes(segment)) tab = segment as SystemSection
  const isSystemTab = ['users', 'settings', 'audit', 'support'].includes(tab)
  const isPaymentsDataTab = tab === 'overview' || tab === 'instructions' || tab === 'proofs'
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
  const [ops, setOps] = useState<{ withdrawals: number | null; support: number | null; loading: boolean; error: string }>({ withdrawals: null, support: null, loading: false, error: '' })
  const isAdmin = session?.user.app_metadata.role === 'admin'
  const demoId = preview ? demo?.id : undefined
  const token = isAdmin && !preview ? session?.access_token : undefined
  const access = useMemo<PaymentAccess | null>(() => demoId ? { demoId } : token ? { accessToken: token } : null, [demoId, token])
  const liveAccess = useMemo<PaymentAccess | null>(() => access && 'accessToken' in access ? access : null, [access])
  useEffect(() => { setMessage(''); setError('') }, [location.pathname, location.search])
  useEffect(() => {
    if (!access || !isPaymentsDataTab) return
    let active = true
    setLoading(true); setLoaded(false); setError(''); setConfig(null)
    Promise.all([loadRequests(access, true), loadAllInstructions(access)])
      .then(([rows, values]) => { if (active) { setRequests(rows); setMarkets(values); setConfig(values.find(item => item.country === country) || null); setLoaded(true) } })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to load workspace data.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [access, country, revision, isPaymentsDataTab])
  useEffect(() => {
    if (!liveAccess) { setOps({ withdrawals: null, support: null, loading: false, error: '' }); return }
    let active = true
    setOps(previous => ({ ...previous, loading: true, error: '' }))
    Promise.allSettled([listWithdrawals(liveAccess), listSupportTickets(liveAccess)]).then(([withdrawals, support]) => {
      if (!active) return
      setOps({
        withdrawals: withdrawals.status === 'fulfilled' ? withdrawals.value.filter(withdrawalNeedsAttention).length : null,
        support: support.status === 'fulfilled' ? support.value.filter(ticket => ticket.status === 'open').length : null,
        loading: false,
        error: withdrawals.status === 'rejected' || support.status === 'rejected' ? 'Some live queues could not be loaded.' : '',
      })
    })
    return () => { active = false }
  }, [liveAccess, revision])
  function go(next: NavId | 'instructions' | 'proofs' | 'resources' | 'announcements') {
    setMessage('')
    if (next === 'proofs') navigate('/admin/payments?view=proofs')
    else if (next === 'instructions' || next === 'payments') navigate('/admin/payments')
    else if (next === 'resources' || next === 'announcements') navigate(`/admin/${next}`)
    else navigate(navigation.find(item => item.id === next)?.path || '/admin')
  }
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
  const attentionPayments = counts.pending_review + counts.under_review
  const filtered = requests.filter(row => (status === 'all' || row.status === status) && (marketFilter === 'all' || row.country === marketFilter) && `${row.fullName} ${row.phone} ${row.id} ${row.transactionReference} ${row.planId}`.toLowerCase().includes(search.toLowerCase().trim()))
  const publishedMarkets = markets.filter(item => item.methods.some(method => method.enabled))
  const published = publishedMarkets.length
  const title = tabTitle(tab)
  const attentionRows = requests.filter(row => row.status === 'pending_review' || row.status === 'under_review').sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)).slice(0, 5)
  function isCurrent(item: NavId) {
    if (item === 'payments') return tab === 'instructions' || tab === 'proofs'
    if (item === 'withdrawals') return tab === 'withdrawals'
    if (item === 'content') return tab === 'content'
    if (item === 'support') return tab === 'support'
    if (item === 'users') return tab === 'users'
    if (item === 'audit') return tab === 'audit'
    if (item === 'settings') return tab === 'settings'
    return tab === 'overview'
  }
  function badge(item: NavId) {
    if (item === 'payments') return loaded && attentionPayments ? attentionPayments : null
    if (item === 'withdrawals') return ops.withdrawals || null
    if (item === 'support') return ops.support || null
    return null
  }
  async function logout() {
    try { await signOut(); setPreview(false); navigate('/login') }
    catch { setError('Unable to sign out. Please try again.') }
  }
  const queues = [
    { id: 'proofs' as const, label: 'Payment proofs', detail: 'Pending or under review', count: attentionPayments, icon: FileCheck2, live: true },
    { id: 'withdrawals' as const, label: 'Withdrawal requests', detail: 'Requested or under review', count: ops.withdrawals, icon: Banknote, live: !!liveAccess },
    { id: 'support' as const, label: 'Support requests', detail: 'Open conversations', count: ops.support, icon: LifeBuoy, live: !!liveAccess },
  ]
  return <div className="admin-shell">
    <a className="skip-link" href="#admin-main">Skip to admin content</a>
    <aside className="admin-sidebar" aria-label="Admin navigation">
      <div className="admin-brand"><Logo /><span>ADMIN</span></div>
      <div className="admin-nav-groups">{groups.map(group => <div className="admin-nav-group" key={group}><p className="admin-nav-caption">{group}</p><nav aria-label={`${group} navigation`}>{navigation.filter(item => item.group === group).map(item => <Link key={item.id} to={item.path} aria-current={isCurrent(item.id) ? 'page' : undefined}><span className="admin-nav-icon"><item.icon size={17} /></span><span>{item.label}</span>{badge(item.id) ? <b>{badge(item.id)}</b> : null}</Link>)}</nav></div>)}</div>
      <div className="admin-sidebar-bottom"><Link to={demo || session ? '/dashboard' : '/login'}><ArrowDownLeft size={18} />Member dashboard</Link>{access && <button onClick={() => void logout()}><LogOut size={18} />Sign out</button>}<small>LipaHub administration</small></div>
    </aside>
    <div className="admin-body">
      <header className="admin-topbar"><div className="admin-breadcrumb"><span>Admin</span><ChevronRight size={14} /><strong>{title}</strong></div><div className="admin-topbar-actions"><Link className="admin-member-link" to={demo || session ? '/dashboard' : '/login'} aria-label="Back to dashboard" title="Back to dashboard"><ArrowDownLeft size={18} /></Link><button className="admin-appearance" onClick={() => setDark(!dark)} aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}><SlidersHorizontal size={17} /></button>{access && <button className="admin-mobile-logout" aria-label="Sign out" onClick={() => void logout()}><LogOut size={17} /></button>}<span className={`admin-access-badge ${preview ? 'demo' : ''}`}><span />{access ? preview ? 'Demo workspace' : 'Administrator' : 'Restricted access'}</span><span className="admin-avatar" aria-label="Administrator profile">{preview ? 'D' : String(session?.user.user_metadata.display_name || 'A').charAt(0).toUpperCase()}</span></div></header>
      <main className="admin-content" id="admin-main">
        <div className="admin-page-title"><div><span className="admin-eyebrow">LIPAHUB / ADMINISTRATION</span><h1>{title}</h1><p>{tabDescription(tab)}</p></div>{access && (tab === 'overview' || tab === 'instructions' || tab === 'proofs') && <button className="button secondary small" disabled={loading || busy} onClick={() => { setMessage(''); setRevision(value => value + 1) }}><RefreshCw size={15} className={loading ? 'admin-spin' : ''} />Refresh data</button>}</div>
        {!access ? <section className="admin-access-panel panel"><div className="admin-access-art"><ShieldCheck size={48} /><span>SECURE OPERATIONS</span><h2>Run LipaHub with a complete audit trail.</h2><p>Review payments and payouts, manage members and balances, publish content and respond to support requests.</p></div><div className="admin-access-copy"><span className="admin-eyebrow">ADMINISTRATOR ACCESS</span><h2>Admin workspace</h2><p>{session && !isAdmin ? 'Your account does not have the administrator role.' : 'Sign in with an administrator account to access live operations' + (demoEnabled ? ', or explore the workspace with local demo data.' : '.')}</p>{demoEnabled && <button className="button primary" onClick={() => { if (!demo) startDemo(); setPreview(true) }}>Open admin demo<ArrowRight size={16} /></button>}{!session && <Link className="text-link" to="/login">Sign in as administrator<ChevronRight size={14} /></Link>}{demoEnabled && <small>The demo uses this browser only and does not grant live admin permissions.</small>}</div></section> : <>
          {preview && <div className="admin-environment"><ShieldCheck size={17} /><p><strong>Demo workspace</strong>You are working with local browser data. Live withdrawals and support are read-only placeholders.</p><span>BROWSER LOCAL</span></div>}
          {error && !isSystemTab && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}{loading && isPaymentsDataTab && <p className="admin-loading" role="status">Loading workspace data…</p>}
          {tab === 'overview' && <div className="admin-metrics">{[
            { label: 'Payment proofs to review', value: loaded ? attentionPayments : null, detail: loaded ? `${counts.pending_review} pending · ${counts.under_review} in review` : 'Loading payment queue', icon: FileCheck2, tone: 'teal' },
            { label: 'Withdrawals to review', value: liveAccess ? ops.withdrawals : null, detail: !liveAccess ? 'Live administrator access required' : ops.loading ? 'Loading payout queue' : ops.withdrawals === null ? 'Queue unavailable' : 'Requested or under review', icon: Banknote, tone: 'amber' },
            { label: 'Open support requests', value: liveAccess ? ops.support : null, detail: !liveAccess ? 'Live administrator access required' : ops.loading ? 'Loading support inbox' : ops.support === null ? 'Inbox unavailable' : 'Awaiting a team reply', icon: LifeBuoy, tone: 'indigo' },
            { label: 'Published payment markets', value: loaded ? published : null, detail: `Of ${countries.length} country options`, icon: Globe2, tone: 'blue' },
          ].map(metric => <article className="admin-metric panel" key={metric.label}><div><span>{metric.label}</span><span className={`admin-metric-icon ${metric.tone}`}><metric.icon size={19} /></span></div><strong>{metric.value === null ? '—' : metric.value.toLocaleString()}</strong><small>{metric.detail}</small></article>)}</div>}
          {tab === 'overview' && loaded && <>
            <div className="admin-overview-grid"><section className="panel admin-recent"><div className="admin-section-heading"><div><h2>Payment proofs needing review</h2><p>Pending or under-review submissions</p></div><button className="text-link" onClick={() => go('proofs')}>Open queue<ArrowRight size={14} /></button></div><RequestTable rows={attentionRows} review={row => { setSearch(row.id); setStatus('all'); setMarketFilter('all'); go('proofs') }} /></section>
              <section className="panel admin-queues"><div className="admin-section-heading"><div><h2>Queues needing attention</h2><p>Payments, payouts and member support</p></div></div><div className="admin-queue-list">{queues.map(queue => <button key={queue.id} onClick={() => go(queue.id)}><span className={`admin-queue-icon ${queue.id}`}><queue.icon size={16} /></span><span className="admin-queue-copy"><strong>{queue.label}</strong><small>{queue.live ? queue.detail : 'Live administrator access required'}</small></span><span className="admin-queue-count">{queue.count === null ? '—' : queue.count.toLocaleString()}</span><ChevronRight size={15} /></button>)}</div><p className="admin-card-footnote">Approving a payment or rejecting a withdrawal updates the member wallet and audit history immediately.</p></section></div>
            <section className="panel admin-market-panel"><div className="admin-section-heading"><div><h2>Payment markets</h2><p>{published} of {countries.length} countries have a published payment option</p></div><button className="text-link" onClick={() => go('instructions')}>Manage instructions<ArrowRight size={14} /></button></div>{publishedMarkets.length ? <div className="admin-market-grid">{publishedMarkets.slice(0, 9).map(market => <button key={market.country} onClick={() => { setCountry(market.country); go('instructions') }}><CountryFlag country={market.country} /><strong>{market.country}</strong><span>{market.methods.filter(method => method.enabled).length} / {market.methods.length} published</span><ChevronRight size={15} /></button>)}</div> : <div className="admin-empty admin-market-empty"><Globe2 size={30} /><h3>No payment markets published</h3><p>Choose a country, add recipient details and publish at least one method before members can submit proofs.</p><button className="text-link" onClick={() => go('instructions')}>Configure payment instructions<ArrowRight size={14} /></button></div>}</section>
          </>}
          {(tab === 'instructions' || tab === 'proofs') && <div className="admin-payments-tabs" role="tablist" aria-label="Payment administration"><button role="tab" aria-selected={tab === 'instructions'} onClick={() => go('instructions')}>Payment instructions</button><button role="tab" aria-selected={tab === 'proofs'} onClick={() => go('proofs')}>Proof submissions{attentionPayments ? <b>{attentionPayments}</b> : null}</button></div>}
          {tab === 'instructions' && <section className="panel admin-payment-editor"><div className="admin-editor-heading"><div><h2>Country payment settings</h2><p>Publish the exact steps members should follow.</p></div><CreditCard size={23} /></div><label className="admin-country-field">Payment country<select value={country} disabled={busy} onChange={event => { setCountry(event.target.value as Country); setMessage('') }}>{countries.map(item => <option key={item}>{item}</option>)}</select></label>{config && <form onSubmit={save}>
            {config.methods.map(method => <section className="admin-method-editor" key={method.id}><div><h3>{method.name}</h3><label className="check-label"><input type="checkbox" checked={method.enabled} onChange={event => editMethod(method.id, { enabled: event.target.checked })} /><span>Publish {method.name}</span></label></div><div className="admin-method-fields">
              <label>Recipient phone / code / wallet address<input value={method.recipient} onChange={event => editMethod(method.id, { recipient: event.target.value })} maxLength={200} /></label>
              <label>Recipient name (if applicable)<input value={method.accountName} onChange={event => editMethod(method.id, { accountName: event.target.value })} maxLength={120} /></label>
              {country === 'Rwanda' && <label>Activation amount (RWF) for {method.name}<input type="number" min="1" max="999999999999" step="1" value={method.amountMinor ?? ''} onChange={event => editMethod(method.id, {amountMinor: event.target.value ? Number(event.target.value) : null})} required={method.enabled} /></label>}{method.name === 'Binance TRC' && <><label>Crypto asset<input value={method.asset} onChange={event => editMethod(method.id, { asset: event.target.value })} maxLength={40} required={method.enabled} /></label><label>Payment network<input value={method.network} onChange={event => editMethod(method.id, { network: event.target.value })} maxLength={80} required={method.enabled} /></label></>}
              <label>Instructions for {method.name}<textarea value={method.instructions} onChange={event => editMethod(method.id, { instructions: event.target.value })} maxLength={4000} required={method.enabled} placeholder="Enter the exact payment steps, recipient details and any reference the member must include." /></label>
            </div></section>)}
            <div className="admin-save-bar"><p>Version {config.version}<span>{preview ? 'Published options appear in the local member preview.' : config.intakeEnabled ? 'Proof intake enabled.' : 'Proof intake disabled on the server.'}</span></p><button className="button primary" disabled={busy || loading}>{busy ? 'Saving…' : 'Save payment instructions'}</button></div>
          </form>}</section>}
          {tab === 'proofs' && loaded && <><div className="admin-queue-toolbar"><label className="admin-search"><Search size={17} /><span className="sr-only">Search submissions</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search name, phone or reference…" /></label><label><span className="sr-only">Filter by status</span><select aria-label="Filter by status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">All statuses</option>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label><span className="sr-only">Filter by country</span><select aria-label="Filter by country" value={marketFilter} onChange={event => setMarketFilter(event.target.value)}><option value="all">All countries</option>{countries.map(item => <option key={item}>{item}</option>)}</select></label></div><div className="admin-queue-count"><strong>{filtered.length} submissions</strong><span>Manual payment approval · activation requires payment verification</span></div><div className="admin-proof-list">{!filtered.length && <EmptyState filtered={requests.length > 0} reset={() => { setSearch(''); setStatus('all'); setMarketFilter('all') }} />}{filtered.map(row => <ProofReview key={`${row.id}-${row.status}-${row.reviewNote}`} row={row} access={access} openImage={id => setImage({ row, id })} updated={() => setRevision(value => value + 1)} />)}</div></>}
          {tab === 'withdrawals' && <AdminWithdrawals access={access} revision={revision} onChanged={() => setRevision(value => value + 1)} />}
          {tab === 'content' && <><div className="admin-subtabs" role="tablist" aria-label="Content type"><button role="tab" aria-selected={contentCollection === 'resources'} onClick={() => go('resources')}><BookOpen size={15} />Resources</button><button role="tab" aria-selected={contentCollection === 'announcements'} onClick={() => go('announcements')}><Megaphone size={15} />Announcements</button></div><AdminSystem key={contentCollection} section={contentCollection} access={access} revision={revision} /></>}
          {isSystemTab && <AdminSystem key={tab} section={tab as SystemSection} access={access} revision={revision} />}
          {image && <ProofImage access={access} row={image.row} fileId={image.id} close={() => setImage(null)} />}
        </>}
        <footer className="admin-footer"><span>© {new Date().getFullYear()} LipaHub</span><span>Administrative console</span></footer>
      </main>
    </div>
  </div>
}
function EmptyState({ filtered = false, reset }: { filtered?: boolean; reset?: () => void }) {
  return <div className="admin-empty"><FileCheck2 size={32} /><h3>{filtered ? 'No matching submissions' : 'Your queue is clear'}</h3><p>{filtered ? 'Try another search or adjust the filters.' : 'New payment proofs will appear here when members submit them.'}</p>{filtered && reset && <button className="text-link" onClick={reset}>Clear filters</button>}</div>
}
function RequestTable({ rows, review }: { rows: PaymentRequest[]; review: (row: PaymentRequest) => void }) {
  if (!rows.length) return <EmptyState />
  return <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Member / plan</th><th>Country</th><th>Status</th><th>Submitted</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{rows.map(row => <tr key={row.id}><td><strong>{row.fullName}</strong><small>{paymentRequestTitle(row)}</small></td><td><span className="admin-table-country"><CountryFlag country={row.country} />{row.country}</span></td><td><span className={`admin-status-badge status-${row.status}`}>{statusLabels[row.status]}</span></td><td>{submittedDate(row.submittedAt)}</td><td><button aria-label={`Review submission from ${row.fullName}`} className="icon-button" onClick={() => review(row)}><ArrowRight size={16} /></button></td></tr>)}</tbody></table></div>
}
function ProofReview({ row, access, openImage, updated }: { row: PaymentRequest; access: PaymentAccess; openImage: (id: string) => void; updated: () => void }) {
  const accountActivation = row.purpose === 'account_activation'
  const [note, setNote] = useState(row.reviewNote)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirming, setConfirming] = useState(false)
  const [checked, setChecked] = useState(false)
  const reviewable = ['pending_review', 'under_review'].includes(row.status)
  async function review(status: 'under_review' | 'rejected' | 'verified') {
    if (status !== 'under_review' && note.trim().length < 3) { setError('Enter a review note before approving or rejecting a proof.'); return }
    if (status === 'verified' && !checked) return
    setBusy(true); setError('')
    try {
      await reviewProof(access, row.id, status, note, row.reviewVersion || 1)
      setConfirming(false); setChecked(false)
      window.dispatchEvent(new CustomEvent('lipahub-balance-changed', { detail: { userId: row.userId, country: row.country } }))
      const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lipahub-balances') : null
      channel?.postMessage({userId: row.userId, country: row.country}); channel?.close()
      updated()
    } catch (err) { setError(err instanceof Error ? err.message : 'Review failed. Refresh before retrying.') }
    finally { setBusy(false) }
  }
  return <article className="panel admin-proof-card">
    <div className="admin-proof-heading"><h3>{paymentRequestTitle(row)} · {row.country}</h3><span className="pill">{row.status === 'verified' ? 'Approved' : row.status.replaceAll('_', ' ')}</span></div>
    <dl className="admin-proof-details">
      <div><dt>Request ID</dt><dd>{row.id}</dd></div><div><dt>Submitted</dt><dd>{new Date(row.submittedAt).toLocaleString('en-GB', {timeZone: 'Africa/Johannesburg'})}</dd></div>
      <div><dt>Full names</dt><dd>{row.fullName}</dd></div><div><dt>Phone number</dt><dd>{row.phone}</dd></div>
      <div><dt>Payment amount</dt><dd>{paymentAmount(row.quote.value, row.country)}</dd></div>{!accountActivation && <div><dt>One-time bonus on approval</dt><dd>{paymentAmount(row.quote.bonus, row.country)}</dd></div>}
      <div><dt>Recipient at submission</dt><dd>{row.paymentMethod.recipient || 'Not provided'}</dd></div><div><dt>Asset / network</dt><dd>{[row.paymentMethod.asset, row.paymentMethod.network].filter(Boolean).join(' / ') || 'Not applicable'}</dd></div>
      <div><dt>Method / instruction version</dt><dd>{row.paymentMethod.name} · v{row.instructionVersion}</dd></div><div><dt>Transaction reference</dt><dd>{row.transactionReference || 'Not provided'}</dd></div>
    </dl>
    <div className="admin-proof-files">{row.files.map((file, i) => <button className="button secondary" key={file.id} onClick={() => openImage(file.id)}><Image size={14} />Screenshot {i + 1}</button>)}</div>
    {error && <p className="form-error" role="alert">{error}</p>}
    {row.status === 'verified' && <p className="payment-review-note">{accountActivation ? 'Approved. This member can now access the dashboard.' : 'Approved. The robot is active and its one-time bonus has been credited.'}</p>}
    <div className="admin-proof-review"><label>Review note<textarea value={note} onChange={event => setNote(event.target.value)} maxLength={1000} disabled={busy || !reviewable} /></label>
      {reviewable && !confirming && <div><button className="button primary" disabled={busy} onClick={() => { setConfirming(true); setChecked(false); setError('') }}>Approve payment</button><button className="button secondary" disabled={busy} onClick={() => void review('under_review')}>Mark under review</button><button className="button secondary admin-danger-text" disabled={busy} onClick={() => void review('rejected')}>Reject proof</button></div>}
    </div>
    {confirming && reviewable && <section className="approval-confirmation"><h4>Confirm payment approval</h4>{accountActivation ? <p>This approves the account activation payment and unlocks this member's dashboard. No robot bonus is credited.</p> : <p>This activates {paymentRequestTitle(row)} and credits <strong>{paymentAmount(row.quote.bonus, row.country)}</strong> to this member's bonus balance once.</p>}
      <label className="check-label"><input type="checkbox" checked={checked} onChange={event => setChecked(event.target.checked)} disabled={busy} /><span>I checked the screenshot and matched the payment to the recipient's records.</span></label>
      <div><button className="button primary" disabled={busy || !checked} onClick={() => void review('verified')}>{busy ? 'Approving…' : 'Confirm approval'}</button><button className="button secondary" disabled={busy} onClick={() => setConfirming(false)}>Cancel</button></div>
    </section>}
  </article>
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
