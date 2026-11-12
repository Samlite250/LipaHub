import { expect, test } from '@playwright/test'
import { accountDestination } from '../frontend/src/lib/auth-navigation'

test('trusted administrators land in admin and members retain their requested dashboard page', () => {
  const admin = { app_metadata: { role: 'admin' } }
  const member = { app_metadata: {}, user_metadata: { role: 'admin' } }
  expect(accountDestination(admin)).toBe('/admin')
  expect(accountDestination(admin, '/dashboard')).toBe('/admin')
  expect(accountDestination(admin, '/admin/support')).toBe('/admin/support')
  expect(accountDestination(member)).toBe('/dashboard')
  expect(accountDestination(member, '/dashboard/support')).toBe('/dashboard/support')
  expect(accountDestination(member, '/admin')).toBe('/dashboard')
  expect(accountDestination({app_metadata: {activation_required: true}}, '/dashboard/profile')).toBe('/activate-account')
  expect(accountDestination({app_metadata: {role: 'admin', activation_required: true}})).toBe('/admin')
})

test('sign-in destinations reject external URLs and paths outside the intended route', () => {
  for (const requested of ['https://example.com', '//example.com', '/administrator', '/dashboard-other', null, 123]) {
    expect(accountDestination({ app_metadata: { role: 'admin' } }, requested)).toBe('/admin')
    expect(accountDestination(null, requested)).toBe('/dashboard')
  }
})
