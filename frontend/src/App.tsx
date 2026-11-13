import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { useApp } from './state'
import { AuthPage, ResetPassword } from './pages/Auth'
import { Landing, Legal, NotFound } from './pages/Landing'
import { DashboardLayout, DashboardHome } from './pages/Dashboard'
import { FeaturePage, ProfilePage, PlannedPage } from './pages/Features'
import { RobotsPage } from './pages/Robots'
import { AdminPayments } from './pages/AdminPayments'
import { MemberContentPage } from './MemberContent'
import { SupportPage } from './pages/Support'
import { TransactionsPage } from './pages/Transactions'
import { DepositPage, VoucherPage, WithdrawPage, TeamPage } from './pages/AccountTabs'
import { ConversationPage } from './pages/Conversations'
import { invitationReference } from './lib/invitations'
import { ShortInvitation } from './ShortInvitation'
import { InstallAppPage } from './InstallApp'
import { AccountActivation } from './pages/AccountActivation'
import { useAccountActivation } from './lib/account-activation'
import { AboutPage, BusinessPage, EastAfricaPage, OnlineWorkPage } from './pages/Guides'
import { SeoManager } from './lib/seo'

function MemberRoute() {
  const { session, demo, loading } = useApp()
  const location = useLocation()
  const activation = useAccountActivation(session?.access_token, !!session && session.user.app_metadata?.role !== 'admin' && session.user.app_metadata?.activation_required === true)
  if (loading) return <div className="loading-page" role="status">Opening LipaHub…</div>
  if (activation.loading) return <div className="loading-page" role="status">Checking account activation…</div>
  if (activation.error) return <main className="loading-page"><p role="alert">{activation.error}</p><button className="button primary" onClick={activation.refresh}>Retry activation check</button></main>
  if (activation.data?.required && !activation.data.active) return <Navigate to="/activate-account" replace />
  return session || demo ? <DashboardLayout /> : <Navigate to="/login" state={{ from: location.pathname }} replace />
}
export function App() {
  const location = useLocation()
  useEffect(() => { invitationReference(location.search) }, [location.search])
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])
  return <><SeoManager /><Routes>
    <Route path="/" element={new URLSearchParams(location.search).has('ref') ? <Navigate to={{ pathname: '/register', search: location.search, hash: location.hash }} replace /> : <Landing />} />
    <Route path="/i/:code" element={<ShortInvitation />} />
    <Route path="/about" element={<AboutPage />} />
    <Route path="/east-africa" element={<EastAfricaPage />} />
    <Route path="/online-work" element={<OnlineWorkPage />} />
    <Route path="/business" element={<BusinessPage />} />
    <Route path="/install" element={<InstallAppPage />} />
    <Route path="/activate-account" element={<AccountActivation />} />
    <Route path="/login" element={<AuthPage key="login" mode="login" />} />
    <Route path="/register" element={<AuthPage key="register" mode="register" />} />
    <Route path="/forgot-password" element={<AuthPage key="forgot" mode="forgot" />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/terms" element={<Legal />} /><Route path="/privacy" element={<Legal />} />
    <Route path="/dashboard" element={<MemberRoute />}>
      <Route index element={<DashboardHome />} />
      <Route path="robots" element={<RobotsPage />} />
      <Route path="trading" element={<FeaturePage kind="trading" />} />
      <Route path="chat" element={<FeaturePage kind="chat" />} />
      <Route path="profile" element={<ProfilePage />} />
      <Route path="support" element={<SupportPage />} />
      <Route path="transactions" element={<TransactionsPage />} />
      <Route path="deposit" element={<DepositPage />} />
      <Route path="voucher" element={<VoucherPage />} />
      <Route path="voucher/history" element={<VoucherPage />} />
      <Route path="withdraw" element={<WithdrawPage />} />
      <Route path="withdraw/:source" element={<WithdrawPage />} />
      <Route path="referrals" element={<TeamPage />} />
      <Route path="referrals/:level" element={<TeamPage />} />
      <Route path="referrals/:level/:status" element={<TeamPage />} />
      <Route path="language-teaching" element={<ConversationPage teaching />} />
      <Route path="foreigners" element={<ConversationPage />} />
      {(['courses', 'articles', 'ebooks', 'announcements'] as const).map(category => <Route key={category} path={category} element={<MemberContentPage category={category} />} />)}
<Route path=":feature" element={<PlannedPage />} />
    </Route>
    <Route path="/admin" element={<AdminPayments />} />
    {['payments', 'withdrawals', 'users', 'content', 'resources', 'announcements', 'settings', 'audit', 'support'].map(section => <Route key={section} path={`/admin/${section}`} element={<AdminPayments />} />)}
    <Route path="*" element={<NotFound />} />
  </Routes></>
}
