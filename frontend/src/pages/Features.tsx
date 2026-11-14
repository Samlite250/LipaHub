import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Bot, Clock3, FlaskConical, MessageCircle, Play, RotateCcw, Send, ShieldCheck } from 'lucide-react'
import { Logo, Panel } from '../components'
import { allNavigation } from '../navigation'
import { useApp } from '../state'
import { supabase } from '../lib/supabase'
import { CountrySelect } from '../CountrySelect'
import { normalizeCountry } from '../domain/countries'

export function FeaturePage({ kind }: { kind: 'trading' | 'chat' }) {
  return kind === 'trading' ? <Trading /> : <Chat />
}
// Deliberately fixed educational scenarios. No market feed, orders, deposits or balance credits.
const scenario = [100, 101.2, 99.8, 98.4, 100.1, 102.6, 101.4, 103, 100.9, 98.8, 99.4, 100.6]
function Trading() {
  const [step, setStep] = useState(0)
  const [strategy, setStrategy] = useState('hold')
  const [history, setHistory] = useState<number[]>([1000])
  const balance = history[history.length - 1]
  const finished = step === scenario.length - 1
  function advance() {
    if (finished) return
    const exposure = strategy === 'hold' ? 1 : .3
    const next = balance * (1 + exposure * (scenario[step + 1] / scenario[step] - 1))
    setHistory([...history, next]); setStep(step + 1)
  }
  function reset() { setStep(0); setHistory([1000]) }
  return <><div className="feature-intro"><span className="feature-large-icon indigo"><Bot size={32} /></span><div><span className="eyebrow">EXPLORE & LEARN</span><h2>Crypto Robotic Trading</h2><p>Understand a strategy before putting it into practice.</p></div><span className="pill indigo-pill">Simulation only</span></div><div className="notice"><FlaskConical size={20} /><p>This educational sandbox uses a fixed illustrative price scenario and virtual units. It cannot place trades or move real funds. Results do not predict future performance.</p></div><div className="simulation-grid"><Panel title="Your simulation"><div className="simulation-body"><label>Illustrative strategy<select value={strategy} disabled={step > 0} onChange={e => setStrategy(e.target.value)}><option value="hold">Full market exposure</option><option value="cautious">30% market exposure</option></select></label><div className="sim-balance"><small>Virtual portfolio · not withdrawable</small><strong>{balance.toFixed(2)} <span>units</span></strong><span className={balance >= 1000 ? 'positive' : 'negative'}>{balance >= 1000 ? '+' : ''}{((balance / 1000 - 1) * 100).toFixed(2)}% in this scenario</span></div><svg className="simulation-chart" viewBox="0 0 600 180" role="img" aria-label={`Illustrative portfolio over ${step + 1} steps, currently ${balance.toFixed(2)} virtual units`}><line x1="15" x2="585" y1="100" y2="100" stroke="var(--line)" strokeDasharray="5 5" /><polyline points={history.map((value, i) => `${15 + i * 51},${100 - (value - 1000) * 1.8}`).join(' ')} fill="none" stroke="#14b8a6" strokeWidth="3" />{history.map((value, i) => <circle key={i} cx={15 + i * 51} cy={100 - (value - 1000) * 1.8} r="4" fill="#14b8a6" />)}</svg><div className="simulation-controls"><button className="button primary" onClick={advance} disabled={finished}><Play size={15} />{finished ? 'Scenario complete' : 'Simulate next step'}</button><button className="button secondary" onClick={reset}><RotateCcw size={15} />Reset</button><span>Step {step} / {scenario.length - 1}</span></div></div></Panel><Panel title="How to read this"><div className="document-body"><h3>Start with 1,000 virtual units</h3><p>Each step advances the same illustrative market scenario. Full exposure follows the price movement; the cautious strategy keeps 70% unexposed.</p><h3>Observe both directions</h3><p>Prices can rise or fall. Reducing exposure can reduce losses and gains. Reset to compare strategies against the same sequence.</p><h3>Real-world limits</h3><p>This simple model excludes fees, slippage, liquidity and execution delays. Live bot integrations and risk controls are being prepared.</p><span className="pill amber-pill"><ShieldCheck size={13} /> Live trading disabled</span></div></Panel></div></>
}
function Chat() {
  const [messages, setMessages] = useState<string[]>([])
  const [text, setText] = useState('')
  const { demo, session } = useApp()
  const name = demo?.name || session?.user.user_metadata.display_name || 'You'
  function send(e: FormEvent) { e.preventDefault(); if (text.trim()) { setMessages([...messages, text.trim()]); setText('') } }
  return <><div className="feature-intro"><span className="feature-large-icon pink"><MessageCircle size={32} /></span><div><span className="eyebrow">CONNECT & DISCOVER</span><h2>Chat & Earn</h2><p>Good conversations can open up a whole new world.</p></div><span className="pill">Community</span></div><div className="notice"><ShieldCheck size={20} /><p>This community lounge is being prepared. Messages are not delivered to other people and disappear when you leave. Rewards are disabled while eligibility, moderation and anti-abuse checks are finalized.</p></div><div className="simulation-grid"><Panel title="Community lounge" action={<span className="pill neutral-pill">Community room</span>}><div className="chat-messages" aria-live="polite" aria-label="Chat messages"><div className="chat-system"><MessageCircle size={28} /><h3>A space for a new perspective.</h3><p>Try the message composer below. Live participant matching is coming soon.</p></div>{messages.map((message, i) => <div className="chat-message" key={i}><span className="avatar small-avatar">{name.charAt(0)}</span><div><strong>{name} <small>Community</small></strong><p>{message}</p></div></div>)}</div><form className="chat-composer" onSubmit={send}><label className="sr-only" htmlFor="chat-message">Your message</label><input id="chat-message" value={text} onChange={e => setText(e.target.value)} maxLength={500} placeholder="Write a message…" autoComplete="off" required /><button className="button primary" disabled={!text.trim()} aria-label="Send message"><Send size={18} /></button></form></Panel><Panel title="A thoughtful community"><div className="document-body"><h3>Be curious. Be kind.</h3><p>Respect people’s backgrounds and boundaries. Never share passwords, payment details or other sensitive information.</p><h3>Rewards need real checks</h3><p>Sending messages does not create earnings yet. Future rewards will require verified eligibility and anti-abuse controls.</p><h3>What’s next</h3><p>Live rooms, reporting, moderation and reward rules are coming in future updates.</p></div></Panel></div></>
}
export function ProfilePage() {
  const { demo, updateDemo, session } = useApp()
  const [name, setName] = useState(demo?.name || session?.user.user_metadata.display_name || '')
  const [country, setCountry] = useState(normalizeCountry(demo?.country || session?.user.user_metadata.country) || 'Rwanda')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  async function save(e: FormEvent) {
    e.preventDefault(); setStatus(''); setError(''); setBusy(true)
    try {
      if (!name.trim()) throw new Error('Please enter a display name.')
      if (demo) updateDemo({ name: name.trim(), country })
      else if (supabase) { const { error } = await supabase.auth.updateUser({ data: { display_name: name.trim(), country } }); if (error) throw error }
      setStatus(demo ? 'Profile saved for this browser session.' : 'Profile saved.')
    } catch (err) { setError(err instanceof Error ? err.message : 'Unable to save.') }
    finally { setBusy(false) }
  }
  return <Panel title="Your profile" className="profile-panel"><form className="profile-form" onSubmit={save}><span className="avatar profile-avatar">{(name || 'M').charAt(0)}</span><p className="muted">A little about you, in your own words.</p><label>Display name<input value={name} onChange={e => setName(e.target.value)} minLength={2} maxLength={40} required autoComplete="nickname" /></label><CountrySelect label="Country" value={country} onChange={setCountry} />{!demo && <label>Email<input value={session?.user.email || ''} readOnly /></label>}{error && <p className="form-error" role="alert">{error}</p>}{status && <p className="form-success" role="status">{status}</p>}<button className="button primary" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button>{!demo && <Link className="text-link" to="/forgot-password">Request password reset <ArrowRight size={14} /></Link>}</form></Panel>
}

