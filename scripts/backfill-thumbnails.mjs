/**
 * EKSİK KART THUMBNAIL BACKFILL
 *
 * Sorun: ilan kartları HER ZAMAN `<uuid>-t.jpg` (512px küçük varyant) ister
 * (bkz. lib/image-url.ts → cardImageUrl). Bu küçük varyant normalde yükleme
 * anında üretilir (bkz. lib/live-service.ts → uploadListingImage). Ama eski
 * ilanlarda ya da tarayıcının canvas sıkıştırması başarısız olduğunda thumbnail
 * hiç oluşmamış olabilir → kart tam-boyut (1600px, ~400KB) görseli indirir →
 * gereksiz bant + yavaş LCP. Bu araç eksik thumbnail'leri bulur ve üretir.
 *
 * NE YAPAR:
 *   1) TESPİT (anon key yeter): listing_public_cards.image_url kapaklarını tarar
 *      (service key varsa listings.images galeri görsellerini de) ve her orijinal
 *      görsel için `-t.jpg` küçük varyantının public URL'ini HEAD ile yoklar.
 *   2) BACKFILL (service key şart): eksik olan her thumbnail için orijinali indirir,
 *      jimp ile 512px genişliğe küçültür (JPEG q72, kalite kaybı yükleme anıyla
 *      aynı sözleşme) ve storage'a `<userId>/<uuid>-t.jpg` olarak yükler (upsert).
 *
 * KULLANIM:
 *   node scripts/backfill-thumbnails.mjs            # sadece tarar + rapor (dry-run)
 *   SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/backfill-thumbnails.mjs --apply
 *
 * NOT: --apply için SUPABASE_SERVICE_ROLE_KEY gerekir (storage RLS: thumbnail
 * ilan sahibinin klasörüne yazılır, sadece service_role tüm klasörlere yazabilir).
 * Anahtar Supabase Dashboard → Project Settings → API → service_role secret.
 * .env'e eklemene gerek yok; yukarıdaki gibi tek seferlik geçebilirsin.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { Jimp } from "jimp";

function loadDotEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const value = match[2].replace(/^['"]|['"]$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    /* .env opsiyonel */
  }
}

loadDotEnv();

const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL || "").replace(/\/$/, "");
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const APPLY = process.argv.includes("--apply");

if (!SUPABASE_URL || !ANON_KEY) {
  console.error("HATA: EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY .env'de yok.");
  process.exit(1);
}
if (APPLY && !SERVICE_KEY) {
  console.error("HATA: --apply için SUPABASE_SERVICE_ROLE_KEY gerekir (storage RLS bypass).");
  console.error("Örnek: SUPABASE_SERVICE_ROLE_KEY=eyJ... node scripts/backfill-thumbnails.mjs --apply");
  process.exit(1);
}

const BUCKET = "listing-images";
const PUBLIC_PREFIX = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;

// cardImageUrl (lib/image-url.ts) ile birebir aynı türetme: listing-images altındaki
// <base>.<ext> için thumbnail = <base>-t.jpg (base zaten -t ile bitmiyorsa).
function thumbUrlFor(url) {
  const m = String(url).match(/^(.*\/listing-images\/.+)\.(jpe?g|png|webp)(\?.*)?$/i);
  if (!m || /-t$/i.test(m[1])) return null;
  return `${m[1]}-t.jpg`;
}

// public URL → bucket içi obje yolu (<userId>/<uuid>.<ext>)
function objectKeyFromPublicUrl(url) {
  if (!url.startsWith(PUBLIC_PREFIX)) return null;
  return url.slice(PUBLIC_PREFIX.length).split("?")[0];
}

async function restGet(pathAndQuery, key = ANON_KEY) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` }
  });
  if (!r.ok) throw new Error(`REST ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.json();
}

// Tüm kapak görseli URL'lerini (ve varsa galeri) topla.
async function collectOriginalUrls() {
  const urls = new Set();

  // Kapaklar — anon görebilir (listing_public_cards view).
  for (let offset = 0; ; offset += 1000) {
    const rows = await restGet(
      `listing_public_cards?select=image_url&image_url=not.is.null&order=created_at.asc&limit=1000&offset=${offset}`
    );
    for (const row of rows) if (row.image_url) urls.add(row.image_url);
    if (rows.length < 1000) break;
  }

  // Galeri görselleri — sadece service key ile (listings tablosu anon'a kapalı).
  if (SERVICE_KEY) {
    for (let offset = 0; ; offset += 1000) {
      const rows = await restGet(
        `listings?select=images&order=created_at.asc&limit=1000&offset=${offset}`,
        SERVICE_KEY
      );
      for (const row of rows) {
        const arr = Array.isArray(row.images) ? row.images : [];
        for (const u of arr) if (typeof u === "string") urls.add(u);
      }
      if (rows.length < 1000) break;
    }
  }

  return [...urls];
}

