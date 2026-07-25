/* OrtakSat service worker — güvenli + çevrimdışı dayanıklı.
   Navigasyon ağdan gider (çevrimdışıysa /offline.html). GÖRSEL/FONT cache-first.
   JS/CSS SW TARAFINDAN CACHE'LENMEZ — tarayıcının immutable (content-hash'li) HTTP
   cache'i yönetir; SW'nin elle-sürümlü cache'i farklı deploy'ların chunk'larını
   karıştırıp "Requiring unknown module" hatasına yol açıyordu. */
// v24: KRİTİK DÜZELTME — JS/CSS artık SW cache'ine ALINMIYOR (bayat-chunk/module-ID
// karışımı sona erdi). Sürüm yükseltildi ki eski (JS içeren) cache tüm cihazlarda temizlensin.
const CACHE = "ortaksat-static-v24";
const OFFLINE_URL = "/offline.html";
const PRECACHE = [OFFLINE_URL, "/logo-mark.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
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

  // JS/CSS: SW CACHE'LEMEZ → tarayıcının immutable HTTP cache'ine bırak (content-hash'li,
  // build-başına benzersiz ad → asla karışmaz). Bu, "Requiring unknown module" kök çözümüdür.
  // (Yalnız görsel + font cache-first — bunlarda module-ID karışımı yok.)
  const isImage = /\.(?:png|jpg|jpeg|webp|svg|ico|gif|avif)$/i.test(url.pathname);
  const isFont = /\.(?:ttf|otf|woff2?)$/i.test(url.pathname);
  if (!isImage && !isFont) return; // JS/CSS/API → ağ (tarayıcı cache'i)

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
