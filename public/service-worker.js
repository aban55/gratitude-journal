self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open("gj-v1").then((cache) =>
      cache.addAll(["/", "/index.html", "/manifest.json"])
    )
  );
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then((res) => res || fetch(e.request))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== "gj-v1").map((k) => caches.delete(k)))
    )
  );
});
