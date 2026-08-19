// Dinamik sitemap üretimi: statik sayfalar + tüm aktif (gerçek) ilanlar.
// Kullanım (yerel):  node scripts/generate-sitemap.mjs   (.env'den okunur)
// Build (Vercel):    EXPO_PUBLIC_SUPABASE_URL + PUBLISHABLE_KEY env'leriyle çalışır.
// Herkese-açık listing_public_cards view'i üzerinden okur; gizli DB şifresi GEREKMEZ.
// Google/Bing her ilanı bu sitemap üzerinden keşfeder ve indeksler.
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

const BASE = "https://www.ortaksat.com";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "sitemap.xml");

// Kategori hub slug'ları ARTIK category-tree.ts'ten OTOMATİK türetilir (aşağıdaki
// categorySlugsFromTree). Bu sabit liste yalnızca ağaç yüklenemezse (typescript/vm
// hatası) FALLBACK olarak kullanılır. ÖNEMLİ (düzeltilen SEO açığı): build
// generateStaticParams ile ~1425 kategori HTML'i üretiyor ama bu elle-bakımlı liste
// yalnız ~63 tanesini sitemap'e yazıyordu → 1362 hazır+indekslenebilir hub Google'a
// yalnız iç-link taramasıyla görünüyordu. Ağaç-yürüyüşü drift'i kalıcı kapatır.
const CATEGORY_SLUGS_FALLBACK = [
  // 11 üst kategori (Sahibinden-modeli konsolidasyonu: 16→11).
  // Eski kökler "dijital-urunler-ve-hizmetler / yapi-market-ve-bahce / muzik-enstrumanlari"
  // kaldırıldı → İkinci El / Ustalar altına taşındı (yeni hub slug'ları aşağıda).
  "emlak", "vasita", "yedek-parca-aksesuar-donanim-ve-tuning", "ikinci-el-ve-sifir-alisveris",
  "is-makineleri-ve-sanayi", "ustalar-ve-hizmetler", "ozel-ders-ve-egitim", "is-ilanlari",
  "hayvanlar-alemi", "yardimci-arayanlar", "arayanlar-talep-ilanlari",
  // Emlak alt kırılımları (yüksek arama hacmi)
  "konut", "is-yeri", "arsa-arazi", "bina", "turistik-tesis", "devre-mulk",
  // Vasıta alt kırılımları
  "otomobil", "motosiklet", "arazi-suv-ve-pickup", "elektrikli-araclar",
  "ticari-araclar", "agir-vasita", "traktor-ve-tarim-araclari", "deniz-araclari", "karavan",
  // Popüler retail alt-kategori landing sayfaları
  "elektronik", "cep-telefonu", "televizyon", "bilgisayar-ve-oyun", "dizustu-bilgisayar",
  "ev-ve-yasam", "mobilya", "beyaz-esya", "klima", "mutfak", "kucuk-ev-aletleri",
  "moda", "kadin-giyim", "erkek-giyim", "ayakkabi", "anne-ve-bebek", "kozmetik-ve-kisisel-bakim",
  "spor-ve-outdoor", "bisiklet", "kitap-ve-hobi", "koleksiyon-ve-antika", "supermarket-ve-gida",
  "ofis-ve-kirtasiye", "oyuncak", "evcil-hayvan-urunleri",
  // Konsolide edilen hub landing sayfaları (eski kökler → İkinci El/Ustalar altına taşındı)
  "bahce-ve-yapi-market", "muzik", "saglik-ve-medikal", "dijital-hizmetler",
  // 2026-07-29 Sahibinden-parite ile eklenen yüksek-arama-hacimli dallar (hepsi canlı 200 doğrulandı):
  // canlı hayvan ticareti (TR'de yüksek talep), oto servis, teknik/hobi elektroniği, özel eğitim.
  "buyukbas-hayvanlar", "kucukbas-hayvanlar", "kumes-hayvanlari", "akvaryum-ve-deniz-canlilari",
  "bocekler-ve-aricilik", "arac-servis-ve-bakim", "teknik-elektronik", "ozel-egitim-ve-cocuk-gelisimi"
];

