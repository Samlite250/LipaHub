import { demoEnabled } from '../lib/platform'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Bot, BookOpen, Check, ChevronDown, CircleHelp, Compass, Globe2, GraduationCap, Menu, MessageCircle, Moon, Smartphone, Sparkles, Sun, Users, X } from 'lucide-react'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { Languages, Logo, Panel } from '../components'
import { CountryFlag } from '../CountryFlag'
import countryData from '../../../shared/countries.json' with { type: 'json' }
import { normalizeCountry } from '../domain/countries'
import { useApp } from '../state'

const countryCodes = ['ke', 'ug', 'tz', 'rw', 'ng', 'mw', 'zm', 'gh', 'cm', 'bw', 'bi', 'zw', 'mz', 'za', 'cd', 'ss', 'ci', 'sn', 'bf', 'tg', 'bj']
const countryOptions = [
  ...countryCodes.flatMap(iso2 => {
    const country = countryData.find(item => item.iso2 === iso2)
    return country ? [{ country: country.name, label: country.name, iso2 }] : []
  }),
  { country: 'International', label: 'All of Africa', iso2: '' },
]
const countryThemes: Record<string, { primary: string; secondary: string; accent: string; highlight: string; stripe: string }> = {
  Rwanda: { primary: '#00a1de', secondary: '#20603d', accent: '#fad201', highlight: '#4ade80', stripe: 'linear-gradient(90deg,#00a1de 0 33.333%,#fad201 33.333% 66.666%,#20603d 66.666%)' },
  Burundi: { primary: '#ce1126', secondary: '#1eb53a', accent: '#fff', highlight: '#70ef99', stripe: 'linear-gradient(90deg,#ce1126 0 33.333%,#fff 33.333% 66.666%,#1eb53a 66.666%)' },
  Uganda: { primary: '#000', secondary: '#d90000', accent: '#fcdc04', highlight: '#ffdf3d', stripe: 'linear-gradient(90deg,#000 0 33.333%,#fcdc04 33.333% 66.666%,#d90000 66.666%)' },
  Kenya: { primary: '#000', secondary: '#006600', accent: '#bb0000', highlight: '#ff6b73', stripe: 'linear-gradient(90deg,#000 0 33.333%,#bb0000 33.333% 66.666%,#006600 66.666%)' },
  Tanzania: { primary: '#1eb53a', secondary: '#00a3dd', accent: '#fcd116', highlight: '#67ed81', stripe: 'linear-gradient(90deg,#1eb53a 0 33.333%,#fcd116 33.333% 66.666%,#00a3dd 66.666%)' },
  Nigeria: { primary: '#008751', secondary: '#006b3f', accent: '#fff', highlight: '#64e6a3', stripe: 'linear-gradient(90deg,#008751 0 33.333%,#fff 33.333% 66.666%,#008751 66.666%)' },
  Malawi: { primary: '#000', secondary: '#339e35', accent: '#ce1126', highlight: '#ff707b', stripe: 'linear-gradient(90deg,#000 0 33.333%,#ce1126 33.333% 66.666%,#339e35 66.666%)' },
  Zambia: { primary: '#198a00', secondary: '#de2010', accent: '#ef7d00', highlight: '#ff9a3e', stripe: 'linear-gradient(90deg,#198a00 0 33.333%,#de2010 33.333% 66.666%,#ef7d00 66.666%)' },
  Ghana: { primary: '#ce1126', secondary: '#006b3f', accent: '#fcd116', highlight: '#ffdf55', stripe: 'linear-gradient(90deg,#ce1126 0 33.333%,#fcd116 33.333% 66.666%,#006b3f 66.666%)' },
  Cameroon: { primary: '#007a5e', secondary: '#fcd116', accent: '#ce1126', highlight: '#ff6b73', stripe: 'linear-gradient(90deg,#007a5e 0 33.333%,#ce1126 33.333% 66.666%,#fcd116 66.666%)' },
  Botswana: { primary: '#75aadb', secondary: '#001489', accent: '#fff', highlight: '#9dd2ff', stripe: 'linear-gradient(90deg,#75aadb 0 33.333%,#fff 33.333% 66.666%,#001489 66.666%)' },
  Zimbabwe: { primary: '#006400', secondary: '#de2010', accent: '#ffd200', highlight: '#ffdf55', stripe: 'linear-gradient(90deg,#006400 0 33.333%,#ffd200 33.333% 66.666%,#de2010 66.666%)' },
  Mozambique: { primary: '#007168', secondary: '#d21034', accent: '#fce100', highlight: '#ffdf55', stripe: 'linear-gradient(90deg,#007168 0 33.333%,#fce100 33.333% 66.666%,#d21034 66.666%)' },
  'South Africa': { primary: '#007749', secondary: '#001489', accent: '#e03c31', highlight: '#ff7470', stripe: 'linear-gradient(90deg,#e03c31 0 25%,#fff 25% 50%,#007749 50% 75%,#001489 75%)' },
  'DR Congo': { primary: '#007fff', secondary: '#f7d618', accent: '#ce1021', highlight: '#ff737b', stripe: 'linear-gradient(90deg,#007fff 0 33.333%,#f7d618 33.333% 66.666%,#ce1021 66.666%)' },
  'South Sudan': { primary: '#0f47af', secondary: '#da121a', accent: '#fcd116', highlight: '#ffdf55', stripe: 'linear-gradient(90deg,#0f47af 0 33.333%,#fcd116 33.333% 66.666%,#da121a 66.666%)' },
  'Côte d’Ivoire': { primary: '#f77f00', secondary: '#009e60', accent: '#fff', highlight: '#ffae55', stripe: 'linear-gradient(90deg,#f77f00 0 33.333%,#fff 33.333% 66.666%,#009e60 66.666%)' },
  Senegal: { primary: '#00853f', secondary: '#e31b23', accent: '#fdef42', highlight: '#ffdf55', stripe: 'linear-gradient(90deg,#00853f 0 33.333%,#fdef42 33.333% 66.666%,#e31b23 66.666%)' },
  'Burkina Faso': { primary: '#ef2b2d', secondary: '#009e49', accent: '#fcd116', highlight: '#ffdf55', stripe: 'linear-gradient(90deg,#ef2b2d 0 33.333%,#fcd116 33.333% 66.666%,#009e49 66.666%)' },
  Togo: { primary: '#006a4e', secondary: '#d21034', accent: '#ffce00', highlight: '#ffdf55', stripe: 'linear-gradient(90deg,#006a4e 0 33.333%,#ffce00 33.333% 66.666%,#d21034 66.666%)' },
  Benin: { primary: '#008751', secondary: '#e8112d', accent: '#fcd116', highlight: '#ffdf55', stripe: 'linear-gradient(90deg,#008751 0 33.333%,#fcd116 33.333% 66.666%,#e8112d 66.666%)' },
  International: { primary: '#1e3a8a', secondary: '#059669', accent: '#7c3aed', highlight: '#4ade80', stripe: 'linear-gradient(90deg,#00a8e0 0 33.333%,#ffd500 33.333% 66.666%,#00843d 66.666%)' },
}

