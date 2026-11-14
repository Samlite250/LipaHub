import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Bot, Heart, Check, ChevronDown, ChevronRight, Gift, LayoutGrid, Lightbulb, LogOut, MessageCircle, Moon, Sun, TrendingUp, Users, Wallet, X, Landmark, Trophy, ClipboardList, Ticket, Eye, EyeOff } from 'lucide-react'
import { IconChip, Languages, Logo, Modal, Panel } from '../components'
import { useApp } from '../state'
import { CountryFlag } from '../CountryFlag'
import { AccountMenu } from '../AccountMenu'
import { UserDetails } from '../UserDetails'
import { InviteLink } from '../InviteLink'
import { useAccountActivation } from '../lib/account-activation'
import { WalletWelcome } from '../WalletWelcome'
import { ServiceBalance } from '../ServiceBalance'
import { allNavigation, navigationForCountry, navigationChildren, type NavigationChild } from '../navigation'
import { hasRobotDashboard, normalizeCountry } from '../domain/countries'
import { RobotDashboard } from './Robots'
import { useMemberBalance } from '../useMemberBalance'
import { walletMoney } from '../domain/balances'
import { DashboardAnnouncements, MemberContentProvider, useMemberContent } from '../MemberContent'

export function DashboardLayout() { return <MemberContentProvider><DashboardWorkspace /></MemberContentProvider> }
function SidebarSubmenu({ path, label, icon, children, nested = false, onNavigate }: { path: string; label: string; icon?: ReactNode; children: NavigationChild[]; nested?: boolean; onNavigate: () => void }) {
  const { pathname } = useLocation()
  const matchesPath = (value: string) => pathname === `/dashboard/${value}` || pathname.startsWith(`/dashboard/${value}/`)
  const active = matchesPath(path) || children.some(child => matchesPath(child.path))
  const [open, setOpen] = useState(active)
  const panelId = useId()
  useEffect(() => { if (active) setOpen(true) }, [pathname, active])
  return <div className={`nav-submenu ${nested ? 'nav-level' : ''} ${active ? 'current' : ''}`} data-open={open}>
    <button type="button" className="nav-submenu-toggle" aria-expanded={open} aria-controls={panelId} onClick={() => setOpen(value => !value)}>{icon}<span>{label}</span>{!nested && <ChevronDown size={14} />}</button>
    <div id={panelId} className="nav-submenu-collapse" inert={!open} aria-hidden={!open}><div className="nav-submenu-links">{children.map(child => child.children ? <SidebarSubmenu key={child.path} path={child.path} label={child.label} children={child.children} nested onNavigate={onNavigate} /> : <NavLink end key={child.path} to={`/dashboard/${child.path}`} onClick={onNavigate}>{child.label}</NavLink>)}</div></div>
  </div>
}
function DashboardWorkspace() {
  const { settings: siteSettings } = useMemberContent()
  const { t, demo, session, dark, setDark, signOut, language, setLanguage } = useApp()
  const [menu, setMenu] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [settings, setSettings] = useState(false)
  const [error, setError] = useState('')
  const location = useLocation()
  const navigate = useNavigate()
  const menuRef = useRef<HTMLButtonElement>(null)
  const sidebarRef = useRef<HTMLElement>(null)
  const name = demo?.name || session?.user.user_metadata.display_name || 'Member'
  const country = normalizeCountry(demo?.country || session?.user.user_metadata.country)
  useEffect(() => {
    if (!menu) return
    const sidebar = sidebarRef.current
    sidebar?.querySelector<HTMLElement>('a')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMenu(false); menuRef.current?.focus() }
      if (event.key === 'Tab') {
        const items = Array.from(sidebar?.querySelectorAll<HTMLElement>('a,button') || []).filter(item => !item.closest('[inert]') && item.getClientRects().length > 0)
        if (!items?.length) return
        const first = items[0]; const last = items[items.length - 1]
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = previous }
  }, [menu])
  const memberNavigation = navigationForCountry(country)
  const current = [...memberNavigation.flatMap(group => group.items), ...allNavigation].find(item => `/dashboard${item.path ? `/${item.path}` : ''}` === location.pathname)
  const title = current ? 'key' in current && current.key ? t(current.key) : 'label' in current ? current.label : t('home') : t('home')
  async function logout() { try { await signOut(); navigate('/login') } catch { setError('Sign out failed. Please try again.') } }
  const closeMenu = () => { setMenu(false); menuRef.current?.focus() }
  return <div className={`dashboard-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <a className="skip-link" href="#main-content">Skip to content</a>
    {menu && <button className="sidebar-overlay" onClick={closeMenu} aria-label="Close navigation" />}
    <aside ref={sidebarRef} id="member-navigation" className={`sidebar ${menu ? 'is-open' : ''}`} aria-label="Member navigation">
      <div className="sidebar-logo"><Logo /><button className="mobile-close icon-button" aria-label="Close menu" onClick={closeMenu}><X size={18} /></button></div>
      <div className="sidebar-scroll"><Link to="/dashboard/profile" className="side-profile" onClick={closeMenu}><span className="avatar">{name.charAt(0).toUpperCase()}</span><div><strong>{name}</strong><small><span>✦</span> {t('member')}</small></div><span className="profile-country"><CountryFlag country={country} /></span></Link>
      <nav>{memberNavigation.map(group => <div className="nav-group" key={group.group}><p className="nav-caption">{t(group.group)}</p>{group.items.filter(item => item.path !== 'robots' || hasRobotDashboard(demo?.country || session?.user.user_metadata.country)).map(item => navigationChildren[item.path] ? <SidebarSubmenu key={item.path} path={item.path} label={'key' in item && item.key ? t(item.key) : item.label || ''} icon={<IconChip icon={item.icon} color={item.color} />} children={navigationChildren[item.path]} onNavigate={closeMenu} /> : <NavLink end to={`/dashboard${item.path ? `/${item.path}` : ''}`} key={item.path} onClick={closeMenu}><IconChip icon={item.icon} color={item.color} /><span>{'key' in item && item.key ? t(item.key) : item.label || ''}</span>{['trading', 'chat'].includes(item.path) && <span className="nav-dot" />}</NavLink>)}</div>)}</nav>
      <button className="logout-button" onClick={logout}><IconChip icon={LogOut} color="red" />{t('logout')}</button>{error && <p className="form-error" role="alert">{error}</p>}<p className="sidebar-bottom">LipaHub</p></div>
    </aside>
    <div className="dashboard-body"><header className="dashboard-header"><button className="menu-button" aria-label="Toggle navigation" aria-controls="member-navigation" aria-expanded={menu || !collapsed} ref={menuRef} onClick={() => { if (window.innerWidth < 992) setMenu(!menu); else setCollapsed(!collapsed) }}><LayoutGrid size={20} /></button><div className="mobile-logo"><Logo compact /></div><div className="header-tools"><button className="header-country" title={country || 'Country not selected'} aria-label="Change language" onClick={() => { const order = ['en', 'rw', 'lg', 'sw'] as const; setLanguage(order[(order.indexOf(language) + 1) % order.length]) }}><CountryFlag country={country} /></button><button className="header-theme" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} onClick={() => setDark(!dark)}>{dark ? <Sun size={19} /> : <Moon size={19} />}</button><AccountMenu openSettings={() => setSettings(true)} logout={logout} /></div></header>
    <main className="dashboard-main" id="main-content"><div className="page-heading"><div><h1>{location.pathname === '/dashboard' ? t('home') : title}</h1><div className="breadcrumbs"><Link to="/dashboard">{t('dashboard')}</Link><ChevronRight size={12} /><span>{location.pathname === '/dashboard' ? t('home') : title}</span></div></div><select aria-label="Language" value={language} onChange={e => setLanguage(e.target.value as typeof language)}><option value="en">English</option><option value="rw">Kinyarwanda</option><option value="lg">Luganda</option><option value="sw">Kiswahili</option></select></div>
    {location.pathname === '/dashboard' && <DashboardAnnouncements />}<Outlet /></main><footer className="member-footer"><p>Copyright &copy; <strong>{siteSettings.siteName === 'LipaHub' ? 'LIPAHUB' : siteSettings.siteName}</strong>. Designed with <Heart size={14} className="footer-heart" role="img" aria-label="love" /> by <strong className="footer-designer">BESTTECH</strong> All rights reserved</p></footer></div>
    {settings && <Modal title={t('appearance')} close={() => setSettings(false)}><p className="muted">Make LipaHub feel like home.</p><div className="theme-options"><button className={!dark ? 'selected' : ''} onClick={() => setDark(false)}><Sun size={24} />{t('light')}{!dark && <Check size={16} />}</button><button className={dark ? 'selected' : ''} onClick={() => setDark(true)}><Moon size={24} />{t('dark')}{dark && <Check size={16} />}</button></div><h3>{t('language')}</h3><Languages /><button className="button primary" onClick={() => setSettings(false)}>Done</button></Modal>}
  </div>
}

const demoStats = [
  { key: 'balance' as const, value: 6800, color: 'green', icon: Wallet },
  { key: 'withdrawn' as const, value: 65188, color: 'red', icon: Landmark },
  { key: 'affiliate' as const, value: 34000, color: 'blue', icon: Users },
  { key: 'bonus' as const, value: 0, color: 'yellow', icon: Gift },
]
export function DashboardHome() {
  const { demo, session } = useApp()
  return hasRobotDashboard(demo?.country || session?.user.user_metadata.country) ? <RobotDashboard /> : <StandardDashboard />
}

function StandardDashboard() {
  const account = useMemberBalance()
  const { t, demo, session } = useApp()
  const activation = useAccountActivation(session?.access_token, !!session && session.user.user_metadata.country === 'Rwanda')
  const [hidden, setHidden] = useState(false)
  const name = demo?.name || session?.user.user_metadata.display_name || 'Member'

  const amount = (value: number) => hidden ? '••••••' : `RF ${(demo ? value : 0).toLocaleString('en-US')}`
  const expense = hidden ? '••••••' : demo ? amount(6500) : activation.error ? 'Unavailable' : activation.loading ? 'Loading…' : `RF ${(activation.data?.request?.status === 'verified' ? activation.data.request.quote.value : 0).toLocaleString('en-US')}`
  const balanceAmount = (bonus = false) => hidden ? '••••••' : account.wallet ? walletMoney(bonus ? account.wallet.bonusMinor : account.wallet.availableMinor, account.wallet.currency) : account.error ? 'Unavailable' : 'Loading…'
  return <>
    <section className="wallet-hero"><div className="wallet-top"><span className="hello-badge"><Lightbulb size={15} />{t('hello')}, {name} 👋</span><button className="wallet-visibility" onClick={() => setHidden(!hidden)} aria-label={hidden ? 'Show balances' : 'Hide balances'}>{t('wallet')}{hidden ? <EyeOff size={16} /> : <Eye size={16} />}</button></div><WalletWelcome /><div className="wallet-tiles"><div className="wallet-tile total-tile"><div><span>{t('total')}</span><strong>{amount(78488)}</strong></div><span className="tile-trend"><TrendingUp size={23} /></span></div><div className="wallet-tile expense-tile"><span>{t('expense')}</span><strong>{expense}</strong><small>{t('once')}{!demo && activation.data?.request?.status !== 'verified' && ' · no transactions'}</small></div></div></section>
    {account.error && <p className="form-error" role="alert">{account.error} <button className="text-link" onClick={account.refresh}>Retry balance</button></p>}
    <div className="stat-grid">{demoStats.map(stat => <section key={stat.key} className={`stat-card ${stat.color}`}><div><h2>{t(stat.key)}</h2><strong data-testid={stat.key === 'balance' ? 'member-balance' : stat.key === 'bonus' ? 'member-bonus' : undefined}>{stat.key === 'balance' ? balanceAmount() : stat.key === 'bonus' ? balanceAmount(true) : amount(stat.value)}</strong><small>{t('allTime')}</small></div><span className="stat-icon"><stat.icon size={24} strokeWidth={1.5} /></span></section>)}</div>
    <div className="dashboard-features"><Link to="/dashboard/trading" className="dashboard-feature"><IconChip icon={Bot} color="indigo" /><div><h2>{t('trading')}</h2><p>Explore strategies with virtual funds.</p></div><span className="pill indigo-pill">{t('simulated')}</span><ArrowRight size={18} /></Link><Link to="/dashboard/chat" className="dashboard-feature"><IconChip icon={MessageCircle} color="pink" /><div><h2>{t('chat')}</h2><p>A world of conversations to discover.</p></div><span className="pill">Community</span><ArrowRight size={18} /></Link></div>
    <div className="chart-grid"><Panel title={`${t('referrals')} — ${t('last7')}`} action={<span className="pill"><Users size={13} />{demo ? 10 : 0} {t('allTime').toLowerCase()}</span>}><ReferralChart /><div className="chart-footer"><span>{t('today')}: <strong>0</strong></span><span>{t('week')}: <strong>0</strong></span><Link to="/dashboard/ranks">{t('ranks')} <ArrowRight size={13} /></Link></div></Panel><Panel title={t('mix')}><div className="donut-wrap"><div className={`donut ${demo ? '' : 'empty-donut'}`} role="img" aria-label={demo ? 'Virtual earnings: RF 34,000 from referrals; all other categories zero' : 'No earnings recorded'}><div><small>Total</small><strong>{amount(34000)}</strong></div></div></div><div className="chart-legend">{['Referrals', 'Ads', 'YouTube', 'TikTok', 'Trivia', 'Blog', 'Bonus'].map((item, i) => <span key={item}><i style={{ background: ['#14b8a6', '#6366f1', '#f59e0b', '#ec4899', '#0ea5e9', '#8b5cf6', '#f43f5e'][i] }} />{item}</span>)}</div></Panel></div>
    <div className="chart-grid"><Panel title={t('actions')}><div className="quick-actions">{[{ to: 'deposit', key: 'deposit' as const, icon: Wallet, color: 'teal' }, { to: 'withdraw', key: 'withdraw' as const, icon: Landmark, color: 'indigo' }, { to: 'voucher', key: 'voucher' as const, icon: Ticket, color: 'amber' }, { to: 'chat', key: 'chat' as const, icon: MessageCircle, color: 'pink' }, { to: 'surveys', key: 'surveys' as const, icon: ClipboardList, color: 'blue' }, { to: 'ranks', key: 'ranks' as const, icon: Trophy, color: 'green' }].map(action => <Link className={action.color} key={action.to} to={`/dashboard/${action.to}`}><action.icon size={23} strokeWidth={1.6} /><span>{t(action.key)}</span></Link>)}</div></Panel><Panel title={t('goal')} action={<span className="pill amber-pill">{t('planned')}</span>}><div className="goal-content"><div className="goal-numbers"><Gift size={25} /><strong>{demo ? 10 : 0}<small> / 6</small></strong></div><p>{demo ? 'Rewards are not active.' : 'Referral rewards are planned for a future release.'}</p><div className="progress"><span style={{ width: demo ? '100%' : '0%' }} /></div><div className="goal-caption"><span>{demo ? '100' : '0'}% complete</span><span>Goal: 6 referrals</span></div><Link to="/dashboard/claim-bonus" className="text-link">View reward status <ArrowRight size={14} /></Link></div></Panel></div>
    <div className="chart-grid"><ServiceBalance value={demo || hidden ? amount(0) : 'Unavailable'} /><InviteLink /></div>
    <Panel title={t('timetable')} action={<span className="pill">Schedule pending</span>}><div className="table-scroll"><table><thead><tr><th>#</th><th>Activity</th><th>Day 1</th><th>Day 2</th><th>Day 3</th><th>Status</th></tr></thead><tbody>{[['YouTube', 'Saturday', 'Sunday', '—'], ['Surveys', 'Tuesday', 'Thursday', '—'], ['TikTok', 'Tuesday', 'Wednesday', '—'], ['WhatsApp', 'Monday', 'Wednesday', 'Friday'], ['Articles', 'Monday', 'Friday', '—']].map(([activity, day1, day2, day3], i) => <tr key={activity}><td><span className="table-number">{i + 1}</span></td><td>{activity}</td><td>{day1}</td><td>{day2}</td><td>{day3}</td><td><span className="pill neutral-pill">{t('planned')}</span></td></tr>)}</tbody></table></div></Panel>
    <UserDetails />
  </>
}

function ReferralChart() {
  const [day, setDay] = useState<number | null>(null)
  const days = ['Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun', 'Mon']
  return <div className="referral-chart"><svg viewBox="0 0 560 240" role="img" aria-label="Referrals over the last seven days: zero on every day">{[0, 1, 2, 3, 4, 5].map(i => <g key={i}><text x="12" y={25 + i * 35}>{(2 - i * .4).toFixed(1)}</text><line x1="48" y1={21 + i * 35} x2="540" y2={21 + i * 35} strokeDasharray="4 4" /></g>)}<line className="chart-line" x1="48" y1="196" x2="540" y2="196" />{days.map((label, i) => <g key={label}><circle className="chart-point" cx={50 + i * 81} cy="196" r="4" /><text x={50 + i * 81} y="226" textAnchor="middle">{label}</text></g>)}</svg><div className="chart-hit-targets">{days.map((label, i) => <button key={label} aria-label={`${label}: 0 referrals`} onMouseEnter={() => setDay(i)} onMouseLeave={() => setDay(null)} onFocus={() => setDay(i)} onBlur={() => setDay(null)} onClick={() => setDay(day === i ? null : i)} />)}</div>{day !== null && <div className="chart-tooltip" role="status">{days[day]} · 0 referrals</div>}</div>
}
