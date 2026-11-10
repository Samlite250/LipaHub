import { Panel } from './components'
import { useApp } from './state'
import './ServiceBalance.css'

const services = [
  { label: 'Chat & Teaching Earnings', icon: 'chat', tile: 'green', amount: 'green' },
  { label: 'Whatsapp Earnings', icon: 'shopping-bag', tile: 'teal', amount: 'red' },
  { label: 'Deposit Balance', icon: 'shopping-bag', tile: 'teal', amount: 'red' },
  { label: 'Ads Earnings', icon: 'archive', tile: 'blue', amount: 'green' },
  { label: 'TikTok Earnings', icon: 'cart', tile: 'yellow', amount: 'red' },
  { label: 'Youtube Earnings', icon: 'storefront', tile: 'red', amount: 'green' },
  { label: 'Survey Earnings', icon: 'survey', tile: 'green', amount: 'red' },
  { label: 'Blog Earnings', icon: 'gamepad', tile: 'pink', amount: 'red' },
]

export function ServiceBalance({ value }: { value: string }) {
  const { t } = useApp()
  return <Panel title={t('service')} className="service-balance-card"><dl className="service-balance-rows">{services.map(service => <div className="service-balance-row" key={service.label}><dt><span className={`service-balance-icon service-tile-${service.tile}`}><img src={`/icons/service-balance/${service.icon}.svg`} alt="" width={20} height={20} /></span><span>{service.label}</span></dt><dd className={`service-amount-${service.amount}`}>{value}</dd></div>)}</dl></Panel>
}
