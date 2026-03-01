/* service-worker.js
 * Strategy:
 * - HTML/Navigations: Network First (always prefer fresh version)
 * - Static assets (same-origin): Stale-While-Revalidate
 * - API responses: Network Only (never cache)
 * - Auto-activate new SW: skipWaiting + clientsClaim
 */

const CACHE_VERSION = "v6"; // 每次你大改站点可手动 +1，强制所有设备更新
const STATIC_CACHE = `static-${CACHE_VERSION}`;

// 你站点的静态资源（可按需增减，不影响运行）
const PRECACHE_URLS = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/privacy.html",
  "/terms.html",
  "/disclaimer.html"
];

// 安装：预缓存基础文件
self.addEventListener("install", (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).catch(() => {})
  );
});

// 激活：清理旧缓存
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.map((k) => {
        if (k !== STATIC_CACHE) return caches.delete(k);
      })
    );
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 只处理 GET
  if (req.method !== "GET") return;

  // 1) API：永不缓存（避免旧汇率/旧数据）
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(fetch(req));
    return;
  }

  // 2) 跨域资源：不缓存（例如 open.er-api.com 等）
  if (url.origin !== self.location.origin) {
    event.respondWith(fetch(req));
    return;
  }

  // 3) HTML / 页面导航：Network First
  // 关键：解决 iPhone/PWA 旧 index.html 不更新的问题
  const isNavigation = req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
  if (isNavigation) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 4) 静态资源：Stale-While-Revalidate（快 + 自动后台更新）
  event.respondWith(staleWhileRevalidate(req));
});

async function networkFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  try {
    const fresh = await fetch(request, { cache: "no-store" });
    // 只缓存成功响应
    if (fresh && fresh.ok) cache.put(request, fresh.clone());
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) return cached;

    // 离线兜底：给主页（可选）
    if (request.mode === "navigate") {
      const fallback = await cache.match("/index.html");
      if (fallback) return fallback;
    }
    throw err;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);

  const fetchPromise = fetch(request)
    .then((fresh) => {
      if (fresh && fresh.ok) cache.put(request, fresh.clone());
      return fresh;
    })
    .catch(() => cached);

  // 有缓存就先返回缓存，同时后台更新
  return cached || fetchPromise;
}
