import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { ArrowLeft, LockKeyhole, Clock3, ImagePlus } from 'lucide-react'
import { Languages, Logo } from '../components'
import { useApp } from '../state'
import { useAccountActivation } from '../lib/account-activation'
import { submitProof } from '../lib/payments'
import { renderInstructions } from '../lib/instructions'
import { validateProofImages, type PaymentMethod, type PaymentRequest } from '../domain/payments'
import './AccountActivation.css'

export function AccountActivation() {
  const {session, loading, language, signOut} = useApp()
  const token = session?.access_token
  const status = useAccountActivation(token, !!session, true)
  const access = useMemo(() => token ? {accessToken: token} : null, [token])
  const [selected, setSelected] = useState<{name: string; method?: PaymentMethod; version: number} | null>(null)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState(session?.user.user_metadata.phone || '')
  const [files, setFiles] = useState<File[]>([])
  const [urls, setUrls] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [localRequest, setLocalRequest] = useState<PaymentRequest | null>(null)
  const tr = (en: string, rw: string) => language === 'rw' ? rw : en
  const data = status.data
  const request = localRequest && (!data?.request || localRequest.submittedAt > data.request.submittedAt) ? localRequest : data?.request
  const pending = request && request.status !== 'rejected'
  const method = selected?.method
  const changed = selected && data && selected.version !== data.instructions.version
  const ready = method?.enabled && Number(method.amountMinor) > 0 && data?.instructions.intakeEnabled && !changed
  useEffect(() => {
    const next = files.map(file => URL.createObjectURL(file)); setUrls(next)
    return () => next.forEach(url => URL.revokeObjectURL(url))
  }, [files])
  if (loading) return <div className="loading-page" role="status">Opening LipaHub…</div>
  if (!session) return <Navigate to="/login" state={{from: '/activate-account'}} replace />
  if (session.user.app_metadata.role === 'admin') return <Navigate to="/admin" replace />
  if (data?.active) return <Navigate to="/dashboard" replace />
  function choose(name: string) {
    setSelected({name, method: data?.instructions.methods.find(item => item.name === name), version: data?.instructions.version || 0})
    setFiles([]); setError(''); setCopied(false)
  }
  async function images(next: File[]) {
    setBusy(true); setError('')
    try { await validateProofImages(next); setFiles(next) } catch (error) { setFiles([]); setError(error instanceof Error ? error.message : 'Unable to read screenshots.') }
    finally { setBusy(false) }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (!access || !selected || !method || !ready) return
    const form = new FormData(event.currentTarget)
    setBusy(true)
    try {
      setLocalRequest(await submitProof(access, {purpose: 'account_activation', country: 'Rwanda', planId: 'account-activation', methodId: method.id, instructionVersion: selected.version, fullName: `${firstName.trim()} ${lastName.trim()}`, phone, transactionReference: String(form.get('reference') || ''), files}))
      status.refresh()
    } catch (error) { setError(error instanceof Error ? error.message : 'Unable to submit payment proof.') }
    finally { setBusy(false) }
  }
  async function copyRecipient() {
    try { await navigator.clipboard.writeText(method?.recipient || ''); setCopied(true) }
    catch { setError('Copy is unavailable. Select and copy the recipient details below.') }
  }
  return <main className={`account-activation-page ${selected && !pending ? 'activation-payment-page' : 'activation-welcome-page'}`}><Logo /><section className="account-activation-card">
    {(!selected || pending) && <header className="activation-welcome-heading"><h1>{tr('Welcome!', 'Murakaza neza!')}</h1>
    <h2>{tr('Activate your account', 'Fungura konti yawe')}</h2></header>}
    {status.loading && <p role="status">{tr('Loading payment options…', 'Tegereza uburyo bwo kwishyura…')}</p>}
    {(error || status.error) && <p className="form-error" role="alert">{error || status.error} {status.error && <button className="text-link" onClick={status.refresh}>Retry</button>}</p>}
    {pending ? <section className="account-activation-pending"><Clock3 size={34} /><h3>{request.status === 'under_review' ? tr('Payment under review', 'Ubwishyu buragenzurwa') : tr('Payment proof submitted', 'Ikimenyetso cy’ubwishyu cyoherejwe')}</h3>
      <p>{tr('An administrator will check your payment. Your dashboard opens after approval.', 'Umuyobozi aragenzura ubwishyu bwawe. Uzabona incamake nyuma yo kwemezwa.')}</p>
      <p>{request.paymentMethod.name} · RF {request.quote.value.toLocaleString('en-US')}</p>
      {request.reviewNote && <p className="activation-review-note">{request.reviewNote}</p>}
      <button className="button primary" onClick={status.refresh}>{tr('Check payment status', 'Reba uko ubwishyu buhagaze')}</button>
    </section> : data && <>
      {request?.status === 'rejected' && <p className="activation-review-note">{tr('Payment proof rejected:', 'Ikimenyetso cy’ubwishyu cyanzwe:')} {request.reviewNote}</p>}
      {!selected ? <div className="activation-provider-options"><button className="activation-provider-button mtn" onClick={() => choose('MTN')}>PAY WITH MTN</button><button className="activation-provider-button airtel" onClick={() => choose('Airtel')}>PAY WITH AIRTEL</button><button className="activation-provider-button dashboard" disabled>{tr('Go To Dashboard', 'Jya ku ncamake')}</button></div> : <>
        <h3 className="activation-provider-title">Rwanda {selected.name}</h3>
        <p className="activation-payment-caption">PAY WITH {selected.name.toUpperCase()} RWANDA</p>
        <Languages />
        {ready ? <>
          <p className="activation-amount">{tr('Activation payment', 'Amafaranga yo gufungura konti')}: <strong>RF {Number(method.amountMinor).toLocaleString('en-US')}</strong></p>
          <section className="activation-instructions"><p>{tr('Send payment to:', 'Ohereza ubwishyu kuri:')}</p><div className="activation-recipient"><strong>{method.recipient}</strong><button type="button" onClick={() => void copyRecipient()}>{copied ? 'Copied' : 'Copy'}</button></div>
            {method.accountName && <p>{method.accountName}</p>}<p className="activation-procedure">{renderInstructions(method.instructions)}</p>
          </section>
          <form className="activation-proof-form" onSubmit={submit}>
            <p>{tr('Enter your official names as registered on your mobile money account:', 'Shyiramo amazina yawe yanditse kuri konti ya mobile money:')}</p>
            <div className="activation-name-fields"><label><span className="sr-only">{tr('First name', 'Izina rya mbere')}</span><input placeholder={tr('First name', 'Izina rya mbere')} autoComplete="given-name" value={firstName} onChange={event => setFirstName(event.target.value)} minLength={1} maxLength={60} disabled={busy} required /></label>
            <label><span className="sr-only">{tr('Last name', 'Izina ry’umuryango')}</span><input placeholder={tr('Last name', 'Izina ry’umuryango')} autoComplete="family-name" value={lastName} onChange={event => setLastName(event.target.value)} minLength={1} maxLength={59} disabled={busy} required /></label></div>
            <label>{tr('Phone number', 'Nimero ya telefoni')}<input type="tel" autoComplete="tel" value={phone} onChange={event => setPhone(event.target.value)} placeholder="+250790000000" pattern="[+][1-9][0-9]{6,14}" disabled={busy} required /></label>
            <label>{tr('Transaction reference (optional)', 'Nimero y’ubwishyu (si ngombwa)')}<input name="reference" maxLength={100} disabled={busy} /></label>
            <label className="activation-upload"><ImagePlus size={25} /><span>{tr('Payment screenshots', 'Amafoto y’ubwishyu')}</span><small>1–3 PNG/JPEG · 3 MB total</small><input type="file" accept="image/png,image/jpeg" multiple disabled={busy} onChange={event => void images(Array.from(event.target.files || []))} /></label>
            {files.length > 0 && <div className="activation-image-previews">{files.map((file, index) => <div key={`${file.name}-${index}`}><img src={urls[index]} alt={`Selected payment screenshot ${index + 1}`} /><button type="button" disabled={busy} onClick={() => setFiles(previous => previous.filter((_, item) => item !== index))}>Remove</button></div>)}</div>}
            <label className="check-label"><input type="checkbox" disabled={busy} required /><span>{tr('These details match my payment. I understand that admin approval is required.', 'Aya makuru ahuye n’ubwishyu bwanjye. Nzi ko umuyobozi agomba kubwemeza.')}</span></label>
            <button className="button primary" disabled={busy || !files.length}>{busy ? tr('Submitting…', 'Birimo koherezwa…') : tr('Submit payment proof', 'Ohereza ikimenyetso cy’ubwishyu')}</button>
          </form>
          <section className="activation-transactions"><h4>{tr('Transactions can be seen here', 'Reba ubwishyu bwawe hano')}</h4><p>{request ? tr('Your last submission was rejected. Submit corrected payment proof above.', 'Ubwishyu bwawe bwa nyuma ntibwemejwe. Ohereza ikimenyetso gikosoye hejuru.') : tr('No payment submitted yet.', 'Nta bwishyu urohereza.')}</p></section>
        </> : <div className="activation-not-ready"><LockKeyhole size={26} /><p>{changed ? tr('Payment instructions changed. Go back and review the latest steps before submitting.', 'Amabwiriza yo kwishyura yahindutse. Subira inyuma urebe amashya.') : tr('The admin has not published this payment option and activation amount yet. Please check again later.', 'Umuyobozi ntaratangaza ubu buryo n’amafaranga yo gufungura konti. Wongere urebe nyuma.')}</p><button className="text-link" onClick={() => {setSelected(null); status.refresh()}}>Check again</button></div>}
        <button className="activation-back text-link" onClick={() => setSelected(null)} disabled={busy}><ArrowLeft size={15} />{tr('Payment options', 'Uburyo bwo kwishyura')}</button>
      </>}
      <p className="activation-access-note">{tr('Payment approval is required before you can open the dashboard.', 'Kwemezwa k’ubwishyu ni ngombwa kugira ngo ufungure incamake.')}</p>
    </>}
    <button className="activation-signout text-link" onClick={() => {void signOut().catch(error => setError(error.message || 'Unable to sign out. Try again.'))}}>{tr('Sign out', 'Sohoka')}</button>
  </section></main>
}
