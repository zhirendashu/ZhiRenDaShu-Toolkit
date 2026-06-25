// 数码胶片 DigiCamFX — Service Worker
// Caches all assets for offline use (PWA ready)

const CACHE_NAME = 'digicamfx-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/filters.js',
  '/js/processor.js',
  '/js/app.js',
  'https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;500;700&family=JetBrains+Mono:wght@400;700&display=swap'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Images are not cached (they are user-provided and processed locally)
  if (e.request.destination === 'image') return;
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
