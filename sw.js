const CACHE_NAME = 'ftgm-panel-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/funds.html',
  '/history.html',
  '/chat.html',
  '/admin.html',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Righteous&family=Noto+Regular+Urdu:wght@400;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});