/**
 * Service worker de la version web installable (PWA).
 * Stratégie « cache d'abord » : tout le jeu est mis en cache à l'installation,
 * puis fonctionne hors ligne. Le nom du cache contient la version (remplacée par
 * tools/build.mjs) : chaque nouvelle version vide l'ancien cache.
 */
const CACHE = 'numero-en-fuite-v8.7';
const ASSETS = ['./', './index.html', './icon-192.png', './icon-512.png', './manifest.webmanifest'];

self.addEventListener('install', e =>
  e.waitUntil(
    caches
      .open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  )
);

self.addEventListener('activate', e =>
  e.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  )
);

self.addEventListener('fetch', e => {
  if (e.request.method === 'GET' && new URL(e.request.url).origin === self.location.origin)
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request)));
});
