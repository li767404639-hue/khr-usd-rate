const CACHE = "khr-usd-v6";
const ASSETS = ["/", "/index.html", "/manifest.json", "/privacy.html", "/terms.html", "/disclaimer.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith("/api/")) return; // API 不缓存
  e.respondWith(caches.match(e.request).then((cached) => cached || fetch(e.request)));
});
