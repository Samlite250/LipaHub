const origin = process.env.API_ORIGIN || 'http://127.0.0.1:3001'
if (process.argv.includes('--help')) {
  console.log('Run the API, then npm run backend:check. Set API_ORIGIN to check another API origin.')
} else {
  try {
    const target = new URL('/api/ready', origin)
    if (!['http:', 'https:'].includes(target.protocol) || target.username || target.password) throw new Error('Invalid API_ORIGIN')
    const response = await fetch(target, { signal: AbortSignal.timeout(20000) })
    const result = await response.json()
    if (!response.ok || result.ready !== true) {
      console.error('NOT READY: run setup:check, apply the supplied migrations in order and check private Storage configuration. An authorized administrator can inspect /api/admin/system/status.')
      process.exitCode = 1
    } else console.log('READY: API dependency probes passed. Real account, email and payment-provider integration tests are still required.')
  } catch {
    console.error('NOT READY: API could not be reached or returned an invalid readiness response. Start the API and check API_ORIGIN.')
    process.exitCode = 1
  }
}
