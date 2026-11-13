import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'node:url'
import { publicSupabase } from '../shared/supabase-public.mjs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { seoPlugin } from './vite-seo'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), '')
  const settings = publicSupabase({ ...env, ...process.env })
  const siteUrl = (env.VITE_SITE_URL || process.env.VITE_SITE_URL || 'https://lipahub1.vercel.app').trim().replace(/\/+$/, '')
  return {
    define: {
      'import.meta.env.VITE_SUPABASE_URL': JSON.stringify(settings.url),
      'import.meta.env.VITE_SUPABASE_ANON_KEY': JSON.stringify(settings.key),
    },
    plugins: [react(), tailwindcss(), seoPlugin(siteUrl)],
    server: { watch: { ignored: ['**/playwright-report/**', '**/test-results/**', '**/artifacts/**', '**/.npm-cache/**', '**/Materials-References/**'] } },
  }
})
