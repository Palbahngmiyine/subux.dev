// Retire the Qwik 1 prefetch worker for returning visitors. Qwik 2 preloads itself.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => {
  event.waitUntil(self.registration.unregister())
})
