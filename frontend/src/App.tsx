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

function MemberRoute() {
  const { session, demo, loading } = useApp()
  const location = useLocation()
  if (loading) return <div className="loading-page" role="status">Opening LipaHub…</div>
  return session || demo ? <DashboardLayout /> : <Navigate to="/login" state={{ from: location.pathname }} replace />
}
export function App() {
  const location = useLocation()
  useEffect(() => { invitationReference(location.search) }, [location.search])
  useEffect(() => { window.scrollTo(0, 0); document.title = `${location.pathname === '/' ? 'Learn. Connect. Explore.' : location.pathname.split('/').filter(Boolean).pop()?.replaceAll('-', ' ')} | LipaHub` }, [location.pathname])
  return <Routes>
    <Route path="/" element={new URLSearchParams(location.search).has('ref') ? <Navigate to={{ pathname: '/register', search: location.search, hash: location.hash }} replace /> : <Landing />} />
    <Route path="/i/:code" element={<ShortInvitation />} />
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
    {['payments', 'users', 'resources', 'announcements', 'settings', 'audit', 'support'].map(section => <Route key={section} path={`/admin/${section}`} element={<AdminPayments />} />)}
    <Route path="*" element={<NotFound />} />
  </Routes>
}
