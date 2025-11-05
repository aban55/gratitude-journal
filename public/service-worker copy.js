// --- Gratitude Journal Service Worker ---
// Always updates when a new build is deployed
const CACHE_NAME = "gratitude-journal-v1";

// List of core assets to cache (optional: add icons, manifest, etc.)
const ASSETS = ["/", "/index.html", "/manifest.json", "/icon-192.png"];

self.addEventListener("install", (event) => {
  console.log("[SW] Installing new version");
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS).catch((err) =>
        console.warn("[SW] Asset caching skipped:", err)
      );
    })
  );
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating and cleaning old caches");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim(); // take control of all pages
});

// Serve from cache first, then network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((response) => {
            // Only cache GET requests
            if (
              event.request.method === "GET" &&
              response.status === 200 &&
              response.type === "basic"
            ) {
              const respClone = response.clone();
              caches.open(CACHE_NAME).then((cache) =>
                cache.put(event.request, respClone)
              );
            }
            return response;
          })
          .catch(() =>
            // Optional offline fallback
            cached || new Response("Offline", { status: 503 })
          )
      );
    })
  );
});
