/* Speedy Finance AI - Service Worker for offline support */
const CACHE_VERSION = "speedy-v1"
const STATIC_CACHE = `${CACHE_VERSION}-static`
const API_CACHE = `${CACHE_VERSION}-api`

self.addEventListener("install", (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(["/", "/manifest.json"])
    })
  )
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k.startsWith("speedy-") && k !== STATIC_CACHE && k !== API_CACHE).map((k) => caches.delete(k))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)
  if (url.pathname.startsWith("/api/bse/calendar-unified")) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          const clone = res.clone()
          caches.open(API_CACHE).then((cache) => cache.put(event.request, clone))
          return res
        })
        .catch(() => caches.match(event.request))
    )
    return
  }
  if (event.request.mode === "navigate" || (event.request.method === "GET" && event.request.destination !== "script" && event.request.destination !== "style")) {
    event.respondWith(
      fetch(event.request).catch(() =>
        caches.match(event.request).then((r) => r || caches.match("/"))
      )
    )
    return
  }
})
