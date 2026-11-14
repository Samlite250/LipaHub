import { Link } from 'react-router-dom'
import { X, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'
import { useApp } from './state'

export function Logo({ compact = false }: { compact?: boolean }) {
  return <Link to="/" className={`logo ${compact ? 'compact' : ''}`} aria-label="LipaHub home"><img src="/favicon.svg" alt="" width="36" height="36" /><span>LipaHub</span></Link>
}
export function Languages() {
  const { language, setLanguage } = useApp()
  return <div className="language-buttons" aria-label="Language"><button type="button" aria-pressed={language === 'en'} onClick={() => setLanguage('en')}>English</button><button type="button" aria-pressed={language === 'rw'} onClick={() => setLanguage('rw')}>Kinyarwanda</button><button type="button" aria-pressed={language === 'lg'} onClick={() => setLanguage('lg')}>Luganda</button><button type="button" aria-pressed={language === 'sw'} onClick={() => setLanguage('sw')}>Kiswahili</button></div>
}
export function IconChip({ icon: Icon, color = 'teal' }: { icon: LucideIcon; color?: string }) {
  return <span className={`icon-chip ${color}`}><Icon size={18} strokeWidth={1.8} /></span>
}
export function Panel({ title, children, action, className = '' }: { title: string; children: ReactNode; action?: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}><div className="panel-heading"><h2>{title}</h2>{action}</div>{children}</section>
}
export function Modal({ title, children, close }: { title: string; children: ReactNode; close: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => { const dialog = ref.current; dialog?.showModal(); return () => dialog?.close() }, [])
  return <dialog ref={ref} className="modal" onCancel={event => { event.preventDefault(); close() }} onClick={e => { if (e.target === e.currentTarget) close() }}><div className="modal-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={20} /></button></div>{children}</dialog>
}
