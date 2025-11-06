// --- Gratitude Journal Service Worker ---
// v2: with Background Sync + Auto-update

const CACHE_NAME = "gratitude-journal-v2";
const OFFLINE_URLS = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];

// Install: cache core assets
self.addEventListener("install", (event) => {
  console.log("[SW] Installing new version");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting();
});

// Activate: cleanup old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => k !== CACHE_NAME && caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: serve from cache first, fallback to network
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then(
      (cached) =>
        cached ||
        fetch(event.request)
          .then((resp) => {
            if (
              event.request.method === "GET" &&
              resp.status === 200 &&
              resp.type === "basic"
            ) {
              const clone = resp.clone();
              caches.open(CACHE_NAME).then((cache) =>
                cache.put(event.request, clone)
              );
            }
            return resp;
          })
          .catch(() => cached || new Response("Offline", { status: 503 }))
    )
  );
});

// --- Background Sync for Drive Backup ---
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-gratitude-data") {
    console.log("[SW] Running background sync for Google Drive backup...");
    event.waitUntil(syncToDrive());
  }
});

async function syncToDrive() {
  try {
    const clientsArr = await self.clients.matchAll();
    clientsArr.forEach((client) =>
      client.postMessage({ type: "SYNC_START" })
    );

    // Pull latest local data
    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match("/backup-data.json");
    if (!response) return;
    const data = await response.json();

    // Upload to Google Drive (requires online + valid auth token)
    const tokenCache = await caches.match("/gapi-token.json");
    if (!tokenCache) return;
    const { access_token } = await tokenCache.json();

    await fetch(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + access_token,
        },
        body: JSON.stringify(data),
      }
    );

    clientsArr.forEach((client) =>
      client.postMessage({ type: "SYNC_DONE" })
    );
  } catch (err) {
    console.error("[SW] Sync failed:", err);
  }
}
