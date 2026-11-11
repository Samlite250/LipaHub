import type { User } from '@supabase/supabase-js'

export function accountDestination(user: Pick<User, 'app_metadata'> | null, requested?: unknown) {
  const root = user?.app_metadata?.role === 'admin' ? '/admin' : '/dashboard'
  return typeof requested === 'string' && (requested === root || requested.startsWith(`${root}/`)) ? requested : root
}
