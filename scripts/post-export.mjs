// Vercel bilinmeyen yollar için dist-web/404.html sunar. Expo export ise
// +not-found.html üretir. Bu script onu 404.html'e kopyalar ki özel 404 sayfamız
// (generic Vercel 404 yerine) gösterilsin.
import fs from "fs";

import { patchSeo } from "./seo-static.mjs";

const dir = "dist-web";
const src = `${dir}/+not-found.html`;
const dst = `${dir}/404.html`;

try {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log("post-export: 404.html oluşturuldu (+not-found.html'den).");
  } else {
    console.warn("post-export: +not-found.html bulunamadı, 404.html atlandı.");
  }
} catch (e) {
  console.warn("post-export: 404.html kopyalanamadı:", e.message);
}

// Statik rotaların <title>/description/canonical/OG etiketlerini benzersizle —
// expo-router/head statik export'ta yazmadığı için crawler'lar tek başlık görüyordu.
try {
  patchSeo();
} catch (e) {
  console.warn("post-export: SEO meta yazılamadı:", e.message);
}
// asyncRoutes (kod-bölme) sonrası: yaygın HEDEF route chunk'larını <link rel="prefetch">
// ile boşta/düşük-öncelikle tarayıcı cache'ine ısıt. İlk gezinmede lazy import() cache'den
// gelir → içerik-boşluğu (slow-3G'de ~500ms) kaybolur. MOUNT/VERİ-ÇEKİMİ YOK (yalnız HTTP
// cache ısıtma, yan etkisiz). En ağır 4 route = [id](ilan detay)/partner/create/explore;
// nadir/ağır olanlar (admin, seller, auth, legal) hariç → boşa bant genişliği yok.
function injectRoutePrefetch() {
  const jsDir = `${dir}/_expo/static/js/web`;
  if (!fs.existsSync(jsDir)) return;
  const EXCLUDE = /^(__common|entry|admin|index|seller|auth|_layout|Device|__expo|profile-edit|legal|trust|toplu-ilan|earnings|messages|profile)-/;
  const files = fs.readdirSync(jsDir).filter((f) => f.endsWith(".js") && !EXCLUDE.test(f));
  const top = files
    .map((f) => ({ f, size: fs.statSync(`${jsDir}/${f}`).size }))
    .sort((a, b) => b.size - a.size)
    .slice(0, 4)
    .map((x) => x.f);
  if (!top.length) return;
  const tags = top.map((f) => `<link rel="prefetch" as="script" href="/_expo/static/js/web/${f}">`).join("");
  const htmlFiles = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = `${d}/${e.name}`;
      if (e.isDirectory()) walk(p);
      else if (e.name.endsWith(".html")) htmlFiles.push(p);
    }
  };
  walk(dir);
  let n = 0;
  for (const p of htmlFiles) {
    let html = fs.readFileSync(p, "utf8");
    if (html.includes('rel="prefetch" as="script"')) continue; // idempotent
    if (html.includes("</head>")) {
      fs.writeFileSync(p, html.replace("</head>", tags + "</head>"));
      n++;
    }
  }
  console.log(`post-export: route prefetch enjekte edildi (${top.length} chunk, ${n} html): ${top.map((f) => f.split("-")[0]).join(", ")}`);
}
try {
  injectRoutePrefetch();
} catch (e) {
  console.warn("post-export: route prefetch enjekte edilemedi:", e.message);
}
// 404.html varsayılan başlıkta kalmasın (patchSeo'dan sonra kopyalanmadıysa da).
