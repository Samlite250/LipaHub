import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Download, Smartphone } from 'lucide-react'
import { Logo, Modal } from './components'
import { useInstallApp } from './InstallAppContext'
import './InstallApp.css'

export function InstallAppButton({ label = 'Install LipaHub', className = 'button primary' }: { label?: string; className?: string }) {
  const { prompt, installed, clearPrompt } = useInstallApp()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  async function install() {
    setOpen(true)
    setMessage('')
    if (!prompt || installed) return
    setBusy(true)
    try {
      await prompt.prompt()
      const choice = await prompt.userChoice
      setMessage(choice.outcome === 'accepted' ? 'Complete the installation in your browser. Your LipaHub account and pages stay the same.' : 'Installation was cancelled. You can install LipaHub later from your browser menu.')
    } catch { setMessage('Use the steps below to install LipaHub from your browser.') }
    finally { clearPrompt(); setBusy(false) }
  }
  return <>
    <button type="button" className={className} onClick={() => void install()} disabled={busy}>{label}</button>
    {open && <Modal title={installed ? 'LipaHub is installed' : 'Install the LipaHub app'} close={() => setOpen(false)}>
      <div className="install-app-heading"><img src="/icons/app-192.png?v=2" width="56" height="56" alt="LipaHub app icon" /><p>The same LipaHub website, account and content, opened from your home screen.</p></div>
      {message && <p role="status" className="install-app-message">{message}</p>}
      {installed ? <p>Open LipaHub from your home screen or app list. You can also keep using this website.</p> : <>
        <ol className="install-app-steps">
          <li><strong>Android</strong><span>Open your browser menu (⋮), choose <b>Install app</b> or <b>Add to Home screen</b>, then confirm.</span></li>
          <li><strong>iPhone or iPad</strong><span>Open this site in Safari. Tap <b>Share</b>, then <b>Add to Home Screen</b> and <b>Add</b>.</span></li>
          <li><strong>Computer</strong><span>In Chrome or Edge, use the install icon in the address bar, or choose <b>Install LipaHub</b> from the browser menu.</span></li>
        </ol>
        <p className="muted">If an install option is missing, open this page in a full browser instead of an in-app browser. An internet connection is needed to access your account and live content.</p>
      </>}
      <button type="button" className="button primary" onClick={() => setOpen(false)}>Done</button>
    </Modal>}
  </>
}
export function InstallAppPage() {
  return <main className="install-app-page"><Logo /><section className="panel install-app-panel">
    <span className="install-app-symbol"><Smartphone size={34} /></span><h1>LipaHub, on your home screen</h1>
    <p>Install the LipaHub web app to open the same website in its own app window. Your account, dashboard, resources, invitations and support stay connected.</p>
    <div className="install-app-actions"><Download size={20} /><InstallAppButton /></div>
    <Link className="text-link" to="/dashboard">Open LipaHub</Link>
  </section><Link to="/">Back to the website</Link></main>
}
