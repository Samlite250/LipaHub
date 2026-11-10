import { createApp } from '../Backend/dist/app.js'
import { readConfig } from '../Backend/dist/config.js'
import { publicSupabase } from '../shared/supabase-public.mjs'

// Vercel invokes this export; it must not open a listening port.
const origin = process.env.VERCEL_ENV === 'preview'
  ? process.env.VERCEL_URL
  : process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL
const settings = publicSupabase(process.env)
const config = readConfig({
  ...process.env,
  SUPABASE_URL: settings.url,
  SUPABASE_ANON_KEY: settings.key,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY,
  WEB_ORIGIN: process.env.WEB_ORIGIN || (origin ? `https://${origin}` : undefined),
  TRUST_PROXY_HOPS: process.env.TRUST_PROXY_HOPS || (process.env.VERCEL === '1' ? '1' : '0'),
})

export default createApp(config)
