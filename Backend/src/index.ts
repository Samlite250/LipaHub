import 'dotenv/config'
import { createApp } from './app.js'
import { readConfig } from './config.js'

try {
  const config = readConfig()
  const server = createApp(config).listen(config.port, config.host, () => {
    console.log(`LipaHub API ready on ${config.host}:${config.port}`)
  })
  server.on('error', (error: NodeJS.ErrnoException) => { console.error(`API startup failed: ${error.code || 'unknown error'}`); process.exitCode = 1 })
  let stopping = false
  function stop() {
    if (stopping) return
    stopping = true
    const timeout = setTimeout(() => { server.closeAllConnections(); process.exit(1) }, 10000).unref()
    server.close(() => { clearTimeout(timeout); process.exit(0) })
    server.closeIdleConnections()
  }
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
} catch (error) {
  console.error(error instanceof Error ? error.message : 'API configuration is invalid.')
  process.exitCode = 1
}
