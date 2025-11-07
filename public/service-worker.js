// --- Gratitude Journal Service Worker ---
// v3: auto-update & safe cache invalidation

const APP_VERSION = "v3.0.0";  // bump this for each deploy
const CACHE_NAME = `gratitude-journal-${APP_VERSION}`;
const OFFLINE_URLS = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];

// INSTALL — Cache core assets and activate immediately
self.addEventListener("install", (event) => {
  console.log(`[SW] Installing ${APP_VERSION}`);
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(OFFLINE_URLS))
  );
  self.skipWaiting(); // activate new SW immediately
});

// ACTIVATE — Cleanup old caches and take control of clients
self.addEventListener("activate", (event) => {
  console.log(`[SW] Activating ${APP_VERSION}`);
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("[SW] Removing old cache:", key);
            return caches.delete(key);
          }
        })
      )
    )
  );
  self.clients.claim();
});

// FETCH — Cache-first, then network fallback
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // don’t intercept POST, etc.

  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(request)
        .then((response) => {
          // Cache only successful same-origin GET responses
          if (
            response.status === 200 &&
            response.type === "basic" &&
            request.url.startsWith(self.location.origin)
          ) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
          }
          return response;
        })
        .catch(() => cachedResponse || new Response("Offline", { status: 503 }));
    })
  );
});

// AUTO-UPDATE NOTIFICATION — tell client when a new SW activates
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// OPTIONAL: notify clients of new version so UI can show “Reload for update”
self.addEventListener("statechange", () => {
  self.clients.matchAll().then((clients) => {
    clients.forEach((client) =>
      client.postMessage({ type: "NEW_VERSION_READY", version: APP_VERSION })
    );
  });
});

// --- Background Sync (optional) ---
self.addEventListener("sync", (event) => {
  if (event.tag === "sync-gratitude-data") {
    console.log("[SW] Background sync triggered");
    event.waitUntil(syncToDrive());
  }
});

async function syncToDrive() {
  try {
    const clientsArr = await self.clients.matchAll();
    clientsArr.forEach((client) => client.postMessage({ type: "SYNC_START" }));

    const cache = await caches.open(CACHE_NAME);
    const response = await cache.match("/backup-data.json");
    if (!response) return;
    const data = await response.json();

    const tokenCache = await cache.match("/gapi-token.json");
    if (!tokenCache) return;
    const { access_token } = await tokenCache.json();

    await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
      method: "POST",
      headers: { Authorization: "Bearer " + access_token },
      body: JSON.stringify(data),
    });

    clientsArr.forEach((client) => client.postMessage({ type: "SYNC_DONE" }));
  } catch (err) {
    console.error("[SW] Sync failed:", err);
  }
}
