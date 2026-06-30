// OrtakSat — tüm production şemasını tek komutla uygular.
// Kullanım:
//   SUPABASE_DB_URL="postgresql://postgres.<ref>:<PAROLA>@aws-0-<bolge>.pooler.supabase.com:5432/postgres" \
//   node scripts/apply-all.mjs
// veya .env içine SUPABASE_DB_URL ekleyip:  node scripts/apply-all.mjs
//
// Her ifadeyi ayrı (autocommit) çalıştırır; böylece `ALTER TYPE ... ADD VALUE`
// transaction kısıtına takılmaz ve idempotent "already exists" hataları atlanır.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

const FILES = [
  "supabase/setup-all.sql",
  "supabase/migrations/20260630140000_production_hardening.sql"
];

// Tekrar uygulamada zararsız sayılan hata desenleri (idempotent koşumlar).
const BENIGN = [
  /already exists/i,
  /does not exist, skipping/i,
  /duplicate key value/i,
  /already a member/i,
  /is already/i
];

function loadDotEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!m) continue;
      if (!process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    /* .env opsiyonel */
  }
}

// Dollar-quote ($$...$$ / $tag$...$tag$), tek tırnak ve yorumlara duyarlı SQL bölücü.
function splitStatements(sql) {
  const out = [];
  let buf = "";
  let i = 0;
  const n = sql.length;
  let inSingle = false;
  let dollarTag = null;
  while (i < n) {
    const c = sql[i];
    const next2 = sql.slice(i, i + 2);
    if (!inSingle && !dollarTag && next2 === "--") {
      const nl = sql.indexOf("\n", i);
      const end = nl === -1 ? n : nl;
      buf += sql.slice(i, end);
      i = end;
      continue;
    }
    if (!inSingle && !dollarTag && next2 === "/*") {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      buf += sql.slice(i, stop);
      i = stop;
      continue;
    }
    if (!inSingle && !dollarTag && c === "$") {
      const m = sql.slice(i).match(/^\$[A-Za-z0-9_]*\$/);
      if (m) {
        dollarTag = m[0];
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (dollarTag) {
      if (sql.slice(i, i + dollarTag.length) === dollarTag) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buf += c;
      i += 1;
      continue;
    }
    if (c === "'") {
      inSingle = !inSingle;
      buf += c;
      i += 1;
      continue;
    }
    if (!inSingle && c === ";") {
      const stmt = buf.trim();
      if (stmt) out.push(stmt);
      buf = "";
      i += 1;
      continue;
    }
    buf += c;
    i += 1;
  }
  const tail = buf.trim();
  if (tail) out.push(tail);
  return out;
}

function url() {
  return process.env.SUPABASE_DB_URL || process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.DIRECT_URL || "";
}

async function applyFile(client, file) {
  const sql = readFileSync(resolve(process.cwd(), file), "utf8");
  const statements = splitStatements(sql);
  let ok = 0;
  let skipped = 0;
  const errors = [];
  for (const stmt of statements) {
    try {
      await client.query(stmt);
      ok += 1;
    } catch (err) {
      const msg = String(err?.message ?? err);
      if (BENIGN.some((re) => re.test(msg))) {
        skipped += 1;
      } else {
        errors.push({ msg, head: stmt.slice(0, 90).replace(/\s+/g, " ") });
      }
    }
  }
  console.log(`  ${file}: ${ok} ok, ${skipped} atlandı (zaten var), ${errors.length} hata`);
  for (const e of errors.slice(0, 12)) console.log(`    ✗ ${e.head}…\n       ${e.msg}`);
  return errors.length;
}

async function main() {
  loadDotEnv();
  const conn = url();
  if (!conn) {
    console.error("HATA: SUPABASE_DB_URL bulunamadı. .env'e ekleyin veya komut başında verin.");
    console.error('Örnek (session pooler, IPv4): postgresql://postgres.akyzzdwbzgsnhdircuce:<PAROLA>@aws-0-eu-central-1.pooler.supabase.com:5432/postgres');
    process.exit(1);
  }
  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  console.log("Bağlanılıyor…");
  await client.connect();
  console.log("Bağlandı. Şema uygulanıyor:\n");
  let totalErrors = 0;
  for (const f of FILES) totalErrors += await applyFile(client, f);
  await client.end();
  console.log(`\nBitti. Toplam kritik hata: ${totalErrors}`);
  process.exit(totalErrors > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error("Beklenmeyen hata:", e?.message ?? e);
  process.exit(1);
});
