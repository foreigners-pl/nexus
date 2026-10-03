// Minimal service worker — required for PWA installability.
// Push notifications + offline caching get built on top of this later.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))
self.addEventListener('fetch', (e) => e.respondWith(fetch(e.request)))
