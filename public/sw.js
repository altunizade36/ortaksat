/* OrtakSat service worker — minimal, güvenli.
   Yalnızca statik varlıkları (JS/CSS/görsel) cache-first sunar; navigasyon ve
   Supabase/API istekleri her zaman ağdan gider (bayat içerik/oturum riski yok). */
const CACHE = "ortaksat-static-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  let url;
  try {
    url = new URL(req.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return; // yalnız kendi origin

  const isStatic = url.pathname.startsWith("/_expo/") || url.pathname.startsWith("/assets/") || /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|ttf|woff2?)$/i.test(url.pathname);
  if (!isStatic) return; // navigasyon/API: default (ağ)

  event.respondWith(
    caches.open(CACHE).then((cache) =>
      cache.match(req).then((hit) => {
        if (hit) return hit;
        return fetch(req).then((res) => {
          if (res && res.status === 200) cache.put(req, res.clone());
          return res;
        });
      })
    )
  );
});
