import { useEffect, useState, type FormEvent } from 'react'
import { Check, RefreshCw, Wallet } from 'lucide-react'
import { Modal } from '../components'
import { countries, type Country } from '../domain/countries'
import { parseWalletAmount, walletDigits, walletInput, walletMoney, type BalanceView } from '../domain/balances'
import type { ManagedUser } from '../domain/admin'
import type { PaymentAccess } from '../domain/payments'
import { adjustBalance, getBalance } from '../lib/balances'

export function AdminBalance({ user, access, close }: { user: ManagedUser; access: PaymentAccess; close: () => void }) {
  const [country, setCountry] = useState<Country>(user.country)
  const [view, setView] = useState<BalanceView | null>(null)
  const [available, setAvailable] = useState(''); const [bonus, setBonus] = useState(''); const [reason, setReason] = useState('')
  const [requestId, setRequestId] = useState(() => crypto.randomUUID())
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [reviewing, setReviewing] = useState(false); const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true; setLoading(true); setView(null); setError(''); setReviewing(false); setReason(''); setRequestId(crypto.randomUUID())
    getBalance(access, user.id, country).then(value => { if (active) { setView(value); setAvailable(walletInput(value.wallet.availableMinor, value.wallet.currency)); setBonus(walletInput(value.wallet.bonusMinor, value.wallet.currency)) } }).catch(error => { if (active) setError(error.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [access, user.id, country, revision])
  const wallet = view?.wallet
  function edit(change: () => void) { change(); setRequestId(crypto.randomUUID()); setNotice(''); setError(''); setReviewing(false) }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!wallet) return
    setError(''); setNotice('')
    try {
      const nextAvailable = parseWalletAmount(available, wallet.currency); const nextBonus = parseWalletAmount(bonus, wallet.currency)
      if (reason.trim().length < 10 || reason.trim().length > 500) throw new Error('Enter an adjustment reason between 10 and 500 characters.')
      if (wallet.availableMinor === nextAvailable && wallet.bonusMinor === nextBonus) throw new Error('Enter a different available or bonus balance.')
      if (!reviewing) { setReviewing(true); return }
      setBusy(true)
      await adjustBalance(access, user.id, { country, available, bonus, reason: reason.trim(), version: wallet.version, requestId })
      setNotice('Balance adjustment saved successfully.'); setRevision(value => value + 1)
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to save the adjustment.') }
    finally { setBusy(false) }
  }
  return <Modal title="Manage user balances" close={() => { if (!busy) close() }}><div className="admin-balance-member"><span className="icon-chip teal"><Wallet size={22} /></span><div><strong>{user.name || user.email}</strong><small>{user.email}</small></div><button className="icon-button" aria-label="Reload wallet" title="Reload wallet" disabled={busy || loading} onClick={() => { setNotice(''); setRevision(value => value + 1) }}><RefreshCw size={16} /></button></div>
    <label className="admin-balance-country">Wallet country<select aria-label="Wallet country" value={country} disabled={busy || reviewing} onChange={event => { setNotice(''); setCountry(event.target.value as Country) }}>{countries.map(value => <option key={value}>{value}</option>)}</select></label>
    {error && <p className="form-error" role="alert">{error}</p>}{notice && <p className="form-success" role="status">{notice}</p>}{loading && <p className="admin-inline-note">Loading wallet and adjustment history…</p>}
    {wallet && <><div className="admin-balance-summary"><div><span>Available funds</span><strong>{walletMoney(wallet.availableMinor, wallet.currency)}</strong></div><div><span>Bonus balance</span><strong>{walletMoney(wallet.bonusMinor, wallet.currency)}</strong></div></div><form className="admin-crud-form" onSubmit={submit}><fieldset disabled={busy || reviewing}><div className="admin-form-grid"><label>New available balance ({wallet.currency})<input aria-label="New available balance" required inputMode={walletDigits(wallet.currency) ? 'decimal' : 'numeric'} value={available} onChange={event => edit(() => setAvailable(event.target.value))} /></label><label>New bonus balance ({wallet.currency})<input aria-label="New bonus balance" required inputMode={walletDigits(wallet.currency) ? 'decimal' : 'numeric'} value={bonus} onChange={event => edit(() => setBonus(event.target.value))} /></label></div><label>Adjustment reason<textarea aria-label="Adjustment reason" required minLength={10} maxLength={500} value={reason} onChange={event => edit(() => setReason(event.target.value))} placeholder="Explain the correction or account credit." /></label></fieldset>
      {reviewing && <div className="admin-adjustment-review"><strong>Confirm this adjustment</strong><p>Available: {walletMoney(wallet.availableMinor, wallet.currency)} → {walletMoney(parseWalletAmount(available, wallet.currency), wallet.currency)}</p><p>Bonus: {walletMoney(wallet.bonusMinor, wallet.currency)} → {walletMoney(parseWalletAmount(bonus, wallet.currency), wallet.currency)}</p><small>{reason}</small></div>}
      <p className="admin-inline-note">{('demoId' in access) ? 'This adjustment updates the local demo member balance.' : 'This adjustment updates the saved member account balance.'} Every change records its reason, administrator and previous amounts. Countries have separate wallets.</p><div className="admin-modal-actions">{reviewing ? <button className="button secondary" type="button" disabled={busy} onClick={() => { setReviewing(false); setError('') }}>Back to edit</button> : <button className="button secondary" type="button" disabled={busy} onClick={close}>Close</button>}<button className="button primary" disabled={busy || loading}>{busy ? 'Saving…' : reviewing ? <><Check size={16} />Confirm adjustment</> : 'Review adjustment'}</button></div></form>
      <section className="admin-balance-history"><h3>Adjustment history <span>Latest 100</span></h3>{!view.history.length ? <p>No administrative adjustments yet.</p> : view.history.map(entry => <article key={entry.id}><div><strong>{entry.reason}</strong><time>{new Date(entry.createdAt).toLocaleString('en-GB', { timeZone: 'Africa/Johannesburg' })}</time></div><p>Available: {walletMoney(entry.availableBefore, entry.currency)} → {walletMoney(entry.availableAfter, entry.currency)}</p><p>Bonus: {walletMoney(entry.bonusBefore, entry.currency)} → {walletMoney(entry.bonusAfter, entry.currency)}</p><small>Administrator: {entry.actorId}</small></article>)}</section></>}
  </Modal>
}
