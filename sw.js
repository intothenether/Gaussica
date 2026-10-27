// Service worker: lets the site open without a connection once it has been visited.
//
// The site's own files (page, scripts, styles, lessons) are fetched from the network first, so a new version is
// always used when the connection works; the last copy is used when it does not, or when the network takes more
// than a few seconds. Fonts are kept for good. Nothing from /api and nothing from another server (the database)
// is ever stored here: answers and accounts are never cached by the service worker.

const FILES = "gaussica-files-v1";
const FONTS = "gaussica-fonts-v1";
const PATIENCE = 4000;

self.addEventListener("install", function () { self.skipWaiting(); });

self.addEventListener("activate", function (event) {
  event.waitUntil((async function () {
    const names = await caches.keys();
    await Promise.all(names.filter(function (n) { return n !== FILES && n !== FONTS; }).map(function (n) { return caches.delete(n); }));
    await self.clients.claim();
  }()));
});

self.addEventListener("fetch", function (event) {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.indexOf("/api/") === 0) return;
    // the font files never change under the same name, so the copy in the cache is used at once
    if (/\/fonts\/[\w-]+\.woff2$/.test(url.pathname)) event.respondWith(staleWhileRevalidate(event, req));
    else event.respondWith(networkFirst(event, req));
  }
});

async function networkFirst(event, req) {
  const cache = await caches.open(FILES);
  let cached = await cache.match(req);
  if (!cached && req.mode === "navigate") cached = (await cache.match("./index.html")) || (await cache.match("./"));
  const fresh = fetch(req).then(function (res) {
    if (res.ok) cache.put(req, res.clone());
    return res;
  });
  event.waitUntil(fresh.catch(function () { /* offline */ }));
  if (!cached) return fresh;
  return Promise.race([
    fresh.catch(function () { return cached; }),
    new Promise(function (resolve) { setTimeout(function () { resolve(cached); }, PATIENCE); })
  ]);
}

async function staleWhileRevalidate(event, req) {
  const cache = await caches.open(FONTS);
  const cached = await cache.match(req);
  const fresh = fetch(req).then(function (res) {
    if (res.ok || res.type === "opaque") cache.put(req, res.clone());
    return res;
  });
  event.waitUntil(fresh.catch(function () { /* offline */ }));
  return cached || fresh;
}
