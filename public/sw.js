/* OrtakSat service worker — güvenli + çevrimdışı dayanıklı.
   Statik varlıklar (JS/CSS/görsel) cache-first; navigasyon ağdan gider ama
   çevrimdışıysa /offline.html sunulur (bayat içerik/oturum riski yok). */
// v22: keşfet mobil iyileştirmeleri (tık→ilan, kompakt başlık, tutarlı çipler,
// kare görseller, otomatik-ilerleme yok) — eski önbelleği zorla temizle, taze sürüm gelsin.
// cihazlarda kalmasın diye statik önbellek sürümü yükseltildi.
const CACHE = "ortaksat-static-v23"; // v23: yeni logo (favicon/apple-touch/pwa/og) — eski kedi ikonları önbellekten düşsün
const OFFLINE_URL = "/offline.html";
// offline.html + boot-splash logoyu gösterir; ilk-ziyaret-sonra-çevrimdışıda kırık
// görünmesin diye logo da install'da ön-bellenir.
const PRECACHE = [OFFLINE_URL, "/logo-mark.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => {}));
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
