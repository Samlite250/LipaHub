import { InstallAppButton } from './InstallApp'
import { useApp } from './state'

export function WalletWelcome() {
  const { t, demo } = useApp()
  return <div className="wallet-welcome">{t('appWelcome')} {' '}
    <InstallAppButton label={t('clickHere')} className="wallet-install-link" /> {t('getApp')}
    {demo && <span className="wallet-demo-note">Virtual balances</span>}
  </div>
}
