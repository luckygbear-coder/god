const CACHE = "werewolf-god-v3"; // ✅ 每次大更新請改這個字串
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest"
];

// 安裝：先快取基本殼
self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

// 啟用：清掉舊 cache
self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => (k === CACHE ? null : caches.delete(k))));
      await self.clients.claim();
    })()
  );
});

// Fetch 策略：
// 1) index.html / root：網路優先（避免永遠卡舊版）
// 2) 其他：stale-while-revalidate（先回快取，再背景更新）
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  // 只處理同源 GET
  if (req.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  const isHTML =
    req.headers.get("accept")?.includes("text/html") ||
    url.pathname.endsWith("/") ||
    url.pathname.endsWith("/index.html") ||
    url.pathname === "/";

  if (isHTML) {
    // Network first for HTML
    e.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        } catch (err) {
          const cached = await caches.match(req);
          return cached || caches.match("./index.html");
        }
      })()
    );
    return;
  }

  // Stale-while-revalidate for assets (JS/CSS/etc.)
  e.respondWith(
    (async () => {
      const cached = await caches.match(req);
      const fetchPromise = fetch(req)
        .then(async (fresh) => {
          const cache = await caches.open(CACHE);
          cache.put(req, fresh.clone());
          return fresh;
        })
        .catch(() => null);

      return cached || (await fetchPromise) || cached;
    })()
  );
});