// İdempotent mahalle (neighborhoods) seed.
// Tam Türkiye mahalle verisini resmi-kaynak JSON'lardan indirir, projedeki
// provinces/districts id'lerine (plaka kodu tabanlı) eşler ve Supabase'e
// batch'ler hâlinde upsert eder. Tekrar çalıştırınca duplicate oluşturmaz.
//
// Kullanım:
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node supabase/seed/seed-neighborhoods.mjs
//
// Not: SERVICE ROLE key sadece sunucuda/yerelde kullanılır, frontend'e konmaz.

import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY gerekli.");
  process.exit(1);
}
const supabase = createClient(URL, KEY, { auth: { persistSession: false } });

const SOURCE = "https://raw.githubusercontent.com/metinyildirimnet/turkiye-adresler-json/master";
const FILES = ["mahalleler-1.json", "mahalleler-2.json", "mahalleler-3.json", "mahalleler-4.json"];

const TR = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u" };
const slug = (s) => s.trim().toLocaleLowerCase("tr-TR").replace(/[çğıöşü]/g, (c) => TR[c]).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
const key = (s) => s.trim().toLocaleLowerCase("tr-TR").replace(/[çğıöşü]/g, (c) => TR[c]).replace(/[^a-z0-9]/g, "");
const titleTr = (s) => s.trim().toLocaleLowerCase("tr-TR").replace(/(^|[ \-'])([a-zçğıiöşü])/g, (m, p, c) => p + c.toLocaleUpperCase("tr-TR"));

function cleanName(raw) {
  let name = raw.trim();
  let type = "Mahalle";
  if (/KÖYÜ$/i.test(name)) { type = "Köy"; name = name.replace(/KÖYÜ$/i, "").trim(); }
  else if (/MAHALLES[İI]$/i.test(name)) { name = name.replace(/MAHALLES[İI]$/i, "").trim(); }
  else if (/BELDES[İI]$/i.test(name)) { type = "Belde"; name = name.replace(/BELDES[İI]$/i, "").trim(); }
  return { name: titleTr(name), type };
}

async function main() {
  // 1) projedeki il/ilçe id eşlemesi: (ilKey, ilceKey) -> {provinceId, districtId}
  const { data: provinces } = await supabase.from("provinces").select("id,name");
  const { data: districts } = await supabase.from("districts").select("id,province_id,name");
  if (!provinces?.length || !districts?.length) {
    console.error("Önce seed-locations.sql çalıştırılmalı (provinces/districts boş).");
    process.exit(1);
  }
  const provByKey = new Map(provinces.map((p) => [key(p.name), p.id]));
  const distByKey = new Map(districts.map((d) => [`${d.province_id}|${key(d.name)}`, d.id]));

  let total = 0, skipped = 0, perDistrictCounter = new Map();
  for (const file of FILES) {
    process.stdout.write(`İndiriliyor: ${file} … `);
    const res = await fetch(`${SOURCE}/${file}`);
    const rows = await res.json();
    console.log(`${rows.length} kayıt`);

    const batch = [];
    for (const r of rows) {
      const provinceId = provByKey.get(key(r.sehir_adi));
      const districtId = provinceId != null ? distByKey.get(`${provinceId}|${key(r.ilce_adi)}`) : undefined;
      if (provinceId == null || districtId == null) { skipped++; continue; }
      const n = perDistrictCounter.get(districtId) ?? 0;
      perDistrictCounter.set(districtId, n + 1);
      const id = districtId * 100000 + (n + 1);
      const { name, type } = cleanName(r.mahalle_adi);
      batch.push({ id, province_id: provinceId, district_id: districtId, name, type, slug: slug(name) || `m-${id}` });
    }
    // upsert in chunks of 1000
    for (let i = 0; i < batch.length; i += 1000) {
      const chunk = batch.slice(i, i + 1000);
      const { error } = await supabase.from("neighborhoods").upsert(chunk, { onConflict: "id" });
      if (error) { console.error("upsert hatası:", error.message); process.exit(1); }
      total += chunk.length;
      process.stdout.write(`\r  yüklendi: ${total}`);
    }
    console.log("");
  }
  console.log(`\nTamam. ${total} mahalle yüklendi, ${skipped} eşleşmeyen atlandı.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
