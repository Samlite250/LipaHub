export type BackendConfig = {
  host: string; port: number; webOrigin: string; trustProxy: number; upstreamTimeoutMs: number
  supabaseUrl: string; anonKey: string; serviceKey: string; proofIntake: boolean; withdrawalRequests: boolean
}
function invalid(name: string): never { throw new Error(`Invalid ${name}. Check Backend/.env and docs/LIVE_SETUP.md.`) }
function number(value: string | undefined, fallback: number, min: number, max: number, name: string) {
  if (value === undefined || value === '') return fallback
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) invalid(name)
  return Number(value)
}
function keyRole(key: string) {
  try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role }
  catch { return null }
}
export function readConfig(env: NodeJS.ProcessEnv = process.env): BackendConfig {
  const supabaseUrl = env.SUPABASE_URL?.trim() || ''
  const anonKey = env.SUPABASE_ANON_KEY?.trim() || ''
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim() || ''
  let webOrigin = env.WEB_ORIGIN || 'http://127.0.0.1:5173'
  try {
    const url = new URL(webOrigin)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) invalid('WEB_ORIGIN')
    if (env.NODE_ENV === 'production' && url.protocol !== 'https:') invalid('WEB_ORIGIN (HTTPS required in production)')
    webOrigin = url.origin
  } catch { invalid('WEB_ORIGIN') }
  if (supabaseUrl) {
    try {
      const url = new URL(supabaseUrl)
      const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
      if (!(url.protocol === 'https:' || (env.NODE_ENV !== 'production' && local && url.protocol === 'http:')) || url.username || url.password || url.pathname !== '/' || url.search || url.hash) invalid('SUPABASE_URL')
    } catch { invalid('SUPABASE_URL') }
  }
  if (!!supabaseUrl !== !!anonKey || (serviceKey && !supabaseUrl)) invalid('Supabase URL/key combination')
  if (anonKey && !(anonKey.startsWith('sb_publishable_') || keyRole(anonKey) === 'anon')) invalid('SUPABASE_ANON_KEY (public key required)')
  if (serviceKey && !(serviceKey.startsWith('sb_secret_') || keyRole(serviceKey) === 'service_role')) invalid('SUPABASE_SERVICE_ROLE_KEY (server key required)')
  if (env.PAYMENT_PROOF_INTAKE_ENABLED && !['true', 'false'].includes(env.PAYMENT_PROOF_INTAKE_ENABLED)) invalid('PAYMENT_PROOF_INTAKE_ENABLED')
  if (env.PAYMENT_PROOF_INTAKE_ENABLED === 'true' && (!anonKey || !serviceKey)) invalid('PAYMENT_PROOF_INTAKE_ENABLED (configure both Supabase clients first)')
  if (env.WITHDRAWAL_REQUESTS_ENABLED && !['true', 'false'].includes(env.WITHDRAWAL_REQUESTS_ENABLED)) invalid('WITHDRAWAL_REQUESTS_ENABLED')
  if (env.WITHDRAWAL_REQUESTS_ENABLED === 'true' && (!anonKey || !serviceKey)) invalid('WITHDRAWAL_REQUESTS_ENABLED (configure both Supabase clients first)')
  return {
    host: env.HOST || '127.0.0.1', port: number(env.PORT, 3001, 1, 65535, 'PORT'), webOrigin,
    trustProxy: number(env.TRUST_PROXY_HOPS, 0, 0, 5, 'TRUST_PROXY_HOPS'),
    upstreamTimeoutMs: number(env.UPSTREAM_TIMEOUT_MS, 10000, 1000, 30000, 'UPSTREAM_TIMEOUT_MS'),
    supabaseUrl, anonKey, serviceKey, proofIntake: env.PAYMENT_PROOF_INTAKE_ENABLED === 'true',
    withdrawalRequests: env.WITHDRAWAL_REQUESTS_ENABLED === 'true',
  }
}
