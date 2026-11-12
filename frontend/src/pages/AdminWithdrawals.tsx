import { useEffect, useMemo, useState } from 'react'
import { Banknote, Building2, Check, ChevronRight, Clock3, Copy, RefreshCw, Search, ShieldCheck, Smartphone, Wallet, X } from 'lucide-react'
import { CountryFlag } from '../CountryFlag'
import { Modal } from '../components'
import { countries } from '../domain/countries'
import { walletMoney } from '../domain/balances'
import type { PaymentAccess } from '../domain/payments'
import { withdrawalActions, withdrawalMethodLabels, withdrawalNeedsAttention, withdrawalStatusLabels, type Withdrawal, type WithdrawalDecision, type WithdrawalMethod, type WithdrawalStatus } from '../domain/withdrawals'
import { listWithdrawals, reviewWithdrawal } from '../lib/withdrawals'

const decisionLabels: Record<WithdrawalDecision, string> = {
  under_review: 'Mark under review',
  approved: 'Approve request',
  rejected: 'Reject request',
  paid: 'Mark as paid',
}
function statusFilter(value: Withdrawal, filter: string) {
  if (filter === 'all') return true
  if (filter === 'attention') return withdrawalNeedsAttention(value)
  return value.status === filter
}
function methodIcon(method: WithdrawalMethod) {
  return method === 'mobile_money' ? Smartphone : method === 'bank' ? Building2 : Wallet
}
function dateTime(value: string | null) {
  return value ? new Date(value).toLocaleString('en-GB', { timeZone: 'Africa/Johannesburg', dateStyle: 'medium', timeStyle: 'short' }) : 'Not yet'
}
function shortId(value: string) { return value.slice(0, 8).toUpperCase() }

