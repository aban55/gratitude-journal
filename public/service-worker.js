const CACHE_NAME = "gratitude-journal-v1";
const ASSETS = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];

// ✅ Install phase: Cache app shell
self.addEventListener("install", (event) => {
  console.log("[SW] Installing new version");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ✅ Activate phase: Clean old caches
self.addEventListener("activate", (event) => {
  console.log("[SW] Activating and cleaning old caches");
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((key) => key !== CACHE_NAME && caches.delete(key)))
    )
  );
  self.clients.claim();
});

// ✅ Serve cached assets when offline
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request)
          .then((res) => {
            if (event.request.method === "GET" && res.status === 200) {
              const clone = res.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return res;
          })
          .catch(() => cached)
      );
    })
  );
});

// ✅ Background Sync: retry failed Google Drive uploads
self.addEventListener("sync", async (event) => {
  if (event.tag === "sync-gratitude-upload") {
    event.waitUntil(uploadPendingBackup());
  }
});

// Helper — upload data saved while offline
async function uploadPendingBackup() {
  try {
    const db = await openDB();
    const entry = await db.get("pending", "backup");
    if (!entry) return;

    console.log("[SW] Retrying Google Drive upload...");
    const res = await fetch(entry.url, {
      method: entry.method,
      headers: entry.headers,
      body: entry.body,
    });

    if (res.ok) {
      console.log("[SW] Backup successfully uploaded after reconnect!");
      await db.delete("pending", "backup");
    } else {
      console.warn("[SW] Retry failed, keeping for next sync");
    }
  } catch (err) {
    console.error("[SW] Background sync failed:", err);
  }
}

// ✅ Simple IndexedDB helper for queued uploads
function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("gratitude-sync", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("pending");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