const descriptions: Record<string, string> = {
  deposit: 'Provider-backed deposits, verified payment events and reconciliation are coming soon. No payment details or funds are accepted yet.',
  withdraw: 'Withdrawal requests will require a verified account, an available ledger balance and a trusted payout provider. Withdrawals are not live yet.',
  voucher: 'Voucher purchasing, redemption and history are coming soon. No codes are generated or sold yet.',
  'pay-for-client': 'Client payment workflows will be added after verified payment providers and server-side authorization are integrated.',
  ranks: 'Rankings and reward eligibility will be calculated from verified activity. Rankings are coming soon.',
  'claim-bonus': 'Bonuses will require server-verified eligibility and anti-abuse checks. Goals do not award real money yet.',
  referrals: 'Verified invitations, team levels and referral attribution are coming soon. Invitations do not create rewards until tracking is enabled.',
  transactions: 'A verified transaction history will be available when the double-entry ledger and payment services are connected.',
  support: 'Support tickets and staff responses are coming soon. Support requests cannot be submitted from this page yet.',
  courses: 'A course catalogue, lessons and learning progress are coming soon. Planned topics include language teaching, digital marketing and forex.',
  surveys: 'Survey eligibility, submissions and history will be built with verified task completion. Survey rewards are not available yet.',
}
export function PlannedPage({ admin = false }: { admin?: boolean }) {
  const { feature = '' } = useParams()
  const { t } = useApp()
  const item = allNavigation.find(item => item.path === feature)
  const title = admin ? 'Admin workspace' : item ? 'key' in item && item.key ? t(item.key) : 'label' in item ? item.label : '' : 'Page not found'
  const content = <div className="planned-content"><span className="planned-icon"><Clock3 size={32} strokeWidth={1.4} /></span><span className="eyebrow">{admin ? 'ADMIN' : item ? 'COMING SOON' : '404'}</span><h1>{title}</h1><p>{admin ? 'The admin workspace is being prepared. Administrative actions will require server-verified roles, audit logs and secure APIs. No admin access or controls are exposed here.' : descriptions[feature] || (item ? `${title} is part of the LipaHub roadmap and is being prepared. This page does not submit tasks, accept payments or issue rewards.` : 'This page does not exist.')}</p><span className="pill amber-pill">{item || admin ? 'In development' : 'Unknown route'}</span><Link className="button secondary" to={admin ? '/' : '/dashboard'}><ArrowLeft size={16} />{admin ? 'Back to LipaHub' : 'Back to dashboard'}</Link></div>
  return admin ? <main className="document-page"><Logo />{content}</main> : <section className="panel">{content}</section>
}
