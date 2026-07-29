const CACHE = 'riftfall-product-v1';
const CORE = [
  '/',
  '/manifest.webmanifest',
  '/icon.svg',
  '/assets/riftfall-arena.webp',
  '/assets/arena-ember-forge.webp',
  '/assets/arena-neon-ruins.webp',
  '/assets/arena-astral-sanctuary.webp',
  '/assets/characters/astra-nyx-sheet.webp',
  '/assets/characters/kael-forge-sheet.webp',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(CORE)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || event.request.url.includes('/socket.io/')) return;
  event.respondWith(fetch(event.request).then((response) => {
    const copy = response.clone();
    caches.open(CACHE).then((cache) => cache.put(event.request, copy));
    return response;
  }).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))));
});
