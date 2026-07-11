const CACHE_NAME = "geo-chess-v5"; // Increment this version string whenever you push new updates!
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.json",
  "./icon.png"
];

// Install Event - Pre-caches assets firmly
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => {
      // Force the waiting service worker to become the active service worker immediately
      return self.skipWaiting();
    })
  );
});

// Activate Event - Automatically flushes out all older cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => {
      // Forces all open application tabs/PWA windows to claim the new worker instantly
      return self.clients.claim();
    })
  );
});

// Fetch Event - Cache-first with network fallback strategy
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request);
    })
  );
});
