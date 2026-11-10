import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import { Gamepad2, LogOut, Settings, UserRound, Wallet } from 'lucide-react'
import { useApp } from './state'

export function AccountMenu({ openSettings, logout }: { openSettings: () => void; logout: () => Promise<void> }) {
  const { t, demo } = useApp()
  const [open, setOpen] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    menu.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    const outside = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); setOpen(false); trigger.current?.focus(); return }
    const items = [...(menu.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') || [])]
    const index = items.indexOf(document.activeElement as HTMLElement)
    if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
      event.preventDefault()
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length
      items[next]?.focus()
    }
  }
  return <div className="account-menu-container" ref={container} onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false)
  }}>
    <button className="header-settings" ref={trigger} aria-label="Open account menu" aria-haspopup="menu" aria-expanded={open} aria-controls="account-menu" onClick={() => setOpen(!open)} onKeyDown={event => {
      if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true) }
    }}><Settings size={19} /></button>
    {open && <div id="account-menu" className="account-menu" ref={menu} role="menu" aria-label="Account" onKeyDown={keyboard}>
      <Link role="menuitem" to="/dashboard/profile" onClick={() => setOpen(false)}><UserRound size={16} /><span>{t('profile')}</span></Link>
      <Link role="menuitem" to="/dashboard/deposit" onClick={() => setOpen(false)}><Wallet size={16} /><span>{t('deposit')}</span>{demo && <span className="account-menu-badge" title="Deposit">25</span>}</Link>
      <Link role="menuitem" to="/dashboard/games" onClick={() => setOpen(false)}><Gamepad2 size={16} /><span>Games</span></Link>
      <button role="menuitem" onClick={() => { setOpen(false); openSettings() }}><Settings size={16} /><span>{t('settings')}</span></button>
      <button role="menuitem" onClick={() => { setOpen(false); void logout() }}><LogOut size={16} /><span>{t('logout')}</span></button>
    </div>}
  </div>
}
