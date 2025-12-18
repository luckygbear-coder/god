const CACHE = "werewolf-god-v30";
const ASSETS = [
  "./",
  "./index.html",
  "./style.css",
  "./app.js",
  "./manifest.webmanifest",

  "./boards/index.json",
  "./boards/official-9.json",
  "./boards/official-10.json",
  "./boards/official-12.json",

  "./boards/variants/12-city.json",
  "./boards/variants/12-edge-nopolice.json",
  "./boards/variants/10-edge.json",
  "./boards/variants/10-city-police.json",
  "./boards/variants/9-edge.json"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async (c) => {
      // 有些 variants 可能不存在，避免 install 失敗：逐個加
      for (const url of ASSETS) {
        try { await c.add(url); } catch (err) {}
      }
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k === CACHE ? null : caches.delete(k))))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
