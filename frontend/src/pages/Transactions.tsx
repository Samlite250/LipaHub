import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useApp } from '../state'
import { normalizeCountry } from '../domain/countries'
import { walletMoney, type AccountBalance, type BalanceEntry } from '../domain/balances'
import { getBalance } from '../lib/balances'
import { platformApi } from '../lib/platform'

type History = { wallet: AccountBalance; history: Pick<BalanceEntry, 'id' | 'currency' | 'availableBefore' | 'availableAfter' | 'bonusBefore' | 'bonusAfter' | 'createdAt'>[] }
export function TransactionsPage() {
  const { session, demo } = useApp()
  const token = session?.access_token; const id = demo?.id
  const country = normalizeCountry(demo?.country || session?.user.user_metadata.country) || 'International'
  const [data, setData] = useState<History | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(true); const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true; setLoading(true); setData(null); setError('')
    const request = id ? getBalance({ demoId: id }, id, country) : token ? platformApi<History>(token, `/api/member-balances?country=${encodeURIComponent(country)}&history=true`) : Promise.reject(new Error('Sign in to view your history.'))
    request.then(value => { if (active) setData(value) }).catch(err => { if (active) setError(err.message) }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [token, id, country, revision])
  return <section className="panel"><div className="support-heading" style={{ padding: 24 }}><div><span className="eyebrow">{demo ? 'VIRTUAL ACCOUNT' : 'YOUR ACCOUNT'}</span><h2>Balance history</h2><p>{country} · Latest 100 balance adjustments</p></div><button className="button secondary small" disabled={loading} onClick={() => setRevision(value => value + 1)}><RefreshCw size={14} />Refresh</button></div>{loading ? <p role="status" style={{ padding: 24 }}>Loading history…</p> : error ? <p className="form-error" role="alert">{error}</p> : data && <><div className="notice"><p>Available: <strong>{walletMoney(data.wallet.availableMinor, data.wallet.currency)}</strong> · Bonus: <strong>{walletMoney(data.wallet.bonusMinor, data.wallet.currency)}</strong>. This history records account balance corrections. Payment-proof submissions do not confirm funds received.</p></div>{data.history.length ? <div className="admin-table-scroll"><table className="admin-table"><thead><tr><th>Date</th><th>Available change</th><th>Bonus change</th><th>Balance after</th><th>Record</th></tr></thead><tbody>{data.history.map(row => <tr key={row.id}><td>{new Date(row.createdAt).toLocaleString()}</td><td>{walletMoney(row.availableAfter - row.availableBefore, row.currency)}</td><td>{walletMoney(row.bonusAfter - row.bonusBefore, row.currency)}</td><td>{walletMoney(row.availableAfter, row.currency)}</td><td style={{ overflowWrap: 'anywhere' }}>{row.id}</td></tr>)}</tbody></table></div> : <div className="support-empty"><h3>No balance changes yet</h3><p>Your saved account balance changes will appear here.</p></div>}</>}</section>
}
