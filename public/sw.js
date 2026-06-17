const CACHE_NAME = 'trainer-crm-v1'
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/static/js/main.js',
  '/manifest.json',
]

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(['/index.html']))
  )
  self.skipWaiting()
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url)

  // API запросы — только сеть (не кешируем данные Supabase)
  if (url.hostname.includes('supabase')) {
    e.respondWith(fetch(e.request))
    return
  }

  // Навигация — отдаём index.html из кеша
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.match('/index.html').then(cached => cached || fetch(e.request))
    )
    return
  }

  // Статика — кеш, потом сеть
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached
      return fetch(e.request).then(response => {
        if (response.ok && e.request.method === 'GET') {
          const clone = response.clone()
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone))
        }
        return response
      })
    })
  )
})
