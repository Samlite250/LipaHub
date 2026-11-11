export class AdminInputError extends Error { status = 400 }
export { countries as adminCountries } from '../countries.js'
import { countries as adminCountries } from '../countries.js'
export function text(value: unknown, label: string, max: number, min = 0) {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max || [...value].some(char => char.charCodeAt(0) < 32 && ![9, 10, 13].includes(char.charCodeAt(0)))) throw new AdminInputError(`Enter a valid ${label} (${min}–${max} characters).`)
  return value.trim()
}
function choice(value: unknown, options: string[], label: string) {
  if (typeof value !== 'string' || !options.includes(value)) throw new AdminInputError(`Select a valid ${label}.`)
  return value
}
export function userInput(body: Record<string, unknown>, create = false) {
  const email = text(body.email, 'email address', 254, 3).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AdminInputError('Enter a valid email address.')
  const phone = text(body.phone || '', 'phone number', 16)
  if (phone && !/^\+[1-9]\d{6,14}$/.test(phone)) throw new AdminInputError('Use a phone number including its country code.')
  const value = { email, phone, name: text(body.name, 'display name', 120, 2), country: choice(body.country, adminCountries, 'country'), role: choice(body.role, ['member', 'admin'], 'role'), status: choice(body.status, ['active', 'suspended'], 'account status') }
  if (create && (typeof body.password !== 'string' || body.password.length < 8 || body.password.length > 128)) throw new AdminInputError('Use an initial password between 8 and 128 characters.')
  return value
}
export function recordInput(body: Record<string, unknown>, collection: string) {
  choice(collection, ['resources', 'announcements'], 'collection')
  const title = text(body.title, 'title', 160, 2)
  const description = text(body.description, 'description', 8000, 2)
  const status = choice(body.status, ['draft', 'published'], 'publication status')
  const category = collection === 'resources' ? choice(body.category, ['courses', 'articles', 'ebooks'], 'resource category') : 'announcement'
  const url = text(body.url || '', 'link', 2000)
  if (url) { try { const parsed = new URL(url); if (parsed.protocol !== 'https:' || parsed.username || parsed.password) throw new Error() } catch { throw new AdminInputError('Links must use HTTPS and cannot contain credentials.') } }
  return { title, description, category, status, url, country: choice(body.country, ['All countries', ...adminCountries], 'audience') }
}
export function settingsInput(body: Record<string, unknown>) {
  const siteName = text(body.siteName, 'site name', 60, 2)
  const supportEmail = text(body.supportEmail || '', 'support email', 254)
  if (supportEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(supportEmail)) throw new AdminInputError('Enter a valid support email.')
  if (typeof body.showAnnouncements !== 'boolean') throw new AdminInputError('Invalid announcement setting.')
  return { siteName, supportEmail, supportMessage: text(body.supportMessage || '', 'support message', 1500), showAnnouncements: body.showAnnouncements }
}
export function version(value: unknown) { if (!Number.isInteger(value) || Number(value) < 1) throw new AdminInputError('Reload this record before saving.'); return Number(value) }
export function uuid(value: unknown) { if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) throw new AdminInputError('Invalid record ID.'); return value }
