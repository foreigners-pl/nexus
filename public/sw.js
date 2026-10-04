// Minimal service worker — PWA installability + Web Push.
// Offline caching can be layered on top later.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(clients.claim()))
// No fetch handler — let requests go straight to the network. A passthrough
// respondWith(fetch(...)) would proxy every request through the SW for nothing.

self.addEventListener('push', (e) => {
  let data = {}
  try { data = e.data ? e.data.json() : {} } catch (_) { /* non-JSON payload */ }
  e.waitUntil(
    self.registration.showNotification(data.title || 'Nexus CRM', {
      body: data.body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: data.url || '/home' },
    })
  )
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  const url = (e.notification.data && e.notification.data.url) || '/home'
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ('focus' in c) {
          c.navigate(url)
          return c.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
