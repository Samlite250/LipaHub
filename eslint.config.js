import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import hooks from 'eslint-plugin-react-hooks'
import refresh from 'eslint-plugin-react-refresh'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'Materials-References', 'test-results', 'playwright-report', '.npm-cache', 'artifacts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['**/*.{ts,tsx,js,mjs}'], languageOptions: { globals: { ...globals.browser, ...globals.node } }, rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }] } },
  { files: ['frontend/src/**/*.{ts,tsx}'], plugins: { 'react-hooks': hooks, 'react-refresh': refresh }, rules: { ...hooks.configs.recommended.rules, 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] } },
)
