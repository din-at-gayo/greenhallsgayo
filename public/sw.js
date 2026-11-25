/* RoomBook service worker.
 *
 * Availability and bookings change minute to minute and belong to the
 * signed-in user, so pages and server-function responses are never cached —
 * they always go to the network and fall back to an offline page. Only
 * static, content-hashed build assets and icons are cached for fast startup.
 */
const VERSION = 'v1'
const STATIC_CACHE = `roombook-static-${VERSION}`
const OFFLINE_URL = '/offline.html'
const PRECACHE = [
  OFFLINE_URL,
  '/icons/icon.svg',
  '/icons/icon-192.png',
  '/manifest.webmanifest',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys()
      await Promise.all(
        keys
          .filter((k) => k.startsWith('roombook-') && k !== STATIC_CACHE)
          .map((k) => caches.delete(k)),
      )
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable()
      }
      await self.clients.claim()
    })(),
  )
})

function isStaticAsset(url) {
  return url.pathname.startsWith('/assets/') || url.pathname.startsWith('/icons/')
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const preloaded = await event.preloadResponse
          if (preloaded) return preloaded
          return await fetch(request)
        } catch {
          const cache = await caches.open(STATIC_CACHE)
          return (await cache.match(OFFLINE_URL)) || Response.error()
        }
      })(),
    )
    return
  }

  if (isStaticAsset(url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(STATIC_CACHE)
        const cached = await cache.match(request)
        if (cached) return cached
        const response = await fetch(request)
        if (response.ok) cache.put(request, response.clone())
        return response
      })(),
    )
  }
  // Everything else (server functions, calendar feed, etc.) goes straight to the network.
})
