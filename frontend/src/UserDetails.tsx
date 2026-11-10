import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { Panel } from './components'
import { useApp } from './state'
import './UserDetails.css'

export function UserDetails() {
  const { demo, session } = useApp()
  const [open, setOpen] = useState(false)
  const id = useId()
  const metadata = session?.user.user_metadata
  const name = demo?.name || (typeof metadata?.display_name === 'string' && metadata.display_name) || 'Member'
  const phone = typeof metadata?.phone === 'string' && metadata.phone.trim() ? metadata.phone : 'Not provided'
  const rows = [
    { label: 'Username', value: name, color: '#14b8a6' },
    { label: 'Active Referrals', value: demo ? '10' : 'Unavailable', color: '#22c394' },
    { label: 'Mobile', value: phone, color: '#38bdf8' },
    { label: 'Email', value: session?.user.email || 'Not provided', color: '#f4513d' },
  ]
  return <Panel title="User Details" className="user-details-panel">
    <button type="button" className="user-details-toggle" aria-expanded={open} aria-controls={id} onClick={() => setOpen(value => !value)}><span>Click to view</span><ChevronDown size={14} /></button>
    <div id={id} className="user-details-collapse" data-open={open} inert={!open} aria-hidden={!open}><div className="user-details-content"><dl>{rows.map(row => <div key={row.label}><dt><span style={{ background: row.color }} aria-hidden="true" />{row.label}</dt><dd>{row.value}</dd></div>)}</dl></div></div>
  </Panel>
}
