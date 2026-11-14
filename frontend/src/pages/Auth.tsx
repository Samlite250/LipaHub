import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, EyeOff, ShieldCheck } from 'lucide-react'
import { Languages, Logo } from '../components'
import { useApp } from '../state'
import { supabase } from '../lib/supabase'
import { demoEnabled } from '../lib/platform'
import { normalizeCountry } from '../domain/countries'
import IntlTelInput, { intlTelInput, type IntlTelInputRef } from '@intl-tel-input/react'
import 'intl-tel-input/styles'
import { CountrySelect } from '../CountrySelect'
import { accountDestination } from '../lib/auth-navigation'
import { InvitationBanner } from '../Invitation'
import { useInvitation } from '../lib/use-invitation'
import { clearInvitation } from '../lib/invitations'

type Mode = 'login' | 'register' | 'forgot'
export function AuthPage({ mode }: { mode: Mode }) {
  const { t, startDemo, language, session } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [visible, setVisible] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [country, setCountry] = useState('Rwanda')
  const telephone = useRef<IntlTelInputRef>(null)
  useEffect(() => {
    if (country === 'International') return
    const selection = intlTelInput.getAllCountries().find(item => normalizeCountry(item.iso2) === country)
    if (selection) telephone.current?.getInstance()?.setSelectedCountry(selection.iso2)
  }, [country])
  function centerCallingCode() {
    const list = telephone.current?.getInput()?.closest('.iti')?.querySelector<HTMLElement>('.iti__country-list')
    const selected = list?.querySelector<HTMLElement>('[aria-selected=true]')
    if (list && selected) list.scrollTop = selected.offsetTop - list.offsetTop - 64
  }
  const isRegister = mode === 'register'
  const invitation = useInvitation(isRegister)
  const isForgot = mode === 'forgot'
  const requestedDestination: unknown = location.state?.from
  const destination = accountDestination(null, requestedDestination)
  useEffect(() => {
    if (mode === 'login' && session) navigate(accountDestination(session.user, requestedDestination), { replace: true })
  }, [mode, session, requestedDestination, navigate])
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(''); setMessage('')
    const fields = new FormData(e.currentTarget)
    if (isRegister && fields.get('password') !== fields.get('confirm')) { setError('Passwords must match.'); return }
    if (!supabase) { setError(demoEnabled ? 'Account sign-in is temporarily unavailable. Open the practice workspace to continue.' : 'Account sign-in is temporarily unavailable. Please try again shortly or contact support.'); return }
    setBusy(true)
    try {
      const email = String(fields.get('email')).trim()
      if (isForgot) {
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset-password` })
        if (error) throw error
        setMessage('If an account exists for this email, a password reset link will arrive shortly.')
      } else if (isRegister) {
        if (invitation.reference && !invitation.inviter && !invitation.error) throw new Error(language === 'rw' ? 'Tegereza ko ubutumire bugenzurwa.' : 'Please wait while we check your invitation.')
        await telephone.current?.getInstance()?.promise
        const phone = telephone.current?.getInstance()?.getNumber() || ''
        if (!/^\+[1-9]\d{6,14}$/.test(phone)) throw new Error('Enter a complete telephone number for the selected calling code.')
        const { data, error } = await supabase.auth.signUp({ email, password: String(fields.get('password')),
          options: { emailRedirectTo: `${window.location.origin}/dashboard`, data: { username: String(fields.get('username')).trim(), display_name: String(fields.get('username')).trim(), phone, country, ...(invitation.reference ? { invitation_reference: invitation.reference } : {}), ...(invitation.inviter ? { invited_by: invitation.inviter.id, invited_by_username: invitation.inviter.username || invitation.inviter.name } : {}) } } })
        if (error) throw error
        if (data.session) { clearInvitation(); navigate(country === 'Rwanda' && data.session.user.app_metadata.role !== 'admin' ? '/activate-account' : accountDestination(data.session.user, requestedDestination), { replace: true }) }
        else setMessage('Sign in to access your dashboard. If you already have an account, use your existing password.')
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password: String(fields.get('password')) })
        if (error) throw error
        navigate(accountDestination(data.user, requestedDestination), { replace: true })
      }
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to connect. Please try again.') }
    finally { setBusy(false) }
  }
  return <main className={`auth-page ${isRegister ? 'registration' : ''}`} key={mode}>
    <Link className="back-home" to="/"><ArrowLeft size={15} /> LipaHub home</Link>
    <div className="auth-wrap">
      {isRegister ? <section className="registration-promo"><Logo /><h2>Learn, connect and discover something new.</h2><p>Learning and community, in one place.</p></section> : <Logo />}
      <section className="auth-card">
        {isRegister && <Languages />}
        <h1>{isRegister ? t('create') : isForgot ? t('reset') : t('signin')}</h1>
        <p className="auth-subtitle">{isRegister ? t('createSub') : isForgot ? t('resetSub') : t('welcome')}</p>
        {isRegister && <InvitationBanner invitation={invitation} />}
        <form onSubmit={submit} key={mode}>
          {isRegister && <>
            <label>{t('username')} <em>*</em><input name="username" placeholder={t('username')} autoComplete="nickname" minLength={2} maxLength={40} required /></label>
            <div className="registration-telephone"><label htmlFor="registration-phone">{t('phone')} <em>*</em></label>
              <IntlTelInput ref={telephone} initialCountry="rw" separateDialCode countrySelectorMode="DROPDOWN" countrySearch
                uiTranslations={{ selectedCountryAriaLabel: 'Calling code: ${countryName} (${dialCode})', searchPlaceholder: 'Search countries'  }} countryNameOverrides={{ cd: 'DR Congo' }} matchDropdownWidth onOpenCountrySelector={centerCallingCode} loadUtils={() => import('intl-tel-input/utils')} placeholderNumberPolicy="OFF"
                formatAsYouType={false}
                inputProps={{ id: 'registration-phone', name: 'phone', autoComplete: 'tel-national', placeholder: language === 'rw' ? 'Shyiramo nimero' : 'Phone number', required: true, maxLength: 24 }} />
            </div>
          </>}
          <label>{t('email')}{isRegister && <em> *</em>}<input name="email" type="email" placeholder="you@example.com" autoComplete="email" required /></label>
          {!isForgot && <>
            <label><span className="label-row"><span>{t('password')}{isRegister && <em> *</em>}</span>{!isRegister && <Link to="/forgot-password">{t('forgot')}</Link>}</span>
              <span className="password-field"><input aria-label={t('password')} name="password" type={visible ? 'text' : 'password'} placeholder={t('password')} minLength={isRegister ? 8 : undefined} autoComplete={isRegister ? 'new-password' : 'current-password'} required /><button type="button" aria-label={visible ? 'Hide password' : 'Show password'} onClick={() => setVisible(!visible)}>{visible ? <EyeOff size={15} /> : <Eye size={15} />}</button></span>
            </label>
            {isRegister && <label>{t('confirm')} <em>*</em><input name="confirm" type={visible ? 'text' : 'password'} placeholder={t('confirm')} minLength={8} autoComplete="new-password" required /></label>}
          </>}
          {isRegister && <>
            <CountrySelect label={t('country')} value={country} onChange={setCountry} required />
            {invitation.inviter && <label>Invited by<input value={invitation.inviter.name} readOnly /></label>}
            <label className="check-label"><input type="checkbox" name="terms" required /><span>{t('agree')} <Link to="/terms">{t('terms')}</Link> {t('and')} <Link to="/privacy">{t('privacy')}</Link>.</span></label>
          </>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {message && <p className="form-success" role="status">{message}</p>}
          <button className="button primary auth-submit" disabled={busy}>{busy ? 'Please wait…' : isRegister ? t('signup') : isForgot ? t('send') : t('signin')}</button>
        </form>
        <p className="auth-bottom">{isForgot ? <Link to="/login">{t('back')}</Link> : <>{isRegister ? t('hasAccount') : t('noAccount')} <Link to={isRegister ? '/login' : '/register'}>{isRegister ? t('signin') : t('signup')}</Link></>}</p>
      </section>
      {demoEnabled && <button className="demo-link" onClick={() => { startDemo(isRegister ? country : undefined); navigate(destination) }}>{t('demoEnter')} <ArrowRight size={14} /></button>}
      {!isRegister && <Languages />}
      <p className="auth-footnote"><ShieldCheck size={13} /> {demoEnabled ? 'Practice workspace · Local practice data' : 'Private accounts · Secure sign-in'}</p>
    </div>
  </main>
}

export function ResetPassword() {
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const { session, loading } = useApp()
  const navigate = useNavigate()
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError('')
    const fields = new FormData(e.currentTarget)
    if (fields.get('password') !== fields.get('confirm')) { setError('Passwords must match.'); return }
    if (!supabase || !session) { setError('Open a valid password reset link from your email first.'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: String(fields.get('password')) })
    setBusy(false)
    if (error) setError(error.message)
    else navigate(accountDestination(session.user), { replace: true })
  }
  return <main className="auth-page"><div className="auth-wrap"><Logo /><section className="auth-card"><h1>Choose a new password</h1><p className="auth-subtitle">Use at least 8 characters.</p><form onSubmit={submit}><label>New password<input name="password" type="password" minLength={8} autoComplete="new-password" required /></label><label>Confirm password<input name="confirm" type="password" minLength={8} autoComplete="new-password" required /></label>{error && <p className="form-error" role="alert">{error}</p>}<button className="button primary" disabled={busy || loading}>{busy ? 'Saving…' : 'Save password'}</button></form><Link className="text-link" to="/forgot-password">Request a new reset link</Link></section></div></main>
}
