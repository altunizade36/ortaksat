// IndexNow gönderimi — Bing (Edge'in varsayılan arama motoru) + Yandex + Naver
// sayfaları ANINDA (saatler içinde) indeksler; Google'ın haftalar süren doğal
// taramasını beklemeye gerek kalmaz. Google IndexNow'ı desteklemez ama Türkiye'de
// Edge/Bing kullanımı gerçek trafik demektir (masaüstünde varsayılan tarayıcı).
//
// Kullanım:  node scripts/indexnow.mjs            (public/sitemap.xml'i okur)
//            node scripts/indexnow.mjs <url> ...   (yalnız verilen URL'leri bildirir)
//
// Anahtar: public/indexnow-key.txt (ve public/<key>.txt doğrulama dosyası).
// Bu dosyalar public/'ta kalıcıdır ve deploy'la www.ortaksat.com/<key>.txt olur.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOST = "www.ortaksat.com";
const KEY_FILE = join(__dirname, "..", "public", "indexnow-key.txt");

function readKey() {
  if (!existsSync(KEY_FILE)) {
    console.error("IndexNow anahtarı yok: public/indexnow-key.txt");
    process.exit(1);
  }
  return readFileSync(KEY_FILE, "utf8").trim();
}

function sitemapUrls() {
  // Build'den sonra dist-web güncel; yoksa public'teki kaynağı kullan.
  const candidates = [
    join(__dirname, "..", "dist-web", "sitemap.xml"),
    join(__dirname, "..", "public", "sitemap.xml")
  ];
  for (const p of candidates) {
    if (existsSync(p)) {
      const xml = readFileSync(p, "utf8");
      return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
    }
  }
  return [];
}

async function submit(urls, key) {
  if (!urls.length) {
    console.warn("Bildirilecek URL yok.");
    return;
  }
  // IndexNow tek istekte 10.000 URL kabul eder; güvenli tarafta 5.000'lik parçalara böl.
  const chunks = [];
  for (let i = 0; i < urls.length; i += 5000) chunks.push(urls.slice(i, i + 5000));

  const endpoints = ["https://api.indexnow.org/indexnow", "https://yandex.com/indexnow"];
  const keyLocation = `https://${HOST}/${key}.txt`;

  for (const endpoint of endpoints) {
    for (const chunk of chunks) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json; charset=utf-8" },
          body: JSON.stringify({ host: HOST, key, keyLocation, urlList: chunk })
        });
        // 200/202 = kabul; 4xx = anahtar/host sorunu (build'i kırma).
        console.log(`IndexNow ${endpoint} → ${res.status} (${chunk.length} URL)`);
      } catch (err) {
        console.warn(`IndexNow ${endpoint} hata: ${err?.message ?? err}`);
      }
    }
  }
}

async function main() {
  const key = readKey();
  const argv = process.argv.slice(2);
  const urls = argv.length ? argv : sitemapUrls();
  console.log(`IndexNow: ${urls.length} URL bildiriliyor (anahtar ...${key.slice(-6)})`);
  await submit(urls, key);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
