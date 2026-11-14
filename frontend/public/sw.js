const OFFLINE_CACHE = 'lipahub-public-offline-v2'
const OFFLINE_PAGE = '/offline.html'
const PUBLIC_FILES = [OFFLINE_PAGE, '/favicon.svg?v=2', '/icons/app-192.png?v=2', '/icons/app-512.png?v=2', '/icons/app-maskable-512.png?v=2', '/icons/apple-touch-icon.png?v=2']
self.addEventListener('install', event => {
  event.waitUntil(caches.open(OFFLINE_CACHE).then(cache => cache.addAll(PUBLIC_FILES)).then(() => self.skipWaiting()))
})
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('lipahub-public-offline-') && key !== OFFLINE_CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url)
  // Account pages, authentication and API responses are never stored offline.
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/') || event.request.mode !== 'navigate') return
  event.respondWith(fetch(event.request).catch(async () => (await caches.match(OFFLINE_PAGE)) || Response.error()))
})
