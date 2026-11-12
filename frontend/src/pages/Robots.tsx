import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Bot, Check, CheckCircle2, Gift, Globe2, Lightbulb, RotateCcw, Search, ShieldCheck, TrendingUp, Wallet } from 'lucide-react'
import { RobotPlanIcon } from '../RobotPlanIcon'
import { hasRobotDashboard, normalizeCountry } from '../domain/countries'
import { formatRobotMoney, getRobotTerms, ROBOT_CATALOG, ROBOT_FX_REFERENCE, robotMarket, robotWallet, type Robot } from '../domain/robots'
import { useApp } from '../state'
import { ActivationPayment } from './ActivationPayment'
import { loadRequests } from '../lib/payments'
import type { PaymentAccess, PaymentRequest } from '../domain/payments'
import './Robots.css'
import { useMemberBalance } from '../useMemberBalance'
import { walletMoney } from '../domain/balances'
import { WalletWelcome } from '../WalletWelcome'

export function RobotsPage() {
  const { demo, session } = useApp()
  const country = demo?.country || session?.user.user_metadata.country
  return hasRobotDashboard(country) ? <RobotDashboard /> : <Navigate to="/dashboard" replace />
}

export function RobotDashboard() {
  const { demo, session, resetDemoRobots, t } = useApp()
  const country = normalizeCountry(demo?.country || session?.user.user_metadata.country)
  const name = demo?.name || session?.user.user_metadata.display_name || 'Member'
  const account = useMemberBalance()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Robot | null>(null)
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>([])
  const [paymentError, setPaymentError] = useState('')
  const demoId = demo?.id
  const token = session?.access_token
  const access = useMemo<PaymentAccess | null>(() => demoId ? { demoId } : token ? { accessToken: token } : null, [demoId, token])
  useEffect(() => {
    if (!access) return
    let active = true; let sequence = 0
    const refresh = () => {
      const current = ++sequence
      loadRequests(access).then(rows => { if (active && sequence === current) { setPaymentRequests(rows); setPaymentError('') } }).catch(err => { if (active && sequence === current) setPaymentError(err.message) })
    }
    const visible = () => { if (document.visibilityState === 'visible') refresh() }
    refresh()
    const timer = window.setInterval(visible, 30000)
    window.addEventListener('focus', refresh)
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh) }
  }, [access])
  const [resetNotice, setResetNotice] = useState(false)
  const market = robotMarket(country)
  const approved = paymentRequests.filter(row => row.country === country && row.status === 'verified')
  const ids = [...new Set([...(country ? demo?.robotIdsByCountry[country] || [] : []), ...approved.map(row => row.planId)])]
  const wallet = robotWallet(ids, country)
  const readyCount = ROBOT_CATALOG.filter(robot => getRobotTerms(robot.id, country)).length
  const money = (value: number) => formatRobotMoney(value, country)
  const visible = ROBOT_CATALOG.filter(robot => {
    const matchesSearch = `${robot.name} ${robot.number}`.toLowerCase().includes(search.trim().toLowerCase())
    return matchesSearch && (filter === 'all' || (filter === 'available' && !ids.includes(robot.id) && !paymentRequests.some(row => row.country === country && row.planId === robot.id && row.status !== 'rejected')) || (filter === 'active' && ids.includes(robot.id)))
  })
  return <div className="robot-workspace">
    <section className="wallet-hero robot-hero"><div className="wallet-top"><span className="hello-badge"><Lightbulb size={15} />{t('hello')}, {name}</span><span className="robot-region"><Globe2 size={14} />{country}</span></div><WalletWelcome /><div className="robot-hero-copy"><div><span className="robot-eyebrow">YOUR ROBOT WORKSPACE</span><h2>Find your next robotic plan.</h2><p>Explore 33 plans, their activation values and one-time bonuses.</p></div><Bot size={68} strokeWidth={1.2} /></div><div className="robot-hero-bottom"><span><CheckCircle2 size={14} />{readyCount} plans available</span><span><Gift size={14} />Activation follows payment verification</span></div></section>
    <div className="stat-grid robot-primary-cards" aria-label="Robot account summary">
      <section className="stat-card blue"><h2>Active Plans</h2><span className="stat-icon"><Bot size={24} strokeWidth={1.5} /></span><strong data-testid="active-robot-count">{wallet.active.length}<span className="stat-value-detail"> / 33</span></strong><button className="stat-card-link" onClick={() => { setFilter('active'); setSearch(''); document.getElementById('robot-catalogue')?.scrollIntoView({ block: 'start' }) }}>View active plans <ArrowRight size={12} /></button></section>
      <section className="stat-card green"><h2>Received Bonuses</h2><span className="stat-icon"><Gift size={24} strokeWidth={1.5} /></span><strong data-testid="robot-bonus">{account.wallet ? walletMoney(account.wallet.bonusMinor, account.wallet.currency) : account.error ? 'Unavailable' : 'Loading…'}</strong><small>Account bonuses · one-time</small></section>
      <section className="stat-card red"><h2>Total Activated Value</h2><span className="stat-icon"><TrendingUp size={24} strokeWidth={1.5} /></span><strong data-testid="robot-activated-value">{market.currency ? money(demo ? wallet.spent : approved.reduce((sum, row) => sum + row.quote.value, 0)) : 'Amounts pending'}</strong><small>Approved activation value</small></section>
      <section className="stat-card yellow"><h2>Available Funds</h2><span className="stat-icon"><Wallet size={24} strokeWidth={1.5} /></span><strong data-testid="robot-funds">{account.wallet ? walletMoney(account.wallet.availableMinor, account.wallet.currency) : account.error ? 'Unavailable' : 'Loading…'}</strong><small>Account balance</small></section>
    </div>
    <div className="notice robot-simulation-notice"><ShieldCheck size={20} /><p>Submit payment proof for admin review. Approval activates your robot and credits its listed one-time bonus. Trading remains simulation-only.</p></div>
    {account.error && <p className="form-error" role="alert">{account.error} <button className="text-link" onClick={account.refresh}>Retry balance</button></p>}
    {paymentError && <p className="form-error" role="alert">{paymentError}</p>}
    {resetNotice && <p className="form-success" role="status">Virtual plans reset for {country}. Virtual funding restored and bonuses cleared.</p>}
    <div className="robot-catalog-heading" id="robot-catalogue"><div><span className="eyebrow">AVAILABLE ROBOTS</span><h2>33 robotic plans</h2><p>{country} catalogue · {readyCount} plans · {market.currency === 'BIF' ? 'Fbu' : market.currency}</p></div><div>{readyCount > 0 && <button className="button secondary small" onClick={() => setFilter(filter === 'active' ? 'all' : 'active')}>{filter === 'active' ? 'Show all 33 plans' : 'Show active robots'}</button>}{demo && market.currency && <button className="text-link" onClick={() => { resetDemoRobots(); setResetNotice(true) }}><RotateCcw size={14} />Reset virtual plans</button>}</div></div>
    <div className="robot-config-note">{readyCount ? <p>All 33 plans are generated from the supplied Burundi range. Converted amounts use the same dated reference rates.</p> : <p>Plan values, bonuses and currency for {country} are awaiting configuration. No prices have been converted from another country.</p>}<div className="robot-config-links"><Link className="text-link" to="/dashboard/profile">Change selected country</Link>{market.currency !== 'BIF' && <a className="text-link" href={ROBOT_FX_REFERENCE.source} target="_blank" rel="noreferrer">FX reference: {ROBOT_FX_REFERENCE.date}</a>}</div></div>
    <div className="robot-toolbar"><div className="robot-search"><Search size={16} /><label className="sr-only" htmlFor="robot-search">Search robots</label><input id="robot-search" type="search" placeholder="Search by robot name or number…" value={search} onChange={e => setSearch(e.target.value)} /></div><label className="sr-only" htmlFor="robot-filter">Filter robots</label><select id="robot-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">All plans (33)</option><option value="available">Available to activate</option><option value="active">Active ({ids.length})</option></select><span>{visible.length} plans shown</span></div>
    <div className="robot-grid">{visible.map(robot => {
      const terms = getRobotTerms(robot.id, country)
      const active = ids.includes(robot.id)
      const request = paymentRequests.find(row => row.country === country && row.planId === robot.id)
      const pending = request && request.status !== 'rejected'
      return <article className={`robot-card panel ${active ? 'robot-active' : ''}`} key={robot.id} data-testid={robot.id} aria-labelledby={`title-${robot.id}`}>
        <div className="robot-card-top"><h3 id={`title-${robot.id}`}><RobotPlanIcon number={robot.number} color={robot.color} />{robot.name}</h3><span className={`pill ${active ? '' : terms ? 'indigo-pill' : 'neutral-pill'}`}>{active ? <><Check size={12} />Active</> : pending ? 'Proof pending' : terms ? 'Available' : 'Awaiting values'}</span></div>
        <dl className="robot-price"><dt>Robot value</dt><dd>{terms ? money(terms.value) : 'To be supplied'}</dd></dl>
        <div className={`robot-bonus-box ${terms ? '' : 'robot-bonus-pending'}`}><Gift size={21} /><dl><dt>One-time activation bonus</dt><dd>{terms ? `+${money(terms.bonus)}` : 'To be supplied'}</dd></dl></div>
        <p className="robot-card-note">{request?.status === 'verified' ? 'Payment approved. One-time bonus credited.' : active ? 'Virtual bonus recorded. Already active.' : pending ? 'Proof submitted. Awaiting admin review.' : !terms ? 'Plan details pending.' : 'View instructions and submit your proof in one form.'}</p>
        <button className={`button ${active || pending ? 'secondary' : 'primary'}`} aria-label={request?.status === 'verified' ? `View ${robot.name} approval` : active ? `${robot.name} already active` : pending ? `View ${robot.name} payment request` : `Activate ${robot.name}`} disabled={!terms || (active && request?.status !== 'verified') || !access} onClick={() => { setSelected(robot); setResetNotice(false) }}>{request?.status === 'verified' ? 'View approval' : active ? <><CheckCircle2 size={16} />Activated</> : pending ? 'View payment request' : !terms ? 'Awaiting plan details' : request?.status === 'rejected' ? 'Resubmit payment proof' : 'Activate robot'}</button>
      </article>
    })}</div>
    {visible.length === 0 && <div className="robot-empty panel"><Bot size={30} /><h3>No matching robots</h3><p>Try another number or change the filter.</p><button className="text-link" onClick={() => { setFilter('all'); setSearch('') }}>Show all 33 plans</button></div>}
    {selected && country && access && <ActivationPayment robot={selected} country={country} access={access} request={paymentRequests.find(row => row.country === country && row.planId === selected.id)} close={() => setSelected(null)} submitted={row => setPaymentRequests(previous => [row, ...previous.filter(item => item.id !== row.id)])} />}
  </div>
}
