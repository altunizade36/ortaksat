// CANLI URL TARAYICI — master madde 11. audit/category-tree.json'daki TÜM kategori
// slug'larından /kategori/[slug] URL'leri + canlı sitemap.xml'deki tüm URL'leri
// üretir, hepsini GERÇEKTEN fetch eder ve HTTP durumunu kaydeder. Çıktı:
// audit/url-crawl.json (elle yazılmış değil — canlı yanıtlardan).
//
// Kullanım: node scripts/crawl-category-urls.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "audit");
const BASE = "https://www.ortaksat.com";

// 1) Ağaçtaki TÜM slug'ları topla (üst + tüm alt seviyeler) → /kategori/[slug]
const tree = JSON.parse(readFileSync(join(OUT, "category-tree.json"), "utf8"));
const slugs = new Set();
(function collect(nodes) {
  for (const n of nodes) { if (n.slug) slugs.add(n.slug); if (n.children) collect(n.children); }
})(tree.tree);
const categoryUrls = [...slugs].map((s) => `${BASE}/kategori/${s}`);

// 2) Canlı sitemap.xml'deki tüm URL'ler (gerçek indekslenen set)
async function sitemapUrls() {
  try {
    const r = await fetch(`${BASE}/sitemap.xml`, { redirect: "follow" });
    const xml = await r.text();
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
  } catch { return []; }
}

async function head(url) {
  try {
    const r = await fetch(url, { method: "GET", redirect: "follow", headers: { "user-agent": "OrtakSatAudit/1.0" } });
    return { url, status: r.status, ok: r.ok, finalUrl: r.url !== url ? r.url : undefined };
  } catch (e) {
    return { url, status: 0, ok: false, error: String(e.message || e).slice(0, 80) };
  }
}

async function pool(urls, size, fn) {
  const out = new Array(urls.length);
  let i = 0;
  await Promise.all(Array.from({ length: size }, async () => {
    while (i < urls.length) { const idx = i++; out[idx] = await fn(urls[idx]); }
  }));
  return out;
}

const main = async () => {
  const smUrls = await sitemapUrls();
  // Kategori landing (sitemap) + ağaç-türevli /kategori/[slug] (benzersizleştir)
  const catFromSitemap = smUrls.filter((u) => u.includes("/kategori/"));
  const allCategory = [...new Set([...categoryUrls, ...catFromSitemap])];

  console.log(`Ağaç slug: ${slugs.size} | sitemap URL: ${smUrls.length} | taranacak kategori URL: ${allCategory.length}`);
  console.log("Kategori URL'leri taranıyor (canlı)…");
  const catResults = await pool(allCategory, 12, head);

  // sitemap'in kategori-dışı URL'leri de (statik/blog/ilan) doğrula
  const otherUrls = smUrls.filter((u) => !u.includes("/kategori/"));
  console.log(`Diğer sitemap URL'leri taranıyor (${otherUrls.length})…`);
  const otherResults = await pool(otherUrls, 12, head);

  const all = [...catResults, ...otherResults];
  const byStatus = all.reduce((a, r) => { a[r.status] = (a[r.status] || 0) + 1; return a; }, {});
  const failures = all.filter((r) => !r.ok);

  const report = {
    generatedFrom: "CANLI fetch — www.ortaksat.com",
    base: BASE,
    counts: {
      treeSlugs: slugs.size,
      categoryUrlsCrawled: allCategory.length,
      sitemapUrls: smUrls.length,
      otherUrlsCrawled: otherUrls.length,
      totalCrawled: all.length
    },
    byStatus,
    failureCount: failures.length,
    failures: failures.slice(0, 100),
    categorySample: catResults.slice(0, 30),
    allResults: all
  };
  writeFileSync(join(OUT, "url-crawl.json"), JSON.stringify(report, null, 2), "utf8");
  console.log(`\n✓ audit/url-crawl.json yazıldı`);
  console.log(`Toplam ${all.length} URL | durum dağılımı: ${JSON.stringify(byStatus)} | BAŞARISIZ: ${failures.length}`);
  if (failures.length) console.log("İlk hatalar:", failures.slice(0, 5).map((f) => `${f.status} ${f.url}`).join(" | "));
};
main().catch((e) => { console.error(e); process.exit(1); });
