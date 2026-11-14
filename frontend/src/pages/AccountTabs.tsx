import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, CreditCard, History, LockKeyhole, ShieldCheck, Ticket, Users, Wallet } from 'lucide-react'
import { Modal, Panel } from '../components'
import { useMemberBalance } from '../useMemberBalance'
import { walletMoney } from '../domain/balances'
import { normalizeCountry } from '../domain/countries'
import { useApp } from '../state'
import { InviteLink } from '../InviteLink'
import './ReferenceTabs.css'

function AccountFunds() {
  const account = useMemberBalance()
  return <div className="reference-funds"><span><Wallet size={18} />Main balance</span><strong>{account.wallet ? walletMoney(account.wallet.availableMinor, account.wallet.currency) : account.error ? 'Unavailable' : 'Loading…'}</strong><span>Activation balance</span><strong className="reference-secondary-amount">Unavailable</strong><small>Activation funds will appear when account activation is enabled.</small>{account.error && <button className="text-link" onClick={account.refresh}>Retry balance</button>}</div>
}
function ServiceNote({ children }: { children: React.ReactNode }) { return <div className="reference-notice"><ShieldCheck size={19} /><p>{children}</p></div> }

export function DepositPage() {
  const { demo, session } = useApp()
  const country = normalizeCountry(demo?.country || session?.user.user_metadata.country)
  const [provider, setProvider] = useState<string | null>(null)
  return <Panel title="Deposit" className="reference-page"><div className="reference-body"><div className="reference-intro"><span className="eyebrow">YOUR ACCOUNT</span><h2>Deposit</h2><p>Deposit to your account for spinning or buying vouchers.</p></div>{country === 'Rwanda' ? <div className="deposit-methods">{['MTN', 'Airtel'].map(name => <button key={name} className="button primary" aria-expanded={provider === name} aria-controls="deposit-provider" onClick={() => setProvider(provider === name ? null : name)}><CreditCard size={18} />Deposit with {name}<ArrowRight size={16} /></button>)}<Link className="button reference-gold" to="/dashboard">Go to dashboard<ArrowRight size={16} /></Link></div> : <ServiceNote>Deposit options for {country || 'your country'} have not been published yet. Please contact support for help.</ServiceNote>}{provider && <section id="deposit-provider" className="reference-detail" aria-live="polite"><span className="icon-chip teal"><CreditCard size={20} /></span><h3>{provider} Mobile Money</h3><p>{provider} deposits are not available yet. Recipient details and payment instructions will appear here when this service is enabled.</p><Link className="text-link" to="/dashboard/support">Contact support<ArrowRight size={14} /></Link></section>}<div className="reference-inline-links"><Link className="text-link" to="/dashboard/transactions"><History size={15} />Balance history</Link><Link className="text-link" to="/dashboard/support">Need help?</Link></div></div></Panel>
}

export function VoucherPage() {
  const location = useLocation()
  const history = location.pathname.endsWith('/history')
  const [dialog, setDialog] = useState(false)
  return <Panel title="Voucher" className="reference-page"><div className="reference-tabs" aria-label="Voucher navigation"><Link className={!history ? 'selected' : ''} to="/dashboard/voucher"><Ticket size={16} />Buy voucher</Link><Link className={history ? 'selected' : ''} to="/dashboard/voucher/history"><History size={16} />History</Link></div>{history ? <div className="reference-empty"><History size={34} /><h3>Voucher history</h3><p>Voucher purchase records are not available yet. Completed purchases will appear here when the service is enabled.</p><Link className="button secondary" to="/dashboard/voucher"><ArrowLeft size={15} />Back to vouchers</Link></div> : <div className="reference-body reference-two-column"><section><h3>Voucher balance</h3><div className="voucher-alert"><LockKeyhole size={19} /><div><p>A transaction PIN is required when buying vouchers. Set up your PIN before making a purchase.</p><button className="button reference-gold small" onClick={() => setDialog(true)}>Change PIN</button></div></div><div className="voucher-alert blue-alert"><Ticket size={19} /><p>Vouchers are used to activate inactive member accounts. Voucher pricing will be shown here when purchases are enabled. Contact customer care for more information.</p></div><AccountFunds /></section><section className="voucher-purchase"><span className="reference-feature-icon"><Ticket size={30} /></span><span className="eyebrow">ACCOUNT ACTIVATION</span><h2>Buy a voucher</h2><p>Activate an account using a voucher purchased from your main balance.</p><dl className="reference-summary"><div><dt>Voucher price</dt><dd>Not published</dd></div><div><dt>Transaction PIN</dt><dd>Setup unavailable</dd></div><div><dt>Account activation</dt><dd>Not enabled</dd></div></dl><button className="button primary" disabled>Voucher purchases unavailable</button><Link className="text-link" to="/dashboard/support">Contact customer care<ArrowRight size={14} /></Link></section></div>}{dialog && <Modal title="Transaction PIN" close={() => setDialog(false)}><div className="reference-pin"><LockKeyhole size={32} /><h3>Protect your voucher purchases</h3><p>PIN setup is not available yet. You will be able to create or change your transaction PIN here when voucher purchases are enabled.</p><Link className="button primary" to="/dashboard/support">Contact support</Link><button className="button secondary" onClick={() => setDialog(false)}>Close</button></div></Modal>}</Panel>
}

const withdrawalChannels = [
  { path: '', label: 'Withdraw', source: 'Main balance' },
  { path: 'youtube', label: 'Withdraw Youtube', source: 'Youtube earnings' },
  { path: 'trivia', label: 'Withdraw Trivia', source: 'Trivia earnings' },
  { path: 'games', label: 'Withdraw Games', source: 'Game earnings' },
  { path: 'tiktok', label: 'Withdraw Tiktok', source: 'Tiktok earnings' },
  { path: 'socials', label: 'Withdraw Socials', source: 'Social earnings' },
  { path: 'chat', label: 'Withdraw from Chat', source: 'Chat earnings' },
  { path: 'history', label: 'Withdraw History', source: '' },
] as const
export function WithdrawPage() {
  const location = useLocation()
  const segment = location.pathname.split('/')[3] || ''
  const channel = withdrawalChannels.find(item => item.path === segment) || withdrawalChannels[0]
  const account = useMemberBalance()
  return <Panel title={channel.label} className="reference-page"><div className="reference-body"><div className="reference-channel-links" aria-label="Withdrawal sources">{withdrawalChannels.map(item => <Link key={item.path} className={channel.path === item.path ? 'selected' : ''} to={`/dashboard/withdraw${item.path ? `/${item.path}` : ''}`}>{item.path === 'history' ? <History size={14} /> : <Wallet size={14} />}{item.label}</Link>)}</div>{segment === 'history' ? <div className="reference-empty"><History size={34} /><h3>Withdrawal history</h3><p>Withdrawal records are not available yet. Submitted requests and payout updates will appear here once withdrawals are enabled.</p></div> : <div className="reference-two-column"><section><span className="eyebrow">YOUR PAYOUTS</span><h2>{channel.label}</h2><p className="reference-description">Transfer eligible earnings to your payout account.</p><div className="reference-funds"><span>{channel.source}</span><strong>{channel.path ? 'Unavailable' : account.wallet ? walletMoney(account.wallet.availableMinor, account.wallet.currency) : account.error ? 'Unavailable' : 'Loading…'}</strong><small>{channel.path ? 'Earnings for this activity are not connected yet.' : 'An available balance does not confirm withdrawal eligibility.'}</small></div></section><section className="reference-detail"><Wallet size={28} /><h3>Withdrawals are not enabled yet</h3><p>Payout methods, minimum amounts and fees will be shown here when they have been configured. Your balance has not been debited.</p><button className="button primary" disabled>Request withdrawal</button><Link className="text-link" to="/dashboard/support">Contact support<ArrowRight size={14} /></Link></section></div>}</div></Panel>
}

export function TeamPage() {
  const path = useLocation().pathname
  const level = path.includes('level-2') ? 2 : path.includes('level-3') ? 3 : 1
  const status = path.endsWith('/inactive') ? 'inactive' : 'active'
  const [search, setSearch] = useState('')
  return <Panel title="Team" className="reference-page"><div className="reference-body"><div className="reference-intro"><span className="eyebrow">GROW TOGETHER</span><h2>Your team</h2><p>View your referral levels and account activation status.</p></div><InviteLink /><div className="reference-tabs" aria-label="Team levels">{[1, 2, 3].map(item => <Link key={item} className={level === item ? 'selected' : ''} to={`/dashboard/referrals/level-${item}`}>{level === item && <Check size={14} />}Level {item}</Link>)}</div><div className="team-toolbar"><div className="reference-tabs" aria-label="Team activation status">{['active', 'inactive'].map(item => <Link key={item} className={status === item ? 'selected' : ''} to={`/dashboard/referrals/level-${level}/${item}`}>{item === 'active' ? 'Active' : 'Inactive'}</Link>)}</div><label><span className="sr-only">Search team members</span><input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search team members…" /></label></div><div className="reference-empty"><Users size={36} /><h3>Level {level} team</h3><p>Verified referral records are not available yet. Member names, activation status and team totals will appear here when referral tracking is enabled.</p>{search && <button className="text-link" onClick={() => setSearch('')}>Clear search</button>}<Link className="text-link" to="/dashboard/support">Get help with referrals<ArrowRight size={14} /></Link></div></div></Panel>
}
