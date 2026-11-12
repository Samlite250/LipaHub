import { defineConfig } from '@playwright/test'
import base from './playwright.config'
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
export default defineConfig({
  ...base,
  testDir: './tests/activation',
  testIgnore: [],
  outputDir: 'test-results-activation',
  use: {...base.use, baseURL: 'http://127.0.0.1:5213'},
  webServer: {command: `${npm} run dev -- --port 5213 --strictPort`, url: 'http://127.0.0.1:5213', reuseExistingServer: false,
    env: {VITE_SUPABASE_ANON_KEY: 'sb_publishable_controlled_test', SUPABASE_ANON_KEY: 'sb_publishable_controlled_test', VITE_ENABLE_DEMO: 'false'}},
})
