/**
 * category_seed.json → Supabase public.categories yükleyici.
 * Batch INSERT + parent_id çözümleme (parent_path üzerinden).
 * Çalıştır: node scripts/load-categories.mjs   (.env'den SUPABASE_MGMT_TOKEN)
 */
import { readFileSync, existsSync } from "node:fs";

const REF = "akyzzdwbzgsnhdircuce";
// Token .env'den (SUPABASE_MGMT_TOKEN veya SUPABASE_ACCESS_TOKEN) okunur.
function envToken() {
  for (const k of ["SUPABASE_MGMT_TOKEN", "SUPABASE_ACCESS_TOKEN", "E2E_SUPABASE_MGMT"]) {
    if (process.env[k]) return process.env[k];
  }
  if (existsSync(".env")) {
    for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
      const m = line.match(/^(SUPABASE_MGMT_TOKEN|SUPABASE_ACCESS_TOKEN)\s*=\s*(.+)$/);
      if (m) return m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return process.argv[2] || null;
}
const TOKEN = envToken();
if (!TOKEN) { console.error("Mgmt token yok (SUPABASE_MGMT_TOKEN veya argv[2])."); process.exit(1); }

async function sql(query) {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });
  if (!res.ok) throw new Error(`SQL ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res.json();
}
const q = (s) => (s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const n = (v) => (v === null || v === undefined || v === "" ? "null" : Number(v));
const b = (v) => (v ? "true" : "false");

const seed = JSON.parse(readFileSync("data/category_seed.json", "utf8"));
const rows = seed.categories;
console.log(`Yüklenecek: ${rows.length} kategori`);

await sql("truncate table public.categories restart identity cascade; alter table public.categories add column if not exists _pp text;");

const cols = "(path, _pp, slug, name, full_name, level, sort_order, kind, is_leaf, form_schema_key, google_product_category_id, google_product_category)";
const CHUNK = 400;
let done = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const batch = rows.slice(i, i + CHUNK);
  const values = batch.map((r) =>
    `(${q(r.path)}, ${q(r.parent_path)}, ${q(r.slug)}, ${q(r.name)}, ${q(r.full_name)}, ${n(r.level)}, ${n(r.sort_order)}, ${q(r.kind)}, ${b(r.is_leaf)}, ${q(r.form_schema_key)}, ${n(r.google_product_category_id)}, ${q(r.google_product_category)})`
  ).join(",\n");
  await sql(`insert into public.categories ${cols} values\n${values}\non conflict (path) do nothing;`);
  done += batch.length;
  process.stdout.write(`\r  yüklendi ${done}/${rows.length}`);
}
console.log("");

console.log("parent_id çözümleniyor...");
await sql(`update public.categories c set parent_id = p.id from public.categories p where c._pp is not null and p.path = c._pp;`);
await sql(`alter table public.categories drop column if exists _pp;`);

const stats = await sql(`select
  (select count(*) from public.categories) as total,
  (select count(*) from public.categories where parent_id is not null) as with_parent,
  (select count(*) from public.categories where google_product_category_id is not null) as google_mapped,
  (select count(distinct kind) from public.categories) as kinds,
  (select count(*) from public.categories where level=0) as top;`);
console.log("Sonuç:", JSON.stringify(stats[0]));

// Form şemalarını da ayrı tabloya koy (kategori → form alanları).
await sql(`create table if not exists public.category_form_schemas (
  key text primary key, title text, fields jsonb not null default '[]'::jsonb, updated_at timestamptz default now());
alter table public.category_form_schemas enable row level security;
drop policy if exists "cfs readable" on public.category_form_schemas;
create policy "cfs readable" on public.category_form_schemas for select using (true);
drop policy if exists "cfs admin" on public.category_form_schemas;
create policy "cfs admin" on public.category_form_schemas for all using (public.is_admin()) with check (public.is_admin());`);
const fs2 = seed.form_schemas || {};
const fvals = Object.values(fs2).map((s) => `(${q(s.key)}, ${q(s.title)}, ${q(JSON.stringify(s.fields))}::jsonb)`).join(",\n");
if (fvals) await sql(`insert into public.category_form_schemas (key, title, fields) values\n${fvals}\non conflict (key) do update set title=excluded.title, fields=excluded.fields, updated_at=now();`);
console.log(`Form şemaları yüklendi: ${Object.keys(fs2).length}`);
console.log("BİTTİ.");
