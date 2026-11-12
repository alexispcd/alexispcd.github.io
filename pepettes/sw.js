// Service worker de Pepettes, limite a /pepettes/.
// Changer VERSION a chaque modification des fichiers pour renouveler le cache.
const VERSION = 'pepettes-v2'
const FONTS = 'pepettes-fonts'
const PRECACHE = [
  './', 'index.html', 'manifest.webmanifest',
  'lib/maplibre-gl.js', 'lib/pmtiles.js', 'lib/basemaps.js', 'lib/maplibre-gl.css',
  'fonts.json', 'map-0.json', 'map-1.json', 'map-2.json',
  'sprites/light.json', 'sprites/light.png', 'sprites/light@2x.json', 'sprites/light@2x.png',
  'icons/icon-180.png', 'icons/icon-192.png', 'icons/icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('pepettes-') && k !== VERSION && k !== FONTS).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

const fromNetwork = async (request, cacheName) => {
  const response = await fetch(request)
  if (response.ok) {
    const cache = await caches.open(cacheName)
    cache.put(request, response.clone())
  }
  return response
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  // Polices Google : servies du cache, rafraichies en fond.
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fromNetwork(request, FONTS).catch(() => cached)
        return cached || network
      }),
    )
    return
  }

  if (url.origin !== self.location.origin || !url.pathname.startsWith('/pepettes/')) return

  // Page : reseau d'abord pour recevoir les mises a jour, cache hors ligne.
  if (request.mode === 'navigate') {
    event.respondWith(fromNetwork(request, VERSION).catch(() => caches.match('index.html')))
    return
  }

  // Le reste : cache d'abord.
  event.respondWith(caches.match(request).then((cached) => cached || fromNetwork(request, VERSION)))
})
