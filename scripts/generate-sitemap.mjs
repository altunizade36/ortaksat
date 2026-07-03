// Dinamik sitemap üretimi: statik sayfalar + tüm aktif (gerçek) ilanlar.
// Kullanım (yerel):  node scripts/generate-sitemap.mjs   (.env'den okunur)
// Build (Vercel):    EXPO_PUBLIC_SUPABASE_URL + PUBLISHABLE_KEY env'leriyle çalışır.
// Herkese-açık listing_public_cards view'i üzerinden okur; gizli DB şifresi GEREKMEZ.
// Google/Bing her ilanı bu sitemap üzerinden keşfeder ve indeksler.
import { writeFileSync, readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = "https://ortaksat.com";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "public", "sitemap.xml");

// Üst kategori landing sayfaları (SEO hub'ları) — slug'lar category-tree sl() ile birebir.
const CATEGORY_SLUGS = [
  "emlak", "vasita", "yedek-parca-aksesuar-ve-tuning", "ikinci-el-ve-sifir-alisveris",
  "is-makineleri-ve-sanayi", "ustalar-ve-hizmetler", "ozel-ders-ve-egitim", "is-ilanlari",
  "yardimci-arayanlar", "hayvanlar-alemi", "arayanlar-talep-ilanlari",
  "dijital-urunler-ve-hizmetler", "yapi-market-ve-bahce", "muzik-enstrumanlari", "saglik-ve-medikal",
  // Popüler retail alt-kategori landing sayfaları (yüksek arama hacmi)
  "elektronik", "bilgisayar-ve-oyun", "ev-ve-yasam", "beyaz-esya", "mutfak", "kucuk-ev-aletleri",
  "moda", "anne-ve-bebek", "kozmetik-ve-kisisel-bakim", "spor-ve-outdoor", "kitap-ve-hobi",
  "supermarket-ve-gida", "ofis-ve-kirtasiye", "oyuncak", "bahce-ve-yasam", "evcil-hayvan-urunleri"
];

const STATIC = [
  ["/", "daily", "1.0"],
  ["/explore", "hourly", "0.9"],
  ["/kategoriler", "weekly", "0.8"],
  ...CATEGORY_SLUGS.map((s) => [`/kategori/${s}`, "daily", "0.75"]),
  ["/nasil-calisir", "monthly", "0.6"],
  ["/hakkimizda", "monthly", "0.5"],
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

async function main() {
  loadDotEnv();
  const rows = await fetchListings();

  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...STATIC.map(([loc, cf, pr]) => urlTag(loc, cf, pr)),
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
