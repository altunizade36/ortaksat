/**
 * SUPABASE ADVISORS (Security + Performance linter) TEŞHİS
 *
 * Dashboard'daki "Advisors" sekmesinin (hata/uyarı listesi) API karşılığı.
 * Management token ile çeker, seviyeye göre gruplar. Salt-okunur teşhis.
 *
 * KULLANIM: node scripts/supabase-advisors.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

function loadDotEnv() {
  try {
    const content = readFileSync(resolve(process.cwd(), ".env"), "utf8");
    for (const line of content.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    /* opsiyonel */
  }
}

loadDotEnv();

const REF = process.env.SUPABASE_PROJECT_REF;
const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
if (!REF || !TOKEN) {
  console.error("HATA: SUPABASE_PROJECT_REF / SUPABASE_MGMT_TOKEN .env'de yok.");
  process.exit(1);
}

async function advisors(kind) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/advisors/${kind}`, {
    headers: { Authorization: `Bearer ${TOKEN}` }
  });
  if (!r.ok) throw new Error(`${kind} ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return Array.isArray(j.lints) ? j.lints : [];
}

function summarize(lints) {
  const byName = new Map();
  for (const l of lints) {
    const key = l.name;
    if (!byName.has(key)) byName.set(key, { ...l, count: 0, objects: [] });
    const e = byName.get(key);
    e.count++;
    const obj = l.metadata?.name || l.metadata?.entity || l.cache_key || "";
    if (obj) e.objects.push(obj);
  }
  return [...byName.values()];
}

const RANK = { ERROR: 0, WARN: 1, INFO: 2 };

(async () => {
  for (const kind of ["security", "performance"]) {
    console.log(`\n${"=".repeat(70)}\n  ${kind.toUpperCase()} ADVISOR\n${"=".repeat(70)}`);
    let lints;
    try {
      lints = await advisors(kind);
    } catch (e) {
      console.log("  alınamadı:", e.message);
      continue;
    }
    if (lints.length === 0) {
      console.log("  ✓ uyarı yok");
      continue;
    }
    const groups = summarize(lints).sort(
      (a, b) => (RANK[a.level] ?? 9) - (RANK[b.level] ?? 9) || b.count - a.count
    );
    const counts = lints.reduce((m, l) => ((m[l.level] = (m[l.level] || 0) + 1), m), {});
    console.log(`  toplam ${lints.length} bulgu:`, JSON.stringify(counts));
    for (const g of groups) {
      console.log(`\n  [${g.level}] ${g.name}  ×${g.count}`);
      console.log(`    ${g.title}`);
      if (g.objects.length) console.log(`    nesneler: ${[...new Set(g.objects)].slice(0, 12).join(", ")}${g.objects.length > 12 ? " …" : ""}`);
      if (g.remediation) console.log(`    çözüm: ${g.remediation}`);
    }
  }
})().catch((e) => {
  console.error("HATA:", e.message);
  process.exit(1);
});