export function Landing() {
  const { dark, setDark, language, setLanguage, startDemo, t } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [countryMenuOpen, setCountryMenuOpen] = useState(false)
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  const countryPickerRef = useRef<HTMLDivElement>(null)
  const countryFromUrl = new URLSearchParams(location.search).get('country')
  const selectedCountry = normalizeCountry(countryFromUrl) || normalizeCountry(localStorage.getItem('lipahub-country')) || 'Rwanda'
  const theme = countryThemes[selectedCountry] || countryThemes.International
  const countryStyle: CSSProperties & {
    '--landing-country-primary': string
    '--landing-country-secondary': string
    '--landing-country-accent': string
    '--landing-country-highlight': string
    '--landing-country-stripe': string
  } = {
    '--landing-country-primary': theme.primary,
    '--landing-country-secondary': theme.secondary,
    '--landing-country-accent': theme.accent,
    '--landing-country-highlight': theme.highlight,
    '--landing-country-stripe': theme.stripe,
  }
  useEffect(() => {
    if (!countryMenuOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !countryPickerRef.current?.contains(event.target)) setCountryMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCountryMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [countryMenuOpen])
  useEffect(() => {
    if (countryFromUrl) localStorage.setItem('lipahub-country', selectedCountry)
  }, [countryFromUrl, selectedCountry])
  const selectCountry = (country: string, iso2: string) => {
    localStorage.setItem('lipahub-country', country)
    const params = new URLSearchParams(location.search)
    if (iso2) params.set('country', iso2)
    else params.delete('country')
    navigate({ pathname: location.pathname, search: params.toString() ? `?${params.toString()}` : '' }, { replace: true })
    setCountryMenuOpen(false)
  }
  const demo = () => { if (demoEnabled) { startDemo(); navigate('/dashboard') } else navigate('/register') }
  const openFeature = (path: string) => {
    if (demoEnabled) startDemo()
    navigate(demoEnabled ? path : '/login')
  }
  const questions = [
    ['What can I use today?', 'Create a private account, manage your profile, read published resources and announcements, contact support from your dashboard and explore simulation-based trading.'],
    ['What is the account activation fee?', 'If account activation is required, the current payment methods and amount are shown on the activation page. Amounts and availability can change, so review the displayed details before submitting payment.'],
    ['Is this real crypto trading?', 'No. Crypto Robotic Trading is an educational simulation. It cannot place orders, accept funds or generate real returns.'],
    ['How do chat rewards work?', 'Chat & Earn is being prepared. Reward eligibility, moderation and anti-abuse checks are being finalized. Practice messages do not earn money.'],
    ['Is LipaHub available worldwide?', 'Yes. LipaHub is built in East Africa and open worldwide through the web app. Country-specific payment and activation services depend on local availability.'],
    ['Does LipaHub help with online work or the best-paying jobs in the world?', 'LipaHub provides learning resources, digital-skills guidance and a global online-work guide. It is not a job board and does not guarantee jobs or income.'],
    ['Can I deposit or withdraw?', 'Payments and withdrawals are not live yet. They will become available after providers, trusted verification and required reviews are complete.'],
  ]
  const selectedCountryLabel = selectedCountry === 'International' ? 'Africa' : selectedCountry
  return <div className="landing landing-redesign" style={countryStyle}>
    <div className="install-banner"><span><Smartphone size={17} /> Install the LipaHub App</span><Link to="/install">DOWNLOAD LIPAHUB <ArrowRight size={15} /></Link></div>
    <header className="landing-header">
      <nav className="public-nav">
        <div className="landing-brand"><Logo /><span className="brand-divider" /><span className="brand-location"><CountryFlag country={selectedCountry} /> {selectedCountryLabel.toUpperCase()}</span></div>
        <div className="public-nav-links"><a href="#earn">Ways to Earn</a><a href="#how">How It Works</a><a href="#fees">Activation Fee</a><a href="#faq">FAQ</a></div>
        <div className="nav-actions"><Link className="login-link" to="/login">{t('signin')}</Link><Link className="button landing-nav-cta" to="/register">Register Free</Link>
          <div className="landing-country-picker" ref={countryPickerRef}>
            <button className="landing-country-trigger" aria-label={`Country and language: ${selectedCountryLabel}, ${language.toUpperCase()}`} aria-expanded={countryMenuOpen} aria-controls="landing-country-menu" onClick={() => setCountryMenuOpen(!countryMenuOpen)}><CountryFlag country={selectedCountry} /><span>{language.toUpperCase()}</span><ChevronDown size={12} /></button>
            {countryMenuOpen && <div className="landing-country-menu" id="landing-country-menu">
              <div className="landing-country-menu-title"><strong>Choose your country</strong><span>Country context</span></div>
              <div className="landing-country-grid">{countryOptions.map(option => <button key={option.country} className={selectedCountry === option.country ? 'is-selected' : ''} aria-pressed={selectedCountry === option.country} onClick={() => selectCountry(option.country, option.iso2)}><CountryFlag country={option.country} /><span>{option.label}</span></button>)}</div>
              <div className="landing-language-options" role="group" aria-label="Language">{(['en', 'rw', 'lg', 'sw'] as const).map(code => <button key={code} aria-pressed={language === code} onClick={() => { setLanguage(code); setCountryMenuOpen(false) }}>{code === 'en' ? 'English' : code === 'rw' ? 'Kinyarwanda' : code === 'lg' ? 'Luganda' : 'Kiswahili'}</button>)}</div>
            </div>}
          </div>
          <button className="landing-menu-button" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={21} /> : <Menu size={21} />}</button>
        </div>
      </nav>
      <div className="landing-stripe" aria-hidden="true" />
      {menuOpen && <div className="landing-mobile-nav"><a href="#earn" onClick={() => setMenuOpen(false)}>Ways to Earn</a><a href="#how" onClick={() => setMenuOpen(false)}>How It Works</a><a href="#fees" onClick={() => setMenuOpen(false)}>Activation Fee</a><a href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a><Link to="/install" onClick={() => setMenuOpen(false)}>Get the app</Link><Link to="/login" onClick={() => setMenuOpen(false)}>Sign in</Link><button className="landing-theme-toggle" onClick={() => setDark(!dark)}>{dark ? <Sun size={16} /> : <Moon size={16} />} Toggle theme</button><Link className="mobile-nav-cta" to="/register" onClick={() => setMenuOpen(false)}>Register Free <ArrowRight size={15} /></Link></div>}
    </header>
    <main>
      <section className="landing-hero">
        <div className="hero-flag-watermark" aria-hidden="true"><CountryFlag country={selectedCountry} /></div>
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow"><CountryFlag country={selectedCountry} /> LIPAHUB {selectedCountryLabel.toUpperCase()} <span className="hello">Built in East Africa</span></span>
            <h1>Learn, connect and explore <span className="hl">something new.</span></h1>
            <p className="sub">Build digital skills, explore new ideas, connect with a worldwide community, and discover honest, practical online-work guidance you can use from anywhere.</p>
            <div className="cta-row"><Link className="button btn-green btn-lg" to="/register">Create Your Account</Link><button className="button btn-outline btn-lg" onClick={demo}>Explore LipaHub</button></div>
            <p className="hero-note">Built in East Africa · Open worldwide · No guaranteed jobs, earnings or income</p>
            <div className="hero-stats" aria-label="LipaHub highlights">
              <div className="stat"><b>Global</b><span>Open worldwide</span></div>
              <div className="stat"><b>Learn</b><span>Build digital skills</span></div>
              <div className="stat"><b>Explore</b><span>At your own pace</span></div>
            </div>
          </div>
          <div className="wallet">
            <div className="wallet-head"><b>Explore LipaHub</b><span><CountryFlag country={selectedCountry} /> {selectedCountryLabel}</span></div>
            <div className="wallet-row"><div className="ic"><Bot size={19} /></div><div className="lbl">Trading simulations<small>Practice strategies with virtual funds</small></div><div className="amt">Learn</div></div>
            <div className="wallet-row"><div className="ic"><BookOpen size={19} /></div><div className="lbl">Learning resources<small>Guides, articles and digital-skills resources</small></div><div className="amt">Explore</div></div>
            <div className="wallet-row"><div className="ic"><MessageCircle size={19} /></div><div className="lbl">Community<small>Connect with others and share ideas</small></div><div className="amt">Connect</div></div>
            <div className="wallet-row"><div className="ic"><Compass size={19} /></div><div className="lbl">Online-work guidance<small>Practical tips for exploring online work</small></div><div className="amt">Discover</div></div>
            <div className="wallet-foot"><Check size={13} /> Learning first. LipaHub does not guarantee jobs, income, earnings or financial outcomes.</div>
          </div>
        </div>
      </section>
      <div className="intro-strip"><span>ONE ACCOUNT. MORE TO EXPLORE.</span><span><Compass size={18} /> Discover</span><span><Users size={18} /> Connect</span><span><GraduationCap size={18} /> Learn</span><span><Sparkles size={18} /> Grow</span></div>
      <section id="explore" className="public-section explore-section"><span className="landing-anchor" id="earn" aria-hidden="true" /><div className="section-intro"><span className="eyebrow">WHAT YOU CAN EXPLORE</span><h2>A hub built around<br />your curiosity.</h2><p>Choose a place to begin. Explore new skills, practical guidance and a global community — all in one place.</p></div>
        <div className="landing-features">
          <article className="landing-feature trading-feature"><span className="feature-number">01 / EXPLORE</span><Bot size={35} strokeWidth={1.4} /><h3>Trading simulations</h3><p>Explore how automated strategies respond to market movements in an educational simulation using virtual funds only.</p><div><span className="pill">Simulation only</span><button onClick={() => openFeature('/dashboard/trading')} aria-label="Explore trading simulation"><ArrowRight size={22} /></button></div></article>
          <article className="landing-feature chat-feature"><span className="feature-number">02 / CONNECT</span><MessageCircle size={35} strokeWidth={1.4} /><h3>Community & conversation</h3><p>Discover a space for conversations and shared perspectives. Community features are being expanded.</p><div><span className="pill">Community</span><button onClick={() => openFeature('/dashboard/chat')} aria-label="Explore community chat"><ArrowRight size={22} /></button></div></article>
          <article className="landing-feature skills-feature"><span className="feature-number">03 / LEARN</span><GraduationCap size={35} strokeWidth={1.4} /><h3>Digital skills</h3><p>Build your knowledge with practical guides and learning resources you can explore at your own pace.</p><div><span className="pill">Learn anywhere</span><Link to="/global" aria-label="Explore global learning"><ArrowRight size={22} /></Link></div></article>
          <article className="landing-feature work-feature"><span className="feature-number">04 / DISCOVER</span><Compass size={35} strokeWidth={1.4} /><h3>Online-work guidance</h3><p>Find honest guidance on digital work and opportunities around the world. No jobs or income are guaranteed.</p><div><span className="pill">Open worldwide</span><Link to="/online-work" aria-label="Explore online-work guidance"><ArrowRight size={22} /></Link></div></article>
          <article className="landing-feature community-feature"><span className="feature-number">05 / READ</span><BookOpen size={35} strokeWidth={1.4} /><h3>Articles & resources</h3><p>Browse published resources, articles and announcements from your member dashboard.</p><div><span className="pill">Member resources</span><Link to="/about" aria-label="Read about LipaHub"><ArrowRight size={22} /></Link></div></article>
          <article className="landing-feature app-feature"><span className="feature-number">06 / TAKE IT WITH YOU</span><Smartphone size={35} strokeWidth={1.4} /><h3>Mobile app</h3><p>Install the LipaHub Android app and access your learning and account wherever you go.</p><div><span className="pill">Android app</span><Link to="/install" aria-label="Get the LipaHub app"><ArrowRight size={22} /></Link></div></article>
          <article className="landing-feature help-feature"><span className="feature-number">07 / GET SUPPORT</span><CircleHelp size={35} strokeWidth={1.4} /><h3>Help & support</h3><p>Find answers, read our policies and get help through your LipaHub account.</p><div><span className="pill">Here to help</span><Link to="/about" aria-label="Get help"><ArrowRight size={22} /></Link></div></article>
        </div>
        <div className="more-features"><BookOpen size={22} /><div><strong>More to discover as LipaHub grows.</strong><p>Courses, surveys, articles, ebooks and more are being prepared for future releases.</p></div><span className="pill">Expanding</span></div>
      </section>
      <section id="how-it-works" className="how-section public-section"><span className="landing-anchor" id="how" aria-hidden="true" /><span className="eyebrow">HOW LIPAHUB WORKS</span><h2>Three steps to get started.</h2><p className="how-intro">No experience needed. Create an account and explore LipaHub at your own pace.</p><div className="steps">{[['01', 'Create your account', 'Sign up and go straight to your private dashboard.'], ['02', 'Explore what interests you', 'Try an educational simulation, explore learning resources or connect with the community.'], ['03', 'Keep discovering', 'Return to your dashboard to find new activities as LipaHub grows.']].map(([number, title, description]) => <article key={number}><span>{number}</span><h3>{title}</h3><p>{description}</p></article>)}</div></section>
      <section id="global" className="public-section global-access-section"><div className="section-intro"><span className="eyebrow">BUILT IN EAST AFRICA · OPEN WORLDWIDE</span><h2>One hub. Global access.</h2><p>Explore LipaHub’s global learning resources, honest online-work guidance and East African community from wherever you are.</p></div><div className="global-access-grid"><article className="access-card"><span className="access-badge"><Globe2 size={15} /> LIPAHUB GLOBAL</span><h3>Find your next place to explore.</h3><p>Create an account to visit your private dashboard and explore the tools and resources available today.</p><ul><li><Check size={15} /> Learning resources and practical guides</li><li><Check size={15} /> Community and member support</li><li><Check size={15} /> Educational simulations</li></ul><Link className="button primary" to="/register">Register Free <ArrowRight size={16} /></Link></article><div className="access-regions"><h3>Explore LipaHub</h3><p>Learn more about the platform and the regions it serves.</p><div className="region-links"><Link to="/global"><Globe2 size={17} /><span><b>LipaHub Global</b><small>Learning and community worldwide</small></span><ArrowRight size={15} /></Link><Link to="/east-africa"><Compass size={17} /><span><b>East Africa</b><small>Regional context and local guides</small></span><ArrowRight size={15} /></Link><Link to="/online-work"><BookOpen size={17} /><span><b>Online-work guidance</b><small>Practical resources and information</small></span><ArrowRight size={15} /></Link><Link to="/business"><Users size={17} /><span><b>LipaHub Business</b><small>Learning and community partnerships</small></span><ArrowRight size={15} /></Link></div></div></div></section>
      <section className="public-section landing-app-panels"><article className="landing-panel app-panel"><span className="eyebrow"><Smartphone size={14} /> ANDROID APP</span><h2>Take LipaHub with you</h2><p>Install the LipaHub app and keep learning, exploring resources and checking your account on the go.</p><Link className="button" to="/install">Download LipaHub App <ArrowRight size={16} /></Link><small>Android app downloaded directly from this website.</small></article><article className="landing-panel learn-panel"><span className="eyebrow"><GraduationCap size={14} /> GLOBAL LEARNING</span><h2>Explore skills and opportunities</h2><p>Read practical guides on online work, digital skills and the opportunities available around the world.</p><Link className="button" to="/online-work">Explore our guides <ArrowRight size={16} /></Link><small>Guidance only — opportunities and outcomes vary.</small></article></section>
      <section id="questions" className="public-section faq-section"><span className="landing-anchor" id="faq" aria-hidden="true" /><div><span className="eyebrow">FAQ</span><h2>Questions, answered.</h2><p className="faq-intro">What people ask before they get started.</p></div><div className="faq-list">{questions.map(([q, a], i) => <article id={i === 1 ? 'fees' : undefined} key={q}><button aria-expanded={openFaq === i} aria-controls={`faq-${i}`} onClick={() => setOpenFaq(openFaq === i ? null : i)}>{q}<span>{openFaq === i ? '−' : '+'}</span></button>{openFaq === i && <p id={`faq-${i}`}>{a}</p>}</article>)}</div></section>
      <section className="landing-cta"><span className="eyebrow"><Globe2 size={15} /> LIPAHUB GLOBAL</span><h2>Join LipaHub today.</h2><p>Learn, connect and explore from anywhere. Create an account to get started.</p><Link className="button" to="/register">Create Your Account <ArrowRight size={18} /></Link></section>
    </main><footer className="public-footer"><Logo /><p>Learn. Connect. Explore.</p><div><Link to="/about">About</Link><Link to="/global">Global</Link><Link to="/east-africa">East Africa</Link><Link to="/online-work">Online work</Link><Link to="/business">Business</Link><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/login">Member sign in</Link></div><small>© {new Date().getFullYear()} LipaHub · Global platform</small></footer>
  </div>
}

