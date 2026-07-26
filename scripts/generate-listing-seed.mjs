// Build-zamanı ilan snapshot'ı → lib/listing-seed.json.
// AMAÇ: kategori sayfaları SSG'de ilanları BASSIN (store sunucuda boş → eskiden 0 ilan
// bake ediliyordu → grid client'ta 0'dan büyüyünce masaüstü CLS + crawler kategori
// ilanlarını görmüyordu). Seed, store'un yüklediği AYNI sorgudur (listing_public_cards
// status=active, limit 60) → component store boşken (SSG + client-ilk-render) seed'i
// kullanır, store yüklenince canlıya geçer (hydration-safe, seed≈canlı).
// Ağır/ListingCard'ın göstermediği metin alanları (description, sales_pitch, partner_rules,
// delivery_note, ad_assets, share_templates) BOŞALTILIR → bundle ~10KB (mapListing bunları
// `?? []`/`?? ""` ile karşılar; kart yalnız title/price/image/komisyon/rozet gösterir).
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, "..", "lib", "listing-seed.json");

function env(key) {
  const line = readFileSync(join(__dirname, "..", ".env"), "utf8").split("\n").find((l) => l.startsWith(key + "="));
  return line ? line.slice(key.length + 1).trim() : "";
}

const URL = env("EXPO_PUBLIC_SUPABASE_URL");
const KEY = env("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY") || env("EXPO_PUBLIC_SUPABASE_ANON_KEY");

const HEAVY_STR = ["description", "delivery_note"];
const HEAVY_ARR = ["sales_pitch", "partner_rules", "ad_assets", "tags"];

async function main() {
  if (!URL || !KEY) { console.warn("listing-seed: env yok, atlanıyor"); ensureFile(); return; }
  try {
    const endpoint = `${URL}/rest/v1/listing_public_cards?select=*&status=eq.active&order=created_at.desc&limit=60`;
    const res = await fetch(endpoint, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } });
    if (!res.ok) throw new Error("HTTP " + res.status);
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error("dizi değil");
    const trimmed = rows.map((r) => {
      const o = { ...r };
      for (const k of HEAVY_STR) if (k in o) o[k] = "";
      for (const k of HEAVY_ARR) if (k in o) o[k] = [];
      o.share_templates = null;
      return o;
    });
    writeFileSync(OUT, JSON.stringify(trimmed), "utf8");
    console.log(`listing-seed: ${trimmed.length} ilan yazıldı (${Math.round(JSON.stringify(trimmed).length / 1024)}KB) → lib/listing-seed.json`);
  } catch (e) {
    console.warn("listing-seed: çekilemedi (" + e.message + ") — mevcut seed korunuyor");
    ensureFile();
  }
}

// Import kırılmasın diye dosya HER ZAMAN var olmalı (fetch başarısızsa boş dizi).
function ensureFile() {
  if (!existsSync(OUT)) writeFileSync(OUT, "[]", "utf8");
}

main();
