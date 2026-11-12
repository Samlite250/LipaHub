/* Installation events can arrive before a member opens the dashboard. */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export interface InstallPrompt extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}
type InstallState = { prompt: InstallPrompt | null; installed: boolean; clearPrompt: () => void }
const Context = createContext<InstallState | null>(null)
export function InstallAppProvider({ children }: { children: ReactNode }) {
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true)
  useEffect(() => {
    const available = (event: Event) => { event.preventDefault(); setPrompt(event as InstallPrompt) }
    const complete = () => { setInstalled(true); setPrompt(null) }
    window.addEventListener('beforeinstallprompt', available)
    window.addEventListener('appinstalled', complete)
    return () => { window.removeEventListener('beforeinstallprompt', available); window.removeEventListener('appinstalled', complete) }
  }, [])
  return <Context.Provider value={{ prompt, installed, clearPrompt: () => setPrompt(null) }}>{children}</Context.Provider>
}
export function useInstallApp() {
  const state = useContext(Context)
  if (!state) throw new Error('App installation requires InstallAppProvider')
  return state
}
