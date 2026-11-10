import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parse } from 'dotenv'

const root = new URL('../../', import.meta.url)
const load = path => { try { return parse(readFileSync(new URL(path, root))) } catch { return {} } }
const front = { ...load('frontend/.env'), ...load('frontend/.env.local'), ...load('frontend/.env.production'), ...load('frontend/.env.production.local'), ...process.env }
const back = { ...load('Backend/.env'), ...process.env }
let failures = 0
function check(name, ok) { console.log(`${ok ? 'OK' : 'MISSING/INVALID'}  ${name}`); if (!ok) failures++ }
function url(value, https = false) { try { const parsed = new URL(value); return (https ? parsed.protocol === 'https:' : ['https:', 'http:'].includes(parsed.protocol)) && !parsed.username && !parsed.password && parsed.pathname === '/' && !parsed.search && !parsed.hash } catch { return false } }
function role(key) { try { return JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString()).role } catch { return null } }
check('frontend Supabase URL (HTTPS)', url(front.VITE_SUPABASE_URL, true))
check('frontend publishable/anon key (never service role)', !!front.VITE_SUPABASE_ANON_KEY && !front.VITE_SUPABASE_ANON_KEY.startsWith('sb_secret_') && role(front.VITE_SUPABASE_ANON_KEY) !== 'service_role')
check('backend Supabase URL (HTTPS)', url(back.SUPABASE_URL, true))
check('frontend/backend use the same Supabase project', !!front.VITE_SUPABASE_URL && front.VITE_SUPABASE_URL.replace(/\/$/, '') === back.SUPABASE_URL?.replace(/\/$/, ''))
check('backend anon/publishable key', !!back.SUPABASE_ANON_KEY && !back.SUPABASE_ANON_KEY.startsWith('sb_secret_') && role(back.SUPABASE_ANON_KEY) !== 'service_role')
check('backend server-only service key', !!back.SUPABASE_SERVICE_ROLE_KEY && (back.SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_secret_') || role(back.SUPABASE_SERVICE_ROLE_KEY) === 'service_role'))
check('frontend API origin', url(front.VITE_API_URL))
check('backend website origin', url(back.WEB_ORIGIN))
check('production demo access disabled', front.VITE_ENABLE_DEMO !== 'true')
check('payment proof intake explicitly configured', ['true', 'false'].includes(back.PAYMENT_PROOF_INTAKE_ENABLED))
console.log('\nOffline configuration check only. Database policies, email delivery, admin roles, HTTPS and payment intake still require live verification.')
console.log(`Setup guide: ${fileURLToPath(new URL('docs/LIVE_SETUP.md', root))}`)
process.exitCode = failures ? 1 : 0
