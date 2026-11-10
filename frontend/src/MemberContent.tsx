/* Provider and hooks share the member content lifecycle. */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowUpRight, BookOpen, Mail, Megaphone, RefreshCw } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useApp } from './state'
import { defaultSettings, type ContentRecord, type SiteSettings } from './domain/admin'
import { memberContent } from './lib/admin'
import type { PaymentAccess } from './domain/payments'
import './MemberContent.css'

const Context = createContext<{ records: ContentRecord[]; settings: SiteSettings; loading: boolean; error: string; refresh: () => void }>({ records: [], settings: defaultSettings, loading: false, error: '', refresh: () => {} })
export function MemberContentProvider({ children }: { children: ReactNode }) {
  const { demo, session } = useApp()
  const id = demo?.id; const token = session?.access_token; const country = demo?.country || session?.user.user_metadata.country || ''
  const access = useMemo<PaymentAccess | null>(() => id ? { demoId: id } : token ? { accessToken: token } : null, [id, token])
  const [records, setRecords] = useState<ContentRecord[]>([]); const [settings, setSettings] = useState(defaultSettings); const [loading, setLoading] = useState(true); const [error, setError] = useState(''); const [revision, setRevision] = useState(0)
  useEffect(() => {
    if (!access) { setLoading(false); return }
    let active = true; setLoading(true); setError(''); setRecords([]); setSettings(defaultSettings)
    memberContent(access, country).then(value => { if (active) { setRecords(value.records); setSettings(value.settings) } }).catch(error => { if (active) setError(error.message || 'Member content is unavailable.') }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [access, country, revision])
  return <Context.Provider value={{ records, settings, loading, error, refresh: () => setRevision(value => value + 1) }}>{children}</Context.Provider>
}
export function useMemberContent() { return useContext(Context) }
function safeUrl(url: string) { try { const parsed = new URL(url); return parsed.protocol === 'https:' && !parsed.username && !parsed.password ? parsed.href : null } catch { return null } }
function ContentCards({ rows }: { rows: ContentRecord[] }) {
  return <div className="member-content-grid">{rows.map(row => <article className="panel member-content-card" key={row.id}><span className={`icon-chip ${row.collection === 'announcements' ? 'pink' : 'indigo'}`}>{row.collection === 'announcements' ? <Megaphone size={21} /> : <BookOpen size={21} />}</span><span className="member-content-category">{row.category}</span><h2>{row.title}</h2><p>{row.description}</p>{safeUrl(row.url) && <a className="text-link" href={safeUrl(row.url)!} target="_blank" rel="noopener noreferrer">Open {row.collection === 'resources' ? 'resource' : 'link'}<ArrowUpRight size={14} /></a>}</article>)}</div>
}
export function DashboardAnnouncements() {
  const { records, settings } = useMemberContent()
  const rows = records.filter(row => row.collection === 'announcements')
  if (!settings.showAnnouncements || !rows.length) return null
  return <section className="member-announcements"><div><h2><Megaphone size={18} />Latest announcements</h2>{rows.length > 3 && <Link className="text-link" to="/dashboard/announcements">View all</Link>}</div><ContentCards rows={rows.slice(0, 3)} /></section>
}
export function MemberContentPage({ category }: { category: 'courses' | 'articles' | 'ebooks' | 'announcements' | 'support' }) {
  const { records, settings, loading, error, refresh } = useMemberContent()
  const title = category === 'support' ? 'Member support' : category.charAt(0).toUpperCase() + category.slice(1)
  const rows = records.filter(row => category === 'announcements' ? row.collection === 'announcements' && settings.showAnnouncements : row.collection === 'resources' && row.category === category)
  return <section className="member-managed-page"><div className="member-content-heading"><div><span className="eyebrow">{category === 'support' ? settings.siteName : 'YOUR MEMBER WORKSPACE'}</span><h1>{title}</h1><p>{category === 'support' ? 'Find the right way to reach our team.' : 'Published updates and resources from your LipaHub team.'}</p></div><button className="button secondary small" disabled={loading} onClick={refresh}><RefreshCw size={14} />Refresh</button></div>{loading ? <p role="status" className="muted">Loading…</p> : error ? <p className="form-error" role="alert">{error}</p> : category === 'support' ? <div className="panel member-support-card"><span className="icon-chip teal"><Mail size={23} /></span><h2>How can we help?</h2><p>{settings.supportMessage || 'Support contact details have not been published yet. Please check again later.'}</p>{settings.supportEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.supportEmail) && <a className="button primary" href={`mailto:${encodeURIComponent(settings.supportEmail)}`}>Email support<ArrowUpRight size={15} /></a>}</div> : rows.length ? <ContentCards rows={rows} /> : <div className="panel member-content-empty"><BookOpen size={34} /><h2>No published {category} yet</h2><p>New content for your country will appear here when published.</p></div>}</section>
}
