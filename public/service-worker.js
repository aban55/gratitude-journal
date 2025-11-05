// Simple offline-first cache + background-sync fallback
const CACHE = "gj-v2";
const CORE = ["/", "/index.html", "/manifest.json", "/icon-192.png"];

let latestPayload = null;

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k !== CACHE ? caches.delete(k) : null))))
  );
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).catch(() => hit || new Response("Offline")))
  );
});

// receive latest data from page
self.addEventListener("message", (e) => {
  if (e.data?.type === "SET_GRATITUDE_PAYLOAD") {
    latestPayload = e.data.payload;
  }
});

// try to re-sync when back online via Background Sync
self.addEventListener("sync", async (e) => {
  if (e.tag === "sync-gratitude-data" && latestPayload) {
    // We cannot call Google API from SW directly (no gapi), so ask a client page to do it.
    const all = await self.clients.matchAll({ includeUncontrolled: true });
    for (const client of all) {
      client.postMessage({ type: "DO_PAGE_UPLOAD" });
    }
  }
});
