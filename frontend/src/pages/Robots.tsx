import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Bot, Check, CheckCircle2, Gift, Globe2, Lightbulb, RotateCcw, Search, TrendingUp, Wallet } from 'lucide-react'
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
    <section className="wallet-hero robot-hero"><div className="wallet-top"><span className="hello-badge"><Lightbulb size={15} />{t('hello')}, {name}</span><span className="robot-region"><Globe2 size={14} />{country}</span></div><WalletWelcome /><div className="robot-hero-copy"><div><span className="robot-eyebrow">{t('robotWorkspace')}</span><h2>{t('robotHeroTitle')}</h2><p>{t('robotHeroSubtitle')}</p></div><Bot size={68} strokeWidth={1.2} /></div><div className="robot-hero-bottom"><span><CheckCircle2 size={14} />{readyCount} {t('plansAvailable')}</span><span><Gift size={14} />{t('activationFollowsPayment')}</span></div></section>
    <div className="stat-grid robot-primary-cards" aria-label="Robot account summary">
      <section className="stat-card blue"><h2>{t('activePlans')}</h2><span className="stat-icon"><Bot size={24} strokeWidth={1.5} /></span><strong data-testid="active-robot-count">{wallet.active.length}<span className="stat-value-detail"> / 33</span></strong><button className="stat-card-link" onClick={() => { setFilter('active'); setSearch(''); document.getElementById('robot-catalogue')?.scrollIntoView({ block: 'start' }) }}>{t('viewActivePlans')} <ArrowRight size={12} /></button></section>
      <section className="stat-card green"><h2>{t('receivedBonuses')}</h2><span className="stat-icon"><Gift size={24} strokeWidth={1.5} /></span><strong data-testid="robot-bonus">{account.wallet ? walletMoney(account.wallet.bonusMinor, account.wallet.currency) : account.error ? t('unavailable') : t('loadingText')}</strong><small>{t('accountBonusesOnce')}</small></section>
      <section className="stat-card red"><h2>{t('totalActivatedValue')}</h2><span className="stat-icon"><TrendingUp size={24} strokeWidth={1.5} /></span><strong data-testid="robot-activated-value">{market.currency ? money(demo ? wallet.spent : approved.reduce((sum, row) => sum + row.quote.value, 0)) : t('unavailable')}</strong><small>{t('approvedActivationValue')}</small></section>
      <section className="stat-card yellow"><h2>{t('availableFunds')}</h2><span className="stat-icon"><Wallet size={24} strokeWidth={1.5} /></span><strong data-testid="robot-funds">{account.wallet ? walletMoney(account.wallet.availableMinor, account.wallet.currency) : account.error ? t('unavailable') : t('loadingText')}</strong><small>{t('accountBalance')}</small></section>
    </div>
    {account.error && <p className="form-error" role="alert">{account.error} <button className="text-link" onClick={account.refresh}>{t('retryBalance')}</button></p>}
    {paymentError && <p className="form-error" role="alert">{paymentError}</p>}
    {resetNotice && <p className="form-success" role="status">{t('practiceResetPrefix')} {country}{t('practiceResetSuffix')}</p>}
    <div className="robot-catalog-heading" id="robot-catalogue"><div><span className="eyebrow">{t('availableRobots')}</span><h2>{t('roboticPlans33')}</h2><p>{country} {t('catalogue')} · {readyCount} {t('plansWord')} · {market.currency === 'BIF' ? 'Fbu' : market.currency}</p></div><div>{readyCount > 0 && <button className="button secondary small" onClick={() => setFilter(filter === 'active' ? 'all' : 'active')}>{filter === 'active' ? t('showAll33') : t('showActiveRobots')}</button>}{demo && market.currency && <button className="text-link" onClick={() => { resetDemoRobots(); setResetNotice(true) }}><RotateCcw size={14} />{t('resetPracticePlans')}</button>}</div></div>
    <div className="robot-config-note">{readyCount ? <p>{t('configNoteLinear')}</p> : <p>{t('configNotePendingPrefix')} {country} {t('configNotePendingSuffix')}</p>}<div className="robot-config-links"><Link className="text-link" to="/dashboard/profile">{t('changeSelectedCountry')}</Link>{market.currency !== 'BIF' && <a className="text-link" href={ROBOT_FX_REFERENCE.source} target="_blank" rel="noreferrer">{t('fxReference')}: {ROBOT_FX_REFERENCE.date}</a>}</div></div>
    <div className="robot-toolbar"><div className="robot-search"><Search size={16} /><label className="sr-only" htmlFor="robot-search">Search robots</label><input id="robot-search" type="search" placeholder={t('searchRobotsPlaceholder')} value={search} onChange={e => setSearch(e.target.value)} /></div><label className="sr-only" htmlFor="robot-filter">Filter robots</label><select id="robot-filter" value={filter} onChange={e => setFilter(e.target.value)}><option value="all">{t('allPlans33')}</option><option value="available">{t('availableToActivate')}</option><option value="active">{t('activeWord')} ({ids.length})</option></select><span>{visible.length} {t('plansShown')}</span></div>
    <div className="robot-grid">{visible.map(robot => {
      const terms = getRobotTerms(robot.id, country)
      const active = ids.includes(robot.id)
      const request = paymentRequests.find(row => row.country === country && row.planId === robot.id)
      const pending = request && request.status !== 'rejected'
      return <article className={`robot-card panel ${active ? 'robot-active' : ''}`} key={robot.id} data-testid={robot.id} aria-labelledby={`title-${robot.id}`}>
        <div className="robot-card-top"><h3 id={`title-${robot.id}`}><RobotPlanIcon number={robot.number} color={robot.color} />{robot.name}</h3><span className={`pill ${active ? '' : terms ? 'indigo-pill' : 'neutral-pill'}`}>{active ? <><Check size={12} />{t('statusActive')}</> : pending ? t('statusProofPending') : terms ? t('statusAvailable') : t('statusAwaitingValues')}</span></div>
        <dl className="robot-price"><dt>{t('robotValue')}</dt><dd>{terms ? money(terms.value) : t('toBeSupplied')}</dd></dl>
        <div className={`robot-bonus-box ${terms ? '' : 'robot-bonus-pending'}`}><Gift size={21} /><dl><dt>{t('oneTimeActivationBonus')}</dt><dd>{terms ? `+${money(terms.bonus)}` : t('toBeSupplied')}</dd></dl></div>
        <p className="robot-card-note">{request?.status === 'verified' ? t('robotCardApproved') : active ? t('robotCardActive') : pending ? t('robotCardPending') : !terms ? t('robotCardComingSoon') : t('robotCardReady')}</p>
        <button className={`button ${active || pending ? 'secondary' : 'primary'}`} aria-label={request?.status === 'verified' ? `View ${robot.name} approval` : active ? `${robot.name} already active` : pending ? `View ${robot.name} payment request` : `Activate ${robot.name}`} disabled={!terms || (active && request?.status !== 'verified') || !access} onClick={() => { setSelected(robot); setResetNotice(false) }}>{request?.status === 'verified' ? t('viewApproval') : active ? <><CheckCircle2 size={16} />{t('activatedLabel')}</> : pending ? t('viewPaymentRequest') : !terms ? t('awaitingPlanDetails') : request?.status === 'rejected' ? t('resubmitPaymentProof') : t('activateRobot')}</button>
      </article>
    })}</div>
    {visible.length === 0 && <div className="robot-empty panel"><Bot size={30} /><h3>{t('noMatchingRobots')}</h3><p>{t('noMatchingHint')}</p><button className="text-link" onClick={() => { setFilter('all'); setSearch('') }}>{t('showAll33')}</button></div>}
    {selected && country && access && <ActivationPayment robot={selected} country={country} access={access} request={paymentRequests.find(row => row.country === country && row.planId === selected.id)} close={() => setSelected(null)} submitted={row => setPaymentRequests(previous => [row, ...previous.filter(item => item.id !== row.id)])} />}
  </div>
}
