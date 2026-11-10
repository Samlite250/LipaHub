import type { Country } from './countries'
export type ManagedUser = { id: string; name: string; email: string; phone: string; country: Country; role: 'admin' | 'member'; status: 'active' | 'suspended'; createdAt: string; updatedAt: string; lastSignInAt: string | null }
export type UserDraft = Pick<ManagedUser, 'name' | 'email' | 'phone' | 'country' | 'role' | 'status'> & { password?: string; updatedAt?: string }
export type Collection = 'resources' | 'announcements'
export type ContentRecord = { id: string; collection: Collection; title: string; description: string; category: 'courses' | 'articles' | 'ebooks' | 'announcement'; status: 'draft' | 'published'; url: string; country: Country | 'All countries'; version: number; createdAt: string; updatedAt: string }
export type ContentDraft = Omit<ContentRecord, 'id' | 'collection' | 'version' | 'createdAt' | 'updatedAt'>
export type SiteSettings = { siteName: string; supportEmail: string; supportMessage: string; showAnnouncements: boolean; version: number }
export type AuditRecord = { id: string | number; actor_id: string; action: string; target_id: string; outcome: 'started' | 'succeeded' | 'failed'; created_at: string }
export const defaultSettings: SiteSettings = { siteName: 'LipaHub', supportEmail: '', supportMessage: '', showAnnouncements: true, version: 1 }