export function Legal() {
  const privacy = useLocation().pathname === '/privacy'
  return <main className="document-page"><Logo /><Panel title={privacy ? 'Privacy notice' : 'Terms of use'}><div className="document-body"><p>{privacy ? 'This notice explains how LipaHub handles account information, browser preferences and service data.' : 'These terms explain the rules for using LipaHub, including accounts, educational simulations, community features and available services.'}</p>{privacy ? <><h3>Account information</h3><p>When you create an account, LipaHub stores your display name, username, email, telephone number, country and account metadata in the configured Supabase project. Passwords are handled by Supabase Auth and are not stored in plain text by LipaHub.</p><h3>Browser storage</h3><p>Theme, language and local workspace preferences are stored in your browser. Supabase Auth keeps your signed-in session in browser storage and refreshes it while you remain signed in. Signing out removes the local session. Clearing site data removes saved preferences and any browser-local practice records.</p><h3>Payment information</h3><p>Payment services are not live yet. When payment workflows become available, submitted proof metadata and private screenshots will be stored in the configured Supabase project and will be accessible only to the submitting account and authorized administrators.</p><h3>Community data</h3><p>Practice lounge messages stay in your browser and are cleared when you leave the page. Live community messages, reporting and moderation will be covered by additional safeguards when those features become available.</p><h3>Cookies</h3><p>LipaHub does not use advertising or tracking cookies. Authentication uses browser storage provided by Supabase Auth.</p><h3>Contact</h3><p>Questions about privacy can be sent to <a className="text-link" href="mailto:lipahubsupport@gmail.com">lipahubsupport@gmail.com</a>. We may update this notice as the service develops.</p></> : <><h3>Educational use</h3><p>Trading simulations use illustrative prices and virtual funds. They do not execute trades and do not predict future results. There are no guaranteed earnings.</p><h3>Available services</h3><p>Deposits, withdrawals, rewards and purchases are not live yet. Community matching and reward eligibility are being prepared. Practice messages are not delivered to other people.</p><h3>Account use</h3><p>Use accurate information when creating an account. Keep your password secure and do not misuse community features. LipaHub may suspend accounts that violate these terms or applicable law.</p><h3>No guarantees</h3><p>LipaHub does not guarantee jobs, income, investment returns or visa outcomes. Any opportunity you evaluate should be independently verified.</p><h3>Contact</h3><p>Questions about these terms can be sent to <a className="text-link" href="mailto:lipahubsupport@gmail.com">lipahubsupport@gmail.com</a>.</p></>}<Link className="button secondary" to="/register">Back to registration</Link></div></Panel><Languages /></main>
}
export function NotFound() {
  return <main className="empty-page"><Logo /><span className="eyebrow">404</span><h1>A little off the path.</h1><p>That page doesn’t exist. Let’s get you back to LipaHub.</p><Link className="button primary" to="/">Go home <ArrowRight size={16} /></Link></main>
}
