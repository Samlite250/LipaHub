import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ClipboardList, Clock3, ImagePlus, LockKeyhole, X } from 'lucide-react'
import { Modal } from '../components'
import type { Country } from '../domain/countries'
import { formatRobotMoney, getRobotTerms, type Robot } from '../domain/robots'
import { validateProofImages, type PaymentAccess, type PaymentInstructions, type PaymentRequest } from '../domain/payments'
import { loadInstructions, submitProof } from '../lib/payments'
import { useApp } from '../state'
import './Payments.css'

export function ActivationPayment({ robot, country, access, request, close, submitted }: { robot: Robot; country: Country; access: PaymentAccess; request?: PaymentRequest; close: () => void; submitted: (row: PaymentRequest) => void }) {
  const { demo, session } = useApp()
  const [instructions, setInstructions] = useState<PaymentInstructions | null>(null)
  const [methodId, setMethodId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [urls, setUrls] = useState<string[]>([])
  const [fullName, setFullName] = useState(demo?.name || session?.user.user_metadata.display_name || '')
  const [phone, setPhone] = useState(session?.user.user_metadata.phone || '')
  const phoneHelp = useId()
  const isDemo = 'demoId' in access
  const terms = getRobotTerms(robot.id, country)!
  const method = instructions?.methods.find(item => item.id === methodId && item.enabled)
  const ready = !!method && instructions?.intakeEnabled === true
  useEffect(() => {
    let active = true
    loadInstructions(access, country).then(value => { if (active) { setInstructions(value); setMethodId(value.methods.find(item => item.enabled)?.id || '') } }).catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [access, country])
  useEffect(() => {
    const next = files.map(file => URL.createObjectURL(file)); setUrls(next)
    return () => next.forEach(url => URL.revokeObjectURL(url))
  }, [files])
  async function selectFiles(next: File[]) {
    setError(''); setBusy(true)
    try { await validateProofImages(next); setFiles(next) } catch (err) { setError(err instanceof Error ? err.message : 'Unable to read screenshots.'); setFiles([]) }
    finally { setBusy(false) }
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('')
    if (!instructions || !ready) { setError('Payment instructions are not available.'); return }
    setBusy(true)
    try {
      const fields = new FormData(event.currentTarget)
      submitted(await submitProof(access, { country, planId: robot.id, methodId, instructionVersion: instructions.version, fullName, phone, transactionReference: String(fields.get('reference') || ''), files }))
    } catch (err) { setError(err instanceof Error ? err.message : 'Submission failed. Check your request history before retrying.') }
    finally { setBusy(false) }
  }
  const pending = request && request.status !== 'rejected'
  const approved = request?.status === 'verified'
  return <Modal title={`${robot.name} activation`} close={close}><div className="activation-payment">
    <div className="payment-plan-summary"><span>{country} · {robot.name}</span><strong>{formatRobotMoney(request?.quote.value ?? terms.value, country)}</strong><small>Activation payment · one-time bonus {formatRobotMoney(request?.quote.bonus ?? terms.bonus, country)} after admin approval</small></div>
    {isDemo && <p className="payment-preview-note">Demo only. Do not send money. Use test details and images; records and bonuses stay in this browser.</p>}
    {pending ? <div className="proof-pending">{approved ? <CheckCircle2 size={30} /> : <Clock3 size={30} />}<h3>{approved ? 'Payment approved — robot active' : request.status === 'under_review' ? 'Proof under review' : 'Proof submitted — pending review'}</h3>
      <p>{approved ? `Your one-time bonus of ${formatRobotMoney(request.quote.bonus, country)} has been credited to your bonus balance.` : 'An administrator will check your payment. Approval activates the robot and credits its one-time bonus.'}</p>
      <dl><div><dt>Request ID</dt><dd>{request.id}</dd></div><div><dt>Payment method</dt><dd>{request.paymentMethod.name}</dd></div><div><dt>Screenshots</dt><dd>{request.files.length}</dd></div></dl>
      {request.reviewNote && <p className="payment-review-note">Admin note: {request.reviewNote}</p>}<button className="button primary" onClick={close}>Done</button>
    </div> : <>
      {loading && <p className="muted" role="status">Loading payment instructions…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && instructions && <>
        {request?.status === 'rejected' && <p className="payment-review-note">Previous submission rejected: {request.reviewNote}. Check the details and submit a new proof.</p>}
        <section className="payment-form-section"><h3><span>1</span> Payment instructions</h3>
          <div className="payment-methods">{instructions.methods.map(item => <button type="button" className={methodId === item.id ? 'selected' : ''} aria-pressed={methodId === item.id} disabled={!item.enabled || !instructions.intakeEnabled || busy} key={item.id} onClick={() => setMethodId(item.id)}><ClipboardList size={17} /><span>{item.name}<small>{item.enabled && instructions.intakeEnabled ? 'View admin instructions' : 'Not configured'}</small></span></button>)}</div>
          {ready && method ? <div className="admin-payment-instructions"><h3>{method.name}</h3><dl>
            {method.recipient && <div><dt>{method.name === 'Binance TRC' ? 'Wallet address' : 'Payment recipient / code'}</dt><dd className="payment-recipient">{method.recipient}</dd></div>}
            {method.accountName && <div><dt>Recipient name</dt><dd>{method.accountName}</dd></div>}
            {method.asset && <div><dt>Asset</dt><dd>{method.asset}</dd></div>}{method.network && <div><dt>Network</dt><dd>{method.network}</dd></div>}
          </dl><p>{method.instructions}</p><small>Instructions version {instructions.version}</small></div> : <div className="payment-unconfigured"><LockKeyhole size={24} /><h3>Payment instructions are not published yet</h3><p>The admin must publish a payment option and enable proof submissions before you pay or submit.</p>{isDemo && <Link className="text-link" to="/admin/payments" onClick={close}>Open admin payment preview</Link>}</div>}
        </section>
        {ready && <form className="proof-form" onSubmit={submit}>
          <section className="payment-form-section"><h3><span>2</span> Your payment details</h3><div className="proof-contact-fields">
            <label>Full names<input name="fullName" value={fullName} onChange={event => setFullName(event.target.value)} minLength={2} maxLength={120} autoComplete="name" disabled={busy} required /></label>
            <label>Phone number<input name="phone" aria-label="Phone number" aria-describedby={phoneHelp} value={phone} onChange={event => setPhone(event.target.value)} type="tel" placeholder="+25779000000" pattern="[+][1-9][0-9]{6,14}" autoComplete="tel" disabled={busy} required /><small id={phoneHelp}>Include the country code.</small></label>
          </div><label>Transaction reference (optional)<input name="reference" maxLength={100} disabled={busy} /></label></section>
          <section className="payment-form-section"><h3><span>3</span> Upload your screenshot</h3>
            <label className="proof-upload"><ImagePlus size={22} /><span>Payment screenshots</span><small>1–3 PNG or JPEG images, up to 3 MB combined</small><input type="file" accept="image/png,image/jpeg" multiple disabled={busy} onChange={event => void selectFiles(Array.from(event.target.files || []))} /></label>
            <div className="proof-thumbnails">{files.map((file, i) => <div key={`${file.name}-${i}`}><img src={urls[i]} alt={`Selected screenshot ${i + 1}`} /><span>{file.name}</span><button type="button" className="icon-button" disabled={busy} aria-label={`Remove screenshot ${i + 1}`} onClick={() => setFiles(previous => previous.filter((_, index) => index !== i))}><X size={15} /></button></div>)}</div>
          </section>
          <label className="check-label"><input type="checkbox" disabled={busy} required /><span>I confirm these details match my payment and understand that an administrator must approve it.</span></label>
          <button className="button primary payment-wide" disabled={busy || !files.length}>{busy ? 'Submitting…' : 'Submit payment proof'}</button>
        </form>}
      </>}
    </>}
    <p className="payment-security"><CheckCircle2 size={14} />Screenshots are private. Activation and the one-time bonus require admin approval.</p>
  </div></Modal>
}