async function headOk(url) {
  try {
    const r = await fetch(url, { method: "HEAD" });
    return r.ok;
  } catch {
    return false;
  }
}

async function generateAndUpload(originalUrl, objectKey) {
  const thumbKey = objectKey.replace(/\.(jpe?g|png|webp)$/i, "-t.jpg");
  const res = await fetch(originalUrl);
  if (!res.ok) throw new Error(`indirilemedi (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());

  const image = await Jimp.read(buf);
  let dim = 512;
  if (image.bitmap.width > dim) image.resize({ w: dim });

  // lib/live-service.ts → compressImageBlob ile aynı sözleşme: hedef ≤120KB.
  // Önce kalite (0.72→0.50), sonra boyut (%20) düşer. Pratikte 1-3 denemede biter.
  const MAX_BYTES = 120 * 1024;
  let quality = 72;
  let out = await image.getBuffer("image/jpeg", { quality });
  for (let i = 0; i < 6 && out.length > MAX_BYTES; i++) {
    if (quality > 50) quality = Math.max(50, quality - 12);
    else {
      dim = Math.round(dim * 0.8);
      image.resize({ w: dim });
    }
    out = await image.getBuffer("image/jpeg", { quality });
  }

  const up = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${thumbKey}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "image/jpeg",
      "x-upsert": "true"
    },
    body: out
  });
  if (!up.ok) throw new Error(`yüklenemedi (${up.status}): ${(await up.text()).slice(0, 160)}`);
  return out.length;
}

(async () => {
  console.log(`Kaynak: ${SUPABASE_URL}`);
  console.log(`Mod: ${APPLY ? "BACKFILL (--apply)" : "sadece tarama (dry-run)"}${SERVICE_KEY ? " · service key VAR (galeri dahil)" : " · anon (yalnız kapaklar)"}`);

  const originals = (await collectOriginalUrls()).filter((u) => thumbUrlFor(u));
  console.log(`Taranan storage görseli: ${originals.length}`);

  const missing = [];
  let checked = 0;
  const CONC = 12;
  for (let i = 0; i < originals.length; i += CONC) {
    const batch = originals.slice(i, i + CONC);
    const results = await Promise.all(
      batch.map(async (orig) => {
        const t = thumbUrlFor(orig);
        return { orig, ok: await headOk(t) };
      })
    );
    for (const r of results) {
      checked++;
      if (!r.ok) missing.push(r.orig);
    }
    process.stdout.write(`\r  kontrol: ${checked}/${originals.length} · eksik: ${missing.length}`);
  }
  process.stdout.write("\n");

  if (missing.length === 0) {
    console.log("✓ Eksik thumbnail yok — tüm kartlar küçük varyant kullanıyor.");
    return;
  }

  console.log(`\nEksik thumbnail (${missing.length}):`);
  for (const u of missing.slice(0, 50)) console.log("  -", u);
  if (missing.length > 50) console.log(`  ... (+${missing.length - 50})`);

  if (!APPLY) {
    console.log("\nDüzeltmek için: SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/backfill-thumbnails.mjs --apply");
    return;
  }

  console.log("\nÜretiliyor...");
  let done = 0;
  let failed = 0;
  for (const orig of missing) {
    const key = objectKeyFromPublicUrl(orig);
    if (!key) {
      console.log("  atlandı (public URL değil):", orig.slice(0, 80));
      failed++;
      continue;
    }
    try {
      const bytes = await generateAndUpload(orig, key);
      done++;
      console.log(`  ✓ ${key.replace(/\.(jpe?g|png|webp)$/i, "-t.jpg")} (${Math.round(bytes / 1024)}KB)`);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${key}: ${e.message}`);
    }
  }
  console.log(`\nBitti: ${done} üretildi, ${failed} başarısız.`);
})().catch((e) => {
  console.error("HATA:", e.message);
  process.exit(1);
});