export function AdminWithdrawals({ access, revision, onChanged }: { access: PaymentAccess; revision: number; onChanged: () => void }) {
  const live = 'accessToken' in access
  const [rows, setRows] = useState<Withdrawal[]>([])
  const [loading, setLoading] = useState(live)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('attention')
  const [country, setCountry] = useState('all')
  const [selected, setSelected] = useState<Withdrawal | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!live) { setLoading(false); return }
    let active = true
    setLoading(true); setError('')
    listWithdrawals(access)
      .then(value => { if (active) setRows(value) })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Unable to load withdrawal requests.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [access, live, revision, tick])

  const counts = useMemo(() => ({
    attention: rows.filter(withdrawalNeedsAttention).length,
    approved: rows.filter(row => row.status === 'approved').length,
    paid: rows.filter(row => row.status === 'paid').length,
  }), [rows])
  const filtered = rows.filter(row => statusFilter(row, status)
    && (country === 'all' || row.country === country)
    && `${row.id} ${row.userId} ${row.country} ${row.currency} ${row.destination.account} ${row.destination.holder || ''}`.toLowerCase().includes(search.toLowerCase().trim()))

  async function copyMember(id: string) {
    try { await navigator.clipboard.writeText(id); setNotice('Member ID copied.') }
    catch { setNotice('Member ID could not be copied. Select it manually.') }
  }
  function changed(updated: Withdrawal) {
    setRows(current => current.map(row => row.id === updated.id ? updated : row))
    setSelected(null)
    setNotice(`Withdrawal ${withdrawalStatusLabels[updated.status].toLowerCase()} successfully.`)
    onChanged()
    if (updated.status === 'rejected') {
      window.dispatchEvent(new CustomEvent('lipahub-balance-changed', { detail: { userId: updated.userId, country: updated.country } }))
      const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('lipahub-balances') : null
      channel?.postMessage({ userId: updated.userId, country: updated.country }); channel?.close()
    }
  }

  return <section className="admin-system-section">
    <div className="admin-section-banner"><span className="icon-chip teal"><Banknote size={22} /></span><div><h2>Withdrawal review</h2><p>Approve, reject and settle member withdrawal requests. Intake can stay disabled while existing requests are reviewed.</p></div><button className="button secondary small" disabled={!live || loading} onClick={() => { setNotice(''); setError(''); setTick(value => value + 1) }}><RefreshCw size={15} className={loading ? 'admin-spin' : ''} />Refresh</button></div>
    {notice && <p className="form-success" role="status">{notice}</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {!live ? <div className="panel admin-live-only"><ShieldCheck size={30} /><h3>Live administrator access required</h3><p>Withdrawals move real account funds and are not simulated in the demo workspace. Sign in with an administrator account to review live requests.</p></div> : <>
      <div className="admin-queue-summary">{[
        ['attention', 'Needs attention', counts.attention],
        ['approved', 'Approved, awaiting payout', counts.approved],
        ['paid', 'Paid', counts.paid],
      ].map(([value, label, count]) => <button key={String(value)} className={status === value ? 'active' : ''} onClick={() => setStatus(String(value))}><strong>{count}</strong><span>{label}</span></button>)}</div>
      <div className="admin-queue-toolbar admin-withdrawal-toolbar"><label className="admin-search"><Search size={17} /><span className="sr-only">Search withdrawals</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Search member ID, request or payout account…" /></label><select aria-label="Filter withdrawals by status" value={status} onChange={event => setStatus(event.target.value)}><option value="attention">Needs attention</option><option value="all">All statuses</option>{(['requested', 'under_review', 'approved', 'paid', 'rejected', 'cancelled'] as WithdrawalStatus[]).map(value => <option key={value} value={value}>{withdrawalStatusLabels[value]}</option>)}</select><select aria-label="Filter withdrawals by country" value={country} onChange={event => setCountry(event.target.value)}><option value="all">All countries</option>{countries.map(item => <option key={item}>{item}</option>)}</select></div>
      <div className="panel"><div className="admin-section-heading"><div><h2>Withdrawal requests</h2><p>{filtered.length} shown · latest 200 requests · amounts held from the member wallet</p></div><span className="pill">{counts.attention} awaiting action</span></div>{loading ? <p className="admin-loading admin-padded" role="status">Loading withdrawal requests…</p> : !error && <div className="admin-table-scroll"><table className="admin-table admin-withdrawal-table"><thead><tr><th>Request</th><th>Member</th><th>Market</th><th>Amount</th><th>Payout</th><th>Status</th><th>Updated</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{filtered.map(row => { const Icon = methodIcon(row.destination.method); return <tr key={row.id}><td><strong>#{shortId(row.id)}</strong><small>{dateTime(row.createdAt)}</small></td><td><button className="admin-member-id" title={`Copy ${row.userId}`} onClick={() => void copyMember(row.userId)}>{shortId(row.userId)}<Copy size={12} /></button></td><td><span className="admin-table-country"><CountryFlag country={row.country} />{row.country}</span></td><td><strong className="admin-amount">{walletMoney(row.amountMinor, row.currency)}</strong><small>{row.channel} wallet</small></td><td><span className="admin-payout"><Icon size={14} />{withdrawalMethodLabels[row.destination.method]}</span><small>{row.destination.account}</small></td><td><span className={`admin-status-badge status-${row.status}`}>{withdrawalStatusLabels[row.status]}</span></td><td>{dateTime(row.updatedAt)}</td><td><button className="button secondary small admin-review-button" aria-label={`Review withdrawal ${shortId(row.id)}`} onClick={() => { setNotice(''); setSelected(row) }}>Review<ChevronRight size={14} /></button></td></tr> })}</tbody></table>{!filtered.length && <div className="admin-empty"><Wallet size={30} /><h3>{rows.length ? 'No matching withdrawals' : 'No withdrawal requests yet'}</h3><p>{rows.length ? 'Try another search, status or country.' : 'Member requests will appear here for manual approval and payout.'}</p>{rows.length ? <button className="text-link" onClick={() => { setSearch(''); setStatus('all'); setCountry('all') }}>Clear filters</button> : null}</div>}</div>}</div>
    </>}
    {selected && <WithdrawalReview row={selected} access={access} close={() => setSelected(null)} changed={changed} />}
  </section>
}

function WithdrawalReview({ row, access, close, changed }: { row: Withdrawal; access: PaymentAccess; close: () => void; changed: (row: Withdrawal) => void }) {
  const [note, setNote] = useState(row.note)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [confirmPaid, setConfirmPaid] = useState(false)
  const [checking, setChecking] = useState(false)
  const actions = withdrawalActions(row.status)
  const paid = actions.includes('paid')
  const Icon = methodIcon(row.destination.method)

  async function decide(decision: WithdrawalDecision) {
    if (decision === 'paid' && !checking) { setConfirmPaid(true); return }
    if (decision !== 'under_review' && note.trim().length < 3) { setError('Add a short note (at least 3 characters) before approving, rejecting or paying.'); return }
    setBusy(true); setError('')
    try { changed(await reviewWithdrawal(access, row, decision, note.trim())) }
    catch (err) { setError(err instanceof Error ? err.message : 'Unable to update this withdrawal. Reload before retrying.'); setBusy(false) }
  }
  function reset() { setConfirmPaid(false); setChecking(false) }
  return <Modal title={`Withdrawal #${shortId(row.id)}`} close={() => { if (!busy) close() }}>
    <div className="admin-withdraw-review">
      <div className="admin-withdraw-header"><div><span className={`admin-status-badge status-${row.status}`}>{withdrawalStatusLabels[row.status]}</span><h3>{walletMoney(row.amountMinor, row.currency)}</h3><p>{row.country} · {row.channel} wallet</p></div><span className="admin-withdraw-icon"><Icon size={24} /></span></div>
      <dl className="admin-withdraw-details">
        <div><dt>Member ID</dt><dd><button className="admin-member-id" onClick={() => void navigator.clipboard.writeText(row.userId)}>{row.userId}<Copy size={12} /></button></dd></div>
        <div><dt>Payout method</dt><dd>{withdrawalMethodLabels[row.destination.method]}</dd></div>
        <div><dt>Payout account</dt><dd>{row.destination.account}</dd></div>
        <div><dt>Account holder</dt><dd>{row.destination.holder || 'Not provided'}</dd></div>
        <div><dt>Requested</dt><dd>{dateTime(row.createdAt)}</dd></div>
        <div><dt>Last updated</dt><dd>{dateTime(row.updatedAt)}</dd></div>
        <div><dt>Decided</dt><dd>{dateTime(row.decidedAt)}</dd></div>
        <div><dt>Paid</dt><dd>{dateTime(row.paidAt)}</dd></div>
      </dl>
      <div className="admin-withdraw-timeline"><Clock3 size={15} /><span>Funds are held from the member wallet for the life of this request. Approved requests release no balance; rejection refunds the hold.</span></div>
      <label className="admin-withdraw-note">Review note<textarea rows={3} maxLength={1000} value={note} disabled={busy} onChange={event => setNote(event.target.value)} placeholder="Record the evidence or payout reference checked." /></label>
      {error && <p className="form-error" role="alert">{error}</p>}
      {confirmPaid ? <section className="approval-confirmation"><h4>Confirm manual payout</h4><p>Confirm that {walletMoney(row.amountMinor, row.currency)} was sent to {row.destination.account}. This cannot be undone.</p><label className="check-label"><input type="checkbox" checked={checking} disabled={busy} onChange={event => setChecking(event.target.checked)} /><span>I sent the payout and checked the recipient details.</span></label><div><button className="button primary" disabled={busy || !checking} onClick={() => void decide('paid')}>{busy ? 'Recording…' : 'Confirm payout'}</button><button className="button secondary" disabled={busy} onClick={reset}>Cancel</button></div></section> : actions.length ? <div className="admin-withdraw-actions">
        {actions.includes('approved') && <button className="button primary" disabled={busy} onClick={() => void decide('approved')}>{busy ? 'Saving…' : decisionLabels.approved}</button>}
        {paid && <button className="button primary" disabled={busy} onClick={() => void decide('paid')}>{busy ? 'Saving…' : decisionLabels.paid}</button>}
        {actions.includes('under_review') && <button className="button secondary" disabled={busy} onClick={() => void decide('under_review')}>{decisionLabels.under_review}</button>}
        {actions.includes('rejected') && <button className="button secondary admin-danger-text" disabled={busy} onClick={() => void decide('rejected')}><X size={15} />{decisionLabels.rejected}</button>}
      </div> : <p className="admin-withdraw-final"><Check size={16} />This request is complete. The recorded decision is final.</p>}
      {!paid && <button className="text-link admin-withdraw-close" disabled={busy} onClick={close}>Close review</button>}
    </div>
  </Modal>
}