// Şehir × kategori SEO sayfaları (/kategori/[slug]/[sehir]). Büyük şehirler ×
// yüksek ticari niyetli kategoriler = uzun-kuyruk bedava Google trafiği.
// ÖNEMLİ: şehir slug'ları lib/cities.ts SEO_CITY_SLUGS ile, kategori slug'ları
// yukarıdaki CATEGORY_SLUGS ile birebir aynı olmalı.
const SEO_CITY_SLUGS = [
  "istanbul", "ankara", "izmir", "bursa", "antalya", "adana",
  "konya", "gaziantep", "kocaeli", "mersin", "kayseri", "eskisehir"
];
const CITY_CATEGORY_SLUGS = [
  "emlak", "vasita", "cep-telefonu", "dizustu-bilgisayar", "televizyon", "beyaz-esya",
  "mobilya", "kadin-giyim", "erkek-giyim", "ayakkabi", "spor-ve-outdoor", "kucuk-ev-aletleri"
];
const CITY_CATEGORY_PAGES = CITY_CATEGORY_SLUGS.flatMap((cat) =>
  SEO_CITY_SLUGS.map((city) => [`/kategori/${cat}/${city}`, "daily", "0.65"])
);

const STATIC = [
  ["/", "daily", "1.0"],
  ["/explore", "hourly", "0.9"],
  ["/kategoriler", "weekly", "0.8"],
  // Kategori hub'ları artık main()'de ağaçtan türetilip eklenir (categorySlugsFromTree).
  // NOT: Şehir×kategori sayfaları (kategori/<cat>/<sehir>) sitemap'e YAZILMAZ.
  // Gerçek ilan olmadan bunlar ince/yinelenen içerik (144 near-dup) → SEO riski.
  // seo-static.mjs bu sayfalara noindex koyar. İlan geldikçe tekrar değerlendirilecek.
  // (Referans için tutuldu: CITY_CATEGORY_PAGES)
  ["/create", "weekly", "0.8"],
  ["/partner", "weekly", "0.8"],
  ["/ortaklar", "weekly", "0.7"],
  ["/ortak-satis-nedir", "monthly", "0.7"],
  ["/ortak-kazanc", "weekly", "0.7"],
  ["/satici-ol", "weekly", "0.75"],
  ["/sosyal-medya-kazanc", "weekly", "0.75"],
  ["/alici", "weekly", "0.7"],
  ["/trust", "monthly", "0.6"],
  ["/guvenli-alisveris", "monthly", "0.6"],
  ["/nasil-calisir", "monthly", "0.6"],
  ["/hakkimizda", "monthly", "0.5"],
  ["/iletisim", "monthly", "0.5"],
  ["/sss", "monthly", "0.5"],
  ["/blog", "weekly", "0.6"],
  ["/legal", "monthly", "0.4"],
  ["/kvkk", "monthly", "0.4"]
];

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function urlTag(loc, changefreq, priority, lastmod) {
  const lm = lastmod ? `<lastmod>${new Date(lastmod).toISOString().slice(0, 10)}</lastmod>` : "";
  return `  <url><loc>${esc(BASE + loc)}</loc>${lm}<changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

// .env dosyasını (varsa) process.env'e yükle — yerel çalıştırma kolaylığı için.
function loadDotEnv() {
  const p = join(__dirname, "..", ".env");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

async function fetchListings() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key =
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.warn("Supabase env yok — yalnız statik sayfalar yazılıyor.");
    return [];
  }
  const endpoint = `${url}/rest/v1/listing_public_cards?select=id,created_at,owner_id,category,location&status=eq.active&demo=eq.false&order=created_at.desc&limit=45000`;
  try {
    const res = await fetch(endpoint, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) {
      console.warn(`Listing çekilemedi (${res.status}) — yalnız statik sayfalar.`);
      return [];
    }
    return await res.json();
  } catch (err) {
    // Ağ hatası build'i kırmasın — statik sayfalarla devam.
    console.warn(`Listing çekilemedi (${err?.message ?? err}) — yalnız statik sayfalar.`);
    return [];
  }
}

// Aktif ortaklıkların partner_id'leri → /ortak/[id] vitrin sayfaları (middleware zengin OG + crawler
// HTML servisliyor). RLS anon'a partnerships select vermezse boş döner (sorun değil; URL eklenmez).
async function fetchPartners() {
  const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  try {
    const res = await fetch(`${url}/rest/v1/partnerships?select=partner_id&status=eq.active&limit=45000`, { headers: { apikey: key, Authorization: `Bearer ${key}` } });
    if (!res.ok) return [];
    const rows = await res.json();
    return Array.isArray(rows) ? rows : [];
  } catch { return []; }
}

// Build tarihi (kategori/info sayfaları lastmod'u — bunlar her build'de yeniden üretilir
// ve katalog büyüdükçe içerikleri değişir; tazelik/yeniden-tarama sinyali).
const BUILD_DATE = new Date().toISOString().slice(0, 10);

// Blog yazısı slug + TARİH'i lib/blog.ts'ten okur (statik içerik SEO'su). Blok-tabanlı:
// her slug'dan sonrakine kadarki metinden date çekilir → blog lastmod GERÇEK yazı tarihi.
function blogPosts() {
  try {
    const src = readFileSync(join(__dirname, "..", "lib", "blog.ts"), "utf8");
    const marks = [...src.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => ({ slug: m[1], idx: m.index }));
    const out = marks.map((mk, i) => {
      const block = src.slice(mk.idx, marks[i + 1]?.idx ?? mk.idx + 2000);
      const dm = block.match(/(?:date|createdAt|publishedAt):\s*"([0-9]{4}-[0-9]{2}-[0-9]{2})/);
      return { slug: mk.slug, date: dm ? dm[1] : BUILD_DATE };
    });
    return out.filter((p, i, a) => a.findIndex((x) => x.slug === p.slug) === i);
  } catch {
    return [];
  }
}

// category-tree.ts'i TypeScript ile derleyip vm'de çalıştırır (import zinciri yok → bağımsız).
// generate-category-artifacts.mjs ile AYNI yükleyici deseni. Hata olursa null → fallback liste.
function loadCategoryTree() {
  try {
    const require = createRequire(import.meta.url);
    const ts = require("typescript");
    const src = readFileSync(join(__dirname, "..", "lib", "category-tree.ts"), "utf8");
    const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const mod = { exports: {} };
    const sandbox = { module: mod, exports: mod.exports, require, console };
    vm.createContext(sandbox);
    new vm.Script(js).runInContext(sandbox);
    const tree = mod.exports.categoryTree;
    return Array.isArray(tree) && tree.length ? tree : null;
  } catch (err) {
    console.warn(`category-tree yüklenemedi (${err?.message ?? err}) — sabit fallback kategori listesi.`);
    return null;
  }
}

// Derinlik 0-2 kategori slug'ları — app/kategori/[slug]/index.tsx generateStaticParams ile
// BİREBİR aynı küme (build'de gerçekten üretilen hub sayfaları). Derinliğe göre öncelik.
function categorySlugsFromTree(tree) {
  const seen = new Set();
  const out = [];
  const add = (slug, pr) => { if (slug && !seen.has(slug)) { seen.add(slug); out.push([slug, pr]); } };
  for (const top of tree) {
    add(top.slug, "0.8");
    for (const sub of top.children ?? []) {
      add(sub.slug, "0.7");
      for (const sub2 of sub.children ?? []) add(sub2.slug, "0.6");
    }
  }
  // generateStaticParams ayrıca CITY_CATEGORY_SLUGS hub'larını garanti eder (çoğu ağaçta zaten var).
  for (const slug of CITY_CATEGORY_SLUGS) add(slug, "0.7");
  return out;
}

// lib/cities.ts'i (import'suz) yükle → listingInCity/SEO_CITY_SLUGS/CITY_CATEGORY_SLUGS.
function loadCities() {
  try {
    const require = createRequire(import.meta.url);
    const ts = require("typescript");
    const src = readFileSync(join(__dirname, "..", "lib", "cities.ts"), "utf8");
    const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
    const mod = { exports: {} };
    const sandbox = { module: mod, exports: mod.exports, require, console };
    vm.createContext(sandbox);
    new vm.Script(js).runInContext(sandbox);
    const m = mod.exports;
    return (typeof m.listingInCity === "function" && Array.isArray(m.SEO_CITY_SLUGS) && Array.isArray(m.CITY_CATEGORY_SLUGS)) ? m : null;
  } catch (err) {
    console.warn(`cities.ts yüklenemedi (${err?.message ?? err}) — şehir×kategori gate atlandı.`);
    return null;
  }
}
function buildNodeIndex(tree) {
  const bySlug = new Map();
  (function walk(nodes) { for (const n of nodes) { if (!bySlug.has(n.slug)) bySlug.set(n.slug, n); if (n.children) walk(n.children); } })(tree);
  return bySlug;
}
function descendantLabels(node) {
  const out = new Set();
  (function rec(n) { out.add(n.label); for (const c of n.children ?? []) rec(c); })(node);
  return out;
}
// Şehir×kategori kombolarını GERÇEK aktif-ilan sayısına göre değerlendir; eşik (3) üstü olanlar
// indekslenebilir. Eşleşme app ile BİREBİR (category-label ∈ descendantLabels && listingInCity).
// Envanter büyüdükçe OTOMATİK açılır (elle iş yok). Eşik altı sayfalar noindex kalır (thin-content).
const CITY_INDEX_THRESHOLD = 3;
function indexableCityCombos(rows, tree, cities) {
  if (!tree || !cities) return [];
  const bySlug = buildNodeIndex(tree);
  const combos = [];
  for (const catSlug of cities.CITY_CATEGORY_SLUGS) {
    const node = bySlug.get(catSlug);
    if (!node) continue;
    const labels = descendantLabels(node);
    for (const citySlugId of cities.SEO_CITY_SLUGS) {
      let count = 0;
      for (const r of rows) if (r.category && labels.has(r.category) && cities.listingInCity(r.location, citySlugId)) count++;
      if (count >= CITY_INDEX_THRESHOLD) combos.push(`${catSlug}/${citySlugId}`);
    }
  }
  return combos;
}

async function main() {
  loadDotEnv();
  const rows = await fetchListings();
  const posts = blogPosts();
  const tree = loadCategoryTree();
  const categoryPairs = tree
    ? categorySlugsFromTree(tree)
    : CATEGORY_SLUGS_FALLBACK.map((s) => [s, "0.75"]);
  const partnerRows = await fetchPartners();
  // Aktif ilanı olan satıcılar → /store/[id]; aktif ortaklar → /ortak/[id] (middleware crawler HTML).
  const sellerIds = Array.from(new Set(rows.map((r) => r.owner_id).filter(Boolean)));
  const partnerIds = Array.from(new Set(partnerRows.map((r) => r.partner_id).filter(Boolean)));
  // Envanter-gate'li şehir×kategori sayfaları (≥3 gerçek ilan) → index + sitemap. JSON'u seo-static
  // de okuyup noindex kararını verir (tek doğruluk kaynağı). Env/veri yoksa boş → hepsi noindex kalır.
  const cities = loadCities();
  const cityCombos = indexableCityCombos(rows, tree, cities);
  writeFileSync(join(__dirname, "..", "lib", "indexable-city-pages.json"), JSON.stringify(cityCombos), "utf8");

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...STATIC.map(([loc, cf, pr]) => urlTag(loc, cf, pr, BUILD_DATE)),
    ...categoryPairs.map(([slug, pr]) => urlTag(`/kategori/${slug}`, "daily", pr, BUILD_DATE)),
    ...posts.map((p) => urlTag(`/blog/${p.slug}`, "monthly", "0.55", p.date)),
    ...cityCombos.map((c) => urlTag(`/kategori/${c}`, "daily", "0.6", BUILD_DATE)),
    ...sellerIds.map((sid) => urlTag(`/store/${sid}`, "weekly", "0.55", BUILD_DATE)),
    ...partnerIds.map((pid) => urlTag(`/ortak/${pid}`, "weekly", "0.55", BUILD_DATE)),
    ...rows.map((r) => urlTag(`/listing/${r.id}`, "weekly", "0.7", r.created_at)),
    "</urlset>",
    ""
  ];

  writeFileSync(OUT, lines.join("\n"), "utf8");
  const total = STATIC.length + categoryPairs.length + posts.length + cityCombos.length + sellerIds.length + partnerIds.length + rows.length;
  console.log(`Sitemap yazıldı: ${OUT} — ${STATIC.length} statik + ${categoryPairs.length} kategori${tree ? " (ağaçtan)" : " (FALLBACK)"} + ${posts.length} blog + ${cityCombos.length} şehir×kategori + ${sellerIds.length} mağaza + ${partnerIds.length} ortak + ${rows.length} ilan = ${total} URL`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
