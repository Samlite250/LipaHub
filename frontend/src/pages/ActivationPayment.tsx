import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ClipboardList, Clock3, Copy, ImagePlus, LockKeyhole, X } from 'lucide-react'
import { Modal } from '../components'
import type { Country } from '../domain/countries'
import { formatRobotAmount, formatRobotMoney, getRobotTerms, type Robot } from '../domain/robots'
import { validateProofImages, type PaymentAccess, type PaymentInstructions, type PaymentRequest } from '../domain/payments'
import { loadInstructions, submitProof } from '../lib/payments'
import { useApp } from '../state'
import './Payments.css'

async function copyText(value: string) {
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return }
  const area = document.createElement('textarea')
  area.value = value; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0'
  document.body.appendChild(area); area.select()
  const ok = document.execCommand('copy'); area.remove()
  if (!ok) throw new Error('copy failed')
}

export function ActivationPayment({ robot, country, access, request, close, submitted }: { robot: Robot; country: Country; access: PaymentAccess; request?: PaymentRequest; close: () => void; submitted: (row: PaymentRequest) => void }) {
  const { demo, session, t } = useApp()
  const [instructions, setInstructions] = useState<PaymentInstructions | null>(null)
  const [methodId, setMethodId] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [urls, setUrls] = useState<string[]>([])
  const [copied, setCopied] = useState('')
  const [copyError, setCopyError] = useState('')
  const [fullName, setFullName] = useState(demo?.name || session?.user.user_metadata.display_name || '')
  const [phone, setPhone] = useState(session?.user.user_metadata.phone || '')
  const isDemo = 'demoId' in access
  const terms = getRobotTerms(robot.id, country)!
  const amountValue = request?.quote.value ?? terms.value
  const amount = formatRobotMoney(amountValue, country)
  const method = instructions?.methods.find(item => item.id === methodId && item.enabled)
  const ready = !!method && instructions?.intakeEnabled === true
  async function copy(field: string, value: string) {
    try {
      await copyText(value)
      setCopyError(''); setCopied(field)
      window.setTimeout(() => setCopied(current => current === field ? '' : current), 2000)
    } catch {
      setCopied(''); setCopyError(field)
      window.setTimeout(() => setCopyError(current => current === field ? '' : current), 2000)
    }
  }
  const copyLabel = (field: string, fallback: string) => copied === field ? t('copied') : copyError === field ? t('copyFailed') : fallback
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
    if (!instructions || !ready) { setError(t('instructionsUnavailable')); return }
    setBusy(true)
    try {
      submitted(await submitProof(access, { country, planId: robot.id, methodId, instructionVersion: instructions.version, fullName, phone, transactionReference: '', files }))
    } catch (err) { setError(err instanceof Error ? err.message : 'Submission failed. Check your request history before retrying.') }
    finally { setBusy(false) }
  }
  const pending = request && request.status !== 'rejected'
  const approved = request?.status === 'verified'
  return <Modal title={`${robot.name} ${t('activationSuffix')}`} close={close}><div className="activation-payment compact-payment">
    <header className="pay-header"><span className="pay-wordmark">LipaHub<span>.</span></span></header>
    {isDemo && <p className="payment-preview-note">{t('practiceModeNotice')}</p>}
    {pending ? <div className="proof-pending">{approved ? <CheckCircle2 size={30} /> : <Clock3 size={30} />}<h3>{approved ? t('paymentApprovedTitle') : request.status === 'under_review' ? t('proofUnderReviewTitle') : t('proofSubmittedTitle')}</h3>
      <p>{approved ? `${t('bonusCreditedPrefix')} ${formatRobotMoney(request.quote.bonus, country)} ${t('bonusCreditedSuffix')}` : t('adminWillCheck')}</p>
      <dl><div><dt>{t('requestId')}</dt><dd>{request.id}</dd></div><div><dt>{t('paymentMethod')}</dt><dd>{request.paymentMethod.name}</dd></div><div><dt>{t('screenshotsLabel')}</dt><dd>{request.files.length}</dd></div></dl>
      {request.reviewNote && <p className="payment-review-note">{t('adminNote')}: {request.reviewNote}</p>}<button className="button primary" onClick={close}>{t('done')}</button>
    </div> : <>
      {loading && <p className="muted" role="status">{t('loadingInstructions')}</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && instructions && <>
        {request?.status === 'rejected' && <p className="payment-review-note">{t('previousRejectedPrefix')} {request.reviewNote}{t('previousRejectedSuffix')}</p>}
        <div className="payment-methods">{instructions.methods.map(item => <button type="button" className={methodId === item.id ? 'selected' : ''} aria-pressed={methodId === item.id} disabled={!item.enabled || !instructions.intakeEnabled || busy} key={item.id} onClick={() => setMethodId(item.id)}><ClipboardList size={15} /><span>{item.name}<small>{item.enabled && instructions.intakeEnabled ? t('viewAdminInstructions') : t('notConfigured')}</small></span></button>)}</div>
        {ready && method ? <form className="proof-form" onSubmit={submit}>
          <div className="admin-payment-instructions"><div className="pay-details-head"><span>{t('paymentDetails')}</span><small>{method.name}</small></div>
            <div className="payment-plan-summary"><div className="pay-head"><span>{country} · {t('amountToPay')}</span><div><strong>{amount}</strong><small>+{formatRobotMoney(request?.quote.bonus ?? terms.bonus, country)} {t('oneTimeBonus')}</small></div></div><button type="button" className={copied === 'amount' ? 'quick-copy done' : 'quick-copy'} aria-label={copyLabel('amount', t('copyAmount'))} title={copyLabel('amount', t('copyAmount'))} onClick={() => void copy('amount', formatRobotAmount(amountValue, country))}>{copied === 'amount' ? <CheckCircle2 size={15} /> : <Copy size={15} />}</button></div>
            <dl>
            {method.recipient && <div><dt>{method.name === 'Binance TRC' ? t('walletAddress') : t('paymentRecipient')}</dt><dd className="payment-recipient">{method.recipient}</dd><button type="button" className={copied === 'recipient' ? 'quick-copy done' : 'quick-copy'} aria-label={copyLabel('recipient', method.name === 'Binance TRC' ? t('copyAddress') : t('copyNumber'))} title={copyLabel('recipient', method.name === 'Binance TRC' ? t('copyAddress') : t('copyNumber'))} onClick={() => void copy('recipient', method.recipient)}>{copied === 'recipient' ? <CheckCircle2 size={14} /> : <Copy size={14} />}</button></div>}
            {method.accountName && <div><dt>{t('recipientName')}</dt><dd>{method.accountName}</dd></div>}
            {method.asset && <div><dt>{t('assetLabel')}</dt><dd>{method.asset}</dd></div>}{method.network && <div><dt>{t('networkLabel')}</dt><dd>{method.network}</dd></div>}
          </dl>{method.instructions && <p>{method.instructions}</p>}</div>
          <label className="proof-upload compact-upload"><ImagePlus size={18} /><span>{files.length ? `${files.length} ${t('screenshotsLabel')}` : t('uploadYourScreenshot')}</span><small>{t('screenshotsHelp')}</small><input type="file" accept="image/png,image/jpeg" multiple disabled={busy} onChange={event => void selectFiles(Array.from(event.target.files || []))} /></label>
          {files.length > 0 && <div className="proof-thumbnails">{files.map((file, i) => <div key={`${file.name}-${i}`}><img src={urls[i]} alt={`${t('selectedScreenshot')} ${i + 1}`} /><span>{file.name}</span><button type="button" className="icon-button" disabled={busy} aria-label={`${t('removeScreenshot')} ${i + 1}`} onClick={() => setFiles(previous => previous.filter((_, index) => index !== i))}><X size={15} /></button></div>)}</div>}
          <div className="proof-contact-fields">
            <input name="fullName" aria-label={t('fullNames')} placeholder={t('fullNames')} value={fullName} onChange={event => setFullName(event.target.value)} minLength={2} maxLength={120} autoComplete="name" disabled={busy} required />
            <input name="phone" aria-label="Phone number" placeholder={`+257 79 000 0000 · ${t('includeCountryCode')}`} value={phone} onChange={event => setPhone(event.target.value)} type="tel" pattern="[+][1-9][0-9]{6,14}" autoComplete="tel" disabled={busy} required />
          </div>
          <label className="check-label"><input type="checkbox" disabled={busy} required /><span>{t('confirmDetails')}</span></label>
          <button className="button primary payment-wide" disabled={busy || !files.length}>{busy ? t('submitting') : t('submitPaymentProof')}</button>
        </form> : <div className="payment-unconfigured"><LockKeyhole size={24} /><h3>{t('notPublishedTitle')}</h3><p>{t('notPublishedBody')}</p>{isDemo && <Link className="text-link" to="/admin/payments" onClick={close}>{t('openAdminWorkspace')}</Link>}</div>}
      </>}
    </>}
  </div></Modal>
}
