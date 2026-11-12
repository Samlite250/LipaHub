import { publicSupabase } from '../../shared/supabase-public.mjs'
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile, readdir } from 'node:fs/promises'

test('Vercel configuration sends API routes to the function before SPA fallback', async () => {
  const config = JSON.parse(await readFile(new URL('../../vercel.json', import.meta.url), 'utf8'))
  assert.equal(config.outputDirectory, 'frontend/dist')
  assert.equal(config.rewrites[0].source, '/api/:path*')
  assert.equal(config.rewrites[0].destination, '/api/index')
  assert.equal(config.functions['api/index.mjs'].maxDuration, 60)
  const spa = new RegExp(`^${config.rewrites.at(-1).source}$`)
  for (const path of ['/sw.js', '/manifest.webmanifest', '/offline.html', '/icons/app-192.png']) assert.equal(spa.test(path), false, path)
  assert.equal(spa.test('/install'), true)
  assert.ok(config.headers.find(rule => rule.source === '/sw.js').headers.some(header => header.key === 'Cache-Control' && header.value.includes('no-cache')))
})

test('Vercel function exports a working API without opening its own listening port', async () => {
  const keys = ['NODE_ENV', 'VERCEL', 'VERCEL_ENV', 'VERCEL_URL', 'VERCEL_PROJECT_PRODUCTION_URL', 'WEB_ORIGIN', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'PAYMENT_PROOF_INTAKE_ENABLED', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SECRET_KEY', 'VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']
  const previous = Object.fromEntries(keys.map(key => [key, process.env[key]]))
  for (const key of keys) delete process.env[key]
  Object.assign(process.env, { NODE_ENV: 'production', VERCEL: '1', VERCEL_ENV: 'preview', VERCEL_URL: 'controlled-preview.vercel.app' })
  let server
  try {
    const { default: app } = await import('../../api/index.mjs')
    server = app.listen(0, '127.0.0.1')
    if (!server.listening) await new Promise(resolve => server.once('listening', resolve))
    const origin = `http://127.0.0.1:${server.address().port}`
    const health = await fetch(`${origin}/api/health`)
    assert.equal(health.status, 200)
    assert.equal((await health.json()).authenticationConfigured, false)
    const ready = await fetch(`${origin}/api/ready`)
    assert.equal(ready.status, 503)
    assert.deepEqual(await ready.json(), { ready: false })
    assert.equal((await fetch(`${origin}/api/not-real`)).status, 404)
  } finally {
    if (server) await new Promise((resolve, reject) => { server.close(error => error ? reject(error) : resolve()); server.closeIdleConnections() })
    for (const key of keys) { if (previous[key] === undefined) delete process.env[key]; else process.env[key] = previous[key] }
  }
})


test('one public key configures both applications without accepting a server secret', () => {
  assert.deepEqual(publicSupabase({}), { url: '', key: '' })
  const expected = { url: 'https://pzxmfdqfsoltoqgflxcm.supabase.co', key: 'sb_publishable_controlled_test' }
  for (const name of ['SUPABASE_ANON_KEY', 'SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY']) {
    assert.deepEqual(publicSupabase({ [name]: expected.key }), expected)
    assert.throws(() => publicSupabase({ [name]: 'sb_secret_never_public' }), /Server secrets/)
  }
  const serviceJwt = `header.${Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url')}.signature`
  assert.throws(() => publicSupabase({ SUPABASE_ANON_KEY: serviceJwt }), /Server secrets/)
})

test('the single new-project SQL file includes every migration exactly once', async () => {
  const folder = new URL('../migrations/', import.meta.url)
  const names = (await readdir(folder)).filter(name => /^\d+_.+\.sql$/.test(name)).sort()
  const setup = await readFile(new URL('../setup/new-project.sql', import.meta.url), 'utf8')
  for (const name of names) {
    assert.equal(setup.split(`-- Migration: ${name}`).length - 1, 1)
    assert.ok(setup.includes(await readFile(new URL(name, folder), 'utf8')))
  }
})
