const CACHE_NAME = 'diceketball-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/logo.png',
  '/roll-button.png',
  '/vs-badge.png',
  '/bg-hardwood.png',
  '/avatar-playmaker.png',
  '/avatar-sniper.png',
  '/avatar-defender.png',
  '/avatar-dunker.png',
  '/avatar-rimprotector.png',
  '/avatar-stretch5.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});