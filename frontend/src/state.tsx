/* Context values and hook live together to keep session changes in one place. */
/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { dictionary, type Language, type TranslationKey } from './i18n'
import { supabase } from './lib/supabase'
import { demoEnabled } from './lib/platform'
import { normalizeCountry } from './domain/countries'
import { activateRobot, restoreRobotActivations, ROBOT_CATALOG_VERSION, type RobotActivations } from './domain/robots'

type DemoProfile = { id: string; name: string; country: string; robotIdsByCountry: RobotActivations; robotCatalogVersion: string }
type ContextValue = {
  language: Language; setLanguage: (l: Language) => void; t: (key: TranslationKey) => string
  dark: boolean; setDark: (b: boolean) => void
  demo: DemoProfile | null; startDemo: (country?: string) => void; updateDemo: (p: Pick<DemoProfile, 'name' | 'country'>) => void
  activateDemoRobot: (id: string) => void; resetDemoRobots: () => void
  session: Session | null; loading: boolean; signOut: () => Promise<void>
}
const Context = createContext<ContextValue | null>(null)

function readDemo(): DemoProfile | null {
  if (!demoEnabled) { sessionStorage.removeItem('lipahub-demo'); return null }
  try {
    const parsed = JSON.parse(sessionStorage.getItem('lipahub-demo') || 'null')
    return parsed && typeof parsed.name === 'string' && typeof parsed.country === 'string'
      ? { id: typeof parsed.id === 'string' ? parsed.id : crypto.randomUUID(), name: parsed.name, country: normalizeCountry(parsed.country) || 'Rwanda', robotIdsByCountry: parsed.robotCatalogVersion === ROBOT_CATALOG_VERSION ? restoreRobotActivations(parsed.robotIdsByCountry) : {}, robotCatalogVersion: ROBOT_CATALOG_VERSION } : null
  } catch { return null }
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('lipahub-language') === 'rw' ? 'rw' : 'en')
  const [dark, setDark] = useState(() => localStorage.getItem('lipahub-theme') === 'dark')
  const [demo, setDemo] = useState<DemoProfile | null>(readDemo)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(!!supabase)
  useEffect(() => {
    const client = supabase
    if (!client) return
    let active = true
    const applySession = (next: Session | null) => {
      if (!active) return
      setSession(next); setLoading(false)
      if (next) { setDemo(null); sessionStorage.removeItem('lipahub-demo') }
    }
    void client.auth.getSession().then(({ data }) => applySession(data.session)).catch(() => { if (active) setLoading(false) })
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, next) => applySession(next))
    const syncSession = (event: StorageEvent) => {
      if (!event.key?.includes('-auth-token')) return
      void client.auth.getSession().then(({ data }) => applySession(data.session))
    }
    window.addEventListener('storage', syncSession)
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener('storage', syncSession) }
  }, [])
  useEffect(() => { localStorage.setItem('lipahub-language', language); document.documentElement.lang = language }, [language])
  useEffect(() => { localStorage.setItem('lipahub-theme', dark ? 'dark' : 'light'); document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])
  useEffect(() => {
    if (demo) sessionStorage.setItem('lipahub-demo', JSON.stringify(demo))
    else sessionStorage.removeItem('lipahub-demo')
  }, [demo])
  const updateDemo = (profile: Pick<DemoProfile, 'name' | 'country'>) => {
    setDemo(previous => previous ? { ...previous, ...profile, country: normalizeCountry(profile.country) || 'Rwanda' } : null)
  }
  const activateDemoRobot = (id: string) => {
    setDemo(previous => {
      if (!previous) return null
      const country = normalizeCountry(previous.country)
      if (!country) return previous
      return { ...previous, robotIdsByCountry: { ...previous.robotIdsByCountry, [country]: activateRobot(previous.robotIdsByCountry[country] || [], id, country) } }
    })
  }
  const resetDemoRobots = () => {
    setDemo(previous => previous ? { ...previous, robotIdsByCountry: { ...previous.robotIdsByCountry, [previous.country]: [] } } : null)
  }
  const signOut = async () => {
    if (supabase && session) {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
    }
    setSession(null); setDemo(null); sessionStorage.removeItem('lipahub-demo')
  }
  return <Context.Provider value={{ language, setLanguage, t: key => dictionary[language][key], dark, setDark,
    demo, startDemo: (country = 'Rwanda') => { if (demoEnabled) setDemo({ id: crypto.randomUUID(), name: 'Alex', country: normalizeCountry(country) || 'Rwanda', robotIdsByCountry: {}, robotCatalogVersion: ROBOT_CATALOG_VERSION }) }, updateDemo,
    activateDemoRobot, resetDemoRobots, session, loading, signOut }}>{children}</Context.Provider>
}

export function useApp() {
  const value = useContext(Context)
  if (!value) throw new Error('AppProvider is required')
  return value
}
