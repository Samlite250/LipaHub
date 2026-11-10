import { useEffect, useState, type FormEvent } from 'react'
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
  const [stage, setStage] = useState<'instructions' | 'proof'>('instructions')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [urls, setUrls] = useState<string[]>([])
  const [fullName, setFullName] = useState(demo?.name || session?.user.user_metadata.display_name || '')
  const [phone, setPhone] = useState(session?.user.user_metadata.phone || '')
  const isDemo = 'demoId' in access
  const terms = getRobotTerms(robot.id, country)!
  const method = instructions?.methods.find(item => item.id === methodId && item.enabled)
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
    if (!instructions || !method || !instructions.intakeEnabled) { setError('Payment instructions are not available.'); return }
    setBusy(true)
    try {
      const fields = new FormData(event.currentTarget)
      const row = await submitProof(access, { country, planId: robot.id, methodId, instructionVersion: instructions.version, fullName, phone, transactionReference: String(fields.get('reference') || ''), files })
      submitted(row)
    } catch (err) { setError(err instanceof Error ? err.message : 'Submission failed. Nothing has been activated.') }
    finally { setBusy(false) }
  }
  const pending = request && request.status !== 'rejected'
  return <Modal title={`${robot.name} activation`} close={close}><div className="activation-payment">
    <span className="pill indigo-pill">{isDemo ? 'Browser-local record' : 'Payment verification required'}</span>
    <div className="payment-plan-summary"><span>{country}</span><strong>{formatRobotMoney(request?.quote.value ?? terms.value, country)}</strong><small>Activation value · bonus after verified activation</small></div>
    {method?.name === 'Binance TRC' && <p className="muted">USD reference value: {formatRobotMoney(getRobotTerms(robot.id, 'International')!.value, 'International')}. Follow the admin instructions for the exact crypto asset amount and network.</p>}
    {isDemo && <p className="payment-preview-note">Payment processing is not enabled. Do not send money. Use test names, phone numbers and screenshots; submissions stay in this browser.</p>}
    {pending ? <div className="proof-pending"><Clock3 size={30} /><h3>{request.status === 'under_review' ? 'Proof under review' : request.status === 'verified' ? 'Payment verification recorded' : 'Proof submitted — pending review'}</h3><p>Your proof does not automatically activate the robot or credit a bonus.</p><dl><div><dt>Request ID</dt><dd>{request.id}</dd></div><div><dt>Payment method</dt><dd>{request.paymentMethod.name}</dd></div><div><dt>Screenshots</dt><dd>{request.files.length}</dd></div></dl>{request.reviewNote && <p className="payment-review-note">Admin note: {request.reviewNote}</p>}<button className="button primary" onClick={close}>Done</button></div> : <>
      <ol className="payment-steps"><li className={stage === 'instructions' ? 'current' : ''}>1. Instructions</li><li className={stage === 'proof' ? 'current' : ''}>2. Submit proof</li><li>3. Review</li></ol>
      {loading && <p className="muted" role="status">Loading admin instructions…</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && instructions && stage === 'instructions' && <>
        <h3>Choose a payment option</h3><div className="payment-methods">{instructions.methods.map(item => <button className={methodId === item.id ? 'selected' : ''} aria-pressed={methodId === item.id} disabled={!item.enabled || !instructions.intakeEnabled} key={item.id} onClick={() => setMethodId(item.id)}><ClipboardList size={17} /><span>{item.name}<small>{item.enabled && instructions.intakeEnabled ? 'View admin instructions' : 'Not configured'}</small></span></button>)}</div>
        {method && instructions.intakeEnabled ? <><div className="admin-payment-instructions"><h3>{method.name}</h3>{method.recipient && <dl><div><dt>{method.name === 'Binance TRC' ? 'Wallet address' : 'Payment recipient / code'}</dt><dd className="payment-recipient">{method.recipient}</dd></div>{method.accountName && <div><dt>Recipient name</dt><dd>{method.accountName}</dd></div>}{method.asset && <div><dt>Asset</dt><dd>{method.asset}</dd></div>}{method.network && <div><dt>Network</dt><dd>{method.network}</dd></div>}</dl>}<p>{method.instructions}</p><small>Instructions version {instructions.version}</small></div><button className="button primary payment-wide" onClick={() => setStage('proof')}>{isDemo ? 'Continue to payment proof' : 'I have paid — submit proof'}</button></> : <div className="payment-unconfigured"><LockKeyhole size={24} /><h3>Payment instructions are not published yet</h3><p>The admin must configure and enable a payment option before proof can be submitted.</p>{isDemo && <Link className="text-link" to="/admin/payments" onClick={close}>Open admin payment preview</Link>}</div>}
      </>}
      {!loading && instructions && stage === 'proof' && method && <form className="proof-form" onSubmit={submit}>
        <p>Submit proof for <strong>{method.name}</strong>. The robot stays inactive until payment verification.</p>
        {request?.status === 'rejected' && <p className="form-error">Previous proof rejected. {request.reviewNote}</p>}
        <label>Full names<input name="fullName" value={fullName} onChange={event => setFullName(event.target.value)} minLength={2} maxLength={120} autoComplete="name" required /></label>
        <label>Phone number<input name="phone" aria-label="Phone number" aria-describedby="proof-phone-help" value={phone} onChange={event => setPhone(event.target.value)} type="tel" placeholder="+25712345678" pattern="[+][1-9][0-9]{6,14}" autoComplete="tel" required /><small id="proof-phone-help">Include the country code.</small></label>
        <label>Transaction reference (optional)<input name="reference" maxLength={100} /></label>
        <label className="proof-upload"><ImagePlus size={22} /><span>Payment screenshots</span><small>1–3 PNG or JPEG images, up to 3 MB combined</small><input type="file" accept="image/png,image/jpeg" multiple onChange={event => void selectFiles(Array.from(event.target.files || []))} /></label>
        <div className="proof-thumbnails">{files.map((file, i) => <div key={`${file.name}-${i}`}><img src={urls[i]} alt={`Selected screenshot ${i + 1}`} /><span>{file.name}</span><button type="button" className="icon-button" aria-label={`Remove screenshot ${i + 1}`} onClick={() => setFiles(previous => previous.filter((_, index) => index !== i))}><X size={15} /></button></div>)}</div>
        <label className="check-label"><input type="checkbox" required /><span>I confirm these details match the proof and understand that submission is not payment verification.</span></label>
        <div className="payment-form-actions"><button className="button secondary" type="button" disabled={busy} onClick={() => setStage('instructions')}>Back</button><button className="button primary" disabled={busy || !files.length}>{busy ? 'Submitting…' : 'Submit payment proof'}</button></div>
      </form>}
    </>}
    <p className="payment-security"><CheckCircle2 size={14} />Proof submissions never credit a bonus automatically.</p>
  </div></Modal>
}
