/* OrtakSat service worker — güvenli + çevrimdışı dayanıklı.
   Statik varlıklar (JS/CSS/görsel) cache-first; navigasyon ağdan gider ama
   çevrimdışıysa /offline.html sunulur (bayat içerik/oturum riski yok). */
const CACHE = "ortaksat-static-v9";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)).catch(() => {}));
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

  // Gezinme (sayfa) istekleri: ağ öncelikli; çevrimdışıysa offline sayfası.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match(OFFLINE_URL).then((hit) => hit || new Response("Çevrimdışı", { status: 503 })))
    );
    return;
  }

  const isStatic = url.pathname.startsWith("/_expo/") || url.pathname.startsWith("/assets/") || /\.(?:js|css|png|jpg|jpeg|webp|svg|ico|ttf|woff2?)$/i.test(url.pathname);
  if (!isStatic) return; // API: default (ağ)

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
