// DB INTROSPEKSİYON — Supabase Management API'den GERÇEK şema dökümü.
// Tablolar, kolonlar, FK, indeks, constraint, trigger, fonksiyon, view, RLS
// politikaları, grant'lar, boş/kullanılmayan indeksler, satır tahminleri.
// Çıktı: audit/db-schema-raw.json (10-modül denetiminin paylaşılan kanıtı).
//
// Kullanım: node scripts/db-introspect.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const OUT = join(ROOT, "audit");
mkdirSync(OUT, { recursive: true });

// .env yükle
readFileSync(join(ROOT, ".env"), "utf8").split(/\r?\n/).forEach((l) => { const m = l.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; });
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
const REF = "akyzzdwbzgsnhdircuce";
const API = `https://api.supabase.com/v1/projects/${REF}/database/query`;

async function q(name, sql) {
  try {
    const r = await fetch(API, { method: "POST", headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify({ query: sql }) });
    if (!r.ok) { const t = await r.text(); return { error: `${r.status}: ${t.slice(0, 200)}` }; }
    return await r.json();
  } catch (e) { return { error: String(e.message || e) }; }
}

const QUERIES = {
  tables: `select table_schema, table_name, table_type from information_schema.tables where table_schema in ('public','auth','storage','private') order by table_schema, table_name`,
  columns: `select table_schema, table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema in ('public','private') order by table_schema, table_name, ordinal_position`,
  foreignKeys: `select tc.table_schema, tc.table_name, kcu.column_name, ccu.table_name as foreign_table, ccu.column_name as foreign_column, rc.delete_rule, rc.update_rule, tc.constraint_name from information_schema.table_constraints tc join information_schema.key_column_usage kcu on tc.constraint_name=kcu.constraint_name and tc.table_schema=kcu.table_schema join information_schema.constraint_column_usage ccu on ccu.constraint_name=tc.constraint_name join information_schema.referential_constraints rc on rc.constraint_name=tc.constraint_name where tc.constraint_type='FOREIGN KEY' and tc.table_schema in ('public','private') order by tc.table_name`,
  indexes: `select schemaname, tablename, indexname, indexdef from pg_indexes where schemaname in ('public','private') order by tablename, indexname`,
  constraints: `select tc.table_schema, tc.table_name, tc.constraint_type, tc.constraint_name from information_schema.table_constraints tc where tc.table_schema in ('public','private') and tc.constraint_type in ('CHECK','UNIQUE','PRIMARY KEY') order by tc.table_name, tc.constraint_type`,
  triggers: `select event_object_schema as schema, event_object_table as table, trigger_name, event_manipulation, action_timing from information_schema.triggers where event_object_schema in ('public','private') order by event_object_table, trigger_name`,
  functions: `select n.nspname as schema, p.proname as function, pg_get_function_identity_arguments(p.oid) as args, l.lanname as lang, p.prosecdef as security_definer from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang where n.nspname in ('public','private') order by n.nspname, p.proname`,
  views: `select table_schema, table_name from information_schema.views where table_schema in ('public','private') order by table_name`,
  rlsEnabled: `select n.nspname as schema, c.relname as table, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by c.relname`,
  rlsPolicies: `select schemaname, tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname in ('public','private') order by tablename, policyname`,
  grants: `select table_schema, table_name, grantee, string_agg(privilege_type, ',') as privileges from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated','service_role') group by table_schema, table_name, grantee order by table_name, grantee`,
  rowEstimates: `select schemaname, relname as table, n_live_tup as est_rows, n_dead_tup as dead_rows, seq_scan, idx_scan from pg_stat_user_tables where schemaname='public' order by n_live_tup desc`,
  unusedIndexes: `select schemaname, relname as table, indexrelname as index, idx_scan from pg_stat_user_indexes where schemaname='public' and idx_scan=0 order by relname`,
  tableSizes: `select relname as table, pg_size_pretty(pg_total_relation_size(c.oid)) as total_size, pg_total_relation_size(c.oid) as bytes from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' order by pg_total_relation_size(c.oid) desc`,
  rlsDisabledPublic: `select c.relname as table from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity=false order by c.relname`
};

const main = async () => {
  const dump = { generatedFrom: "Supabase Management API — GERÇEK şema", project: REF, timestamp_note: "canlı introspeksiyon", results: {} };
  for (const [name, sql] of Object.entries(QUERIES)) {
    process.stdout.write(`  ${name}… `);
    const res = await q(name, sql);
    const rows = Array.isArray(res) ? res : (res.error ? [] : []);
    dump.results[name] = res.error ? { error: res.error } : { count: rows.length, rows };
    console.log(res.error ? `HATA ${res.error.slice(0, 60)}` : `${rows.length} satır`);
  }
  // özet
  const r = dump.results;
  dump.summary = {
    tables: r.tables?.count ?? 0,
    publicTables: (r.tables?.rows || []).filter((t) => t.table_schema === "public" && t.table_type === "BASE TABLE").length,
    views: r.views?.count ?? 0,
    foreignKeys: r.foreignKeys?.count ?? 0,
    indexes: r.indexes?.count ?? 0,
    triggers: r.triggers?.count ?? 0,
    functions: r.functions?.count ?? 0,
    rlsPolicies: r.rlsPolicies?.count ?? 0,
    rlsDisabledPublicTables: (r.rlsDisabledPublic?.rows || []).map((x) => x.table),
    unusedIndexes: (r.unusedIndexes?.rows || []).length,
    securityDefinerFns: (r.functions?.rows || []).filter((f) => f.security_definer).length
  };
  writeFileSync(join(OUT, "db-schema-raw.json"), JSON.stringify(dump, null, 2), "utf8");
  console.log("\n✓ audit/db-schema-raw.json");
  console.log(JSON.stringify(dump.summary, null, 2));
};
main().catch((e) => { console.error(e); process.exit(1); });
