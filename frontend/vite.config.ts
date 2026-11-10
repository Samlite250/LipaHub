import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { watch: { ignored: ['**/playwright-report/**', '**/test-results/**', '**/artifacts/**', '**/.npm-cache/**', '**/Materials-References/**'] } },
})
