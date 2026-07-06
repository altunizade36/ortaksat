// Dinamik sitemap üretimi: statik sayfalar + tüm aktif (gerçek) ilanlar.
// Kullanım (yerel):  node scripts/generate-sitemap.mjs   (.env'den okunur)
// Build (Vercel):    EXPO_PUBLIC_SUPABASE_URL + PUBLISHABLE_KEY env'leriyle çalışır.
// Herkese-açık listing_public_cards view'i üzerinden okur; gizli DB şifresi GEREKMEZ.
// Google/Bing her ilanı bu sitemap üzerinden keşfeder ve indeksler.
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = "https://www.ortaksat.com";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "sitemap.xml");

// Üst + alt kategori landing sayfaları (SEO hub'ları).
// ÖNEMLİ: slug'lar category-tree.ts'deki sl() ile BİREBİR aynı olmalı.
// sl(), TR_MAP üzerinden "&" karakterini "ve" yapar (örn. "Bilgisayar & Oyun"
// -> "bilgisayar-ve-oyun"). Bu liste gerçek ağaç slug'larına karşı doğrulanmıştır
// (scripts/validate-slugs — findBySlug ile 56/56 çözümlenir).
const CATEGORY_SLUGS = [
  // 15 üst kategori
  "emlak", "vasita", "yedek-parca-aksesuar-ve-tuning", "ikinci-el-ve-sifir-alisveris",
  "is-makineleri-ve-sanayi", "ustalar-ve-hizmetler", "ozel-ders-ve-egitim", "is-ilanlari",
  "yardimci-arayanlar", "hayvanlar-alemi", "arayanlar-talep-ilanlari",
  "dijital-urunler-ve-hizmetler", "yapi-market-ve-bahce", "muzik-enstrumanlari", "saglik-ve-medikal",
  // Emlak alt kırılımları (yüksek arama hacmi)
  "konut", "is-yeri", "arsa-arazi", "bina", "turistik-tesis", "devre-mulk",
  // Vasıta alt kırılımları
  "otomobil-markaya-gore", "otomobil-kasa-tipine-gore", "motosiklet-markaya-gore",
  "arazi-suv-ve-pickup", "elektrikli-ve-hibrit-araclar", "ticari-araclar", "agir-vasita",
  "deniz-araclari", "karavan",
  // Popüler retail alt-kategori landing sayfaları
  "elektronik", "cep-telefonu", "televizyon", "bilgisayar-ve-oyun", "dizustu-bilgisayar",
  "ev-ve-yasam", "mobilya", "beyaz-esya", "klima", "mutfak", "kucuk-ev-aletleri",
  "moda", "kadin-giyim", "erkek-giyim", "ayakkabi", "anne-ve-bebek", "kozmetik-ve-kisisel-bakim",
  "spor-ve-outdoor", "bisiklet", "kitap-ve-hobi", "koleksiyon-ve-antika", "supermarket-ve-gida",
  "ofis-ve-kirtasiye", "oyuncak", "bahce-ve-yasam", "evcil-hayvan-urunleri"
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
  ...CATEGORY_SLUGS.map((s) => [`/kategori/${s}`, "daily", "0.75"]),
  ...CITY_CATEGORY_PAGES,
  ["/create", "weekly", "0.8"],
  ["/partner", "weekly", "0.8"],
  ["/ortak-kazanc", "weekly", "0.7"],
  ["/satici-ol", "weekly", "0.75"],
  ["/influencer-kazanc", "weekly", "0.75"],
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
  const endpoint = `${url}/rest/v1/listing_public_cards?select=id,created_at&status=eq.active&demo=eq.false&order=created_at.desc&limit=45000`;
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

// Blog yazısı slug'larını lib/blog.ts'ten okur (statik içerik SEO'su). TS dosyasını
// import edemeyiz; slug: "..." satırlarını regex ile çıkarıp senkron kalırız.
function blogSlugs() {
  try {
    const src = readFileSync(join(__dirname, "..", "lib", "blog.ts"), "utf8");
    const slugs = [...src.matchAll(/slug:\s*"([^"]+)"/g)].map((m) => m[1]);
    return [...new Set(slugs)];
  } catch {
    return [];
  }
}

async function main() {
  loadDotEnv();
  const rows = await fetchListings();
  const posts = blogSlugs();

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...STATIC.map(([loc, cf, pr]) => urlTag(loc, cf, pr)),
    ...posts.map((s) => urlTag(`/blog/${s}`, "monthly", "0.55")),
    ...rows.map((r) => urlTag(`/listing/${r.id}`, "weekly", "0.7", r.created_at)),
    "</urlset>",
    ""
  ];

  writeFileSync(OUT, lines.join("\n"), "utf8");
  console.log(`Sitemap yazıldı: ${OUT} — ${STATIC.length} statik + ${rows.length} ilan = ${STATIC.length + rows.length} URL`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
