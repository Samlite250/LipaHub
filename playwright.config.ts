import { defineConfig, devices } from '@playwright/test'

// Fresh directories avoid overwriting PNGs held open by Windows image viewers.
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

process.env.LIPAHUB_SCREENSHOT_RUN ??= new Date().toISOString().replace(/[:.]/g, '-')

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/activation/**'],
  fullyParallel: true,
  workers: 2,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || (process.platform === 'win32' ? 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe' : undefined) },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 900 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'], viewport: { width: 412, height: 924 } } },
  ],
  webServer: [
    { command: `${npm} run dev -- --port 5173 --strictPort`, url: 'http://127.0.0.1:5173', reuseExistingServer: !process.env.CI },
    { command: `${npm} run start:api`, url: 'http://127.0.0.1:3001/api/health', reuseExistingServer: !process.env.CI },
  ],
})
