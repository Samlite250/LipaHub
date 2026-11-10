import deployment from './deployment.json' with { type: 'json' }

// Called only by the Node build/runtime, never shipped as a browser module.
// Only the validated public values returned here are embedded in the frontend.
export function publicSupabase(env) {
  const key = (env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_ANON_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim()
  if (key) {
    let role
    try { role = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role } catch { /* Publishable keys are not JWTs. */ }
    if (!key.startsWith('sb_publishable_') && role !== 'anon') throw new Error('The Supabase public-key setting must contain a publishable/anon key. Server secrets cannot be embedded in the frontend.')
  }
  const url = (env.VITE_SUPABASE_URL || env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || (key ? deployment.supabaseUrl : '')).trim()
  return { url, key }
}
