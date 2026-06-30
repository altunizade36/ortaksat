// İdempotent mahalle (neighborhoods) seed — DB bağlantısı (pg) ile.
// Service role key gerektirmez; pooler connection string ile postgres olarak yazar.
//
// Kullanım:
//   SUPABASE_DB_URL="postgresql://postgres.<ref>:<PAROLA>@aws-0-eu-west-1.pooler.supabase.com:5432/postgres" \
//   node scripts/seed-neighborhoods-pg.mjs

import process from "node:process";
import pg from "pg";

const { Client } = pg;
const CONN = process.env.SUPABASE_DB_URL;
if (!CONN) {
  console.error("SUPABASE_DB_URL gerekli.");
  process.exit(1);
}

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

async function insertChunk(client, rows) {
  if (!rows.length) return;
  const cols = 6; // id, province_id, district_id, name, type, slug
  const values = [];
  const params = [];
  rows.forEach((r, i) => {
    const b = i * cols;
    values.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6})`);
    params.push(r.id, r.province_id, r.district_id, r.name, r.type, r.slug);
  });
  const sql = `insert into public.neighborhoods (id, province_id, district_id, name, type, slug)
               values ${values.join(",")}
               on conflict do nothing`;
  await client.query(sql, params);
}

async function main() {
  const client = new Client({ connectionString: CONN, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const provinces = (await client.query("select id, name from provinces")).rows;
  const districts = (await client.query("select id, province_id, name from districts")).rows;
  if (!provinces.length || !districts.length) {
    console.error("provinces/districts boş — önce setup-all.sql çalıştırın.");
    process.exit(1);
  }
  const provByKey = new Map(provinces.map((p) => [key(p.name), p.id]));
  const distByKey = new Map(districts.map((d) => [`${d.province_id}|${key(d.name)}`, d.id]));

  let total = 0, skipped = 0;
  const perDistrict = new Map();
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
      const { name, type } = cleanName(r.mahalle_adi);
      if (!name) { skipped++; continue; } // boş isimli kaydı atla
      const n = (perDistrict.get(districtId) ?? 0) + 1;
      perDistrict.set(districtId, n);
      const id = districtId * 100000 + n;
      batch.push({ id, province_id: provinceId, district_id: districtId, name, type, slug: slug(name) || `m-${id}` });
    }
    for (let i = 0; i < batch.length; i += 500) {
      await insertChunk(client, batch.slice(i, i + 500));
      total += Math.min(500, batch.length - i);
      process.stdout.write(`\r  yüklendi: ${total}`);
    }
    console.log("");
  }
  await client.end();
  console.log(`\nTamam. ${total} mahalle yüklendi, ${skipped} eşleşmeyen atlandı.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
