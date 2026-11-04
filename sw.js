// Lets the app open with no internet. Shows the saved copy straight away and
// fetches a fresh one in the background for next time.
var CACHE = 'timetable-v1';
var FILES = [
  './',
  'index.html',
  'styles.css',
  'data.js',
  'app.js',
  'manifest.webmanifest',
  'icon-180.png',
  'icon-192.png',
  'icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(FILES); }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(names.filter(function (n) { return n !== CACHE; }).map(function (n) {
        return caches.delete(n);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== location.origin) return;

  event.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(request, { ignoreSearch: true }).then(function (saved) {
        // no-cache: ask GitHub for the newest copy instead of a 10-minute-old one.
        var fresh = fetch(request, { cache: 'no-cache' }).then(function (response) {
          if (response.ok) cache.put(request, response.clone());
          return response;
        });
        if (saved) {
          fresh.catch(function () { /* offline: the saved copy is already showing */ });
          return saved;
        }
        return fresh.catch(function () {
          if (request.mode === 'navigate') return cache.match('./');
          return Response.error();
        });
      });
    })
  );
});
