// OrtakSat — tek komutla canlıya alma:
//  1) Vercel projesine Supabase env değişkenlerini ekler (production+preview+development)
//  2) ortaksat.com + www.ortaksat.com domainlerini projeye ekler
//  3) En güncel commit'i yeniden deploy eder (env'ler build'e gömülsün)
//  4) Vercel'in istediği DNS kayıtlarını okur ve GoDaddy'ye otomatik uygular (Parked'i değiştirir)
//
// Kullanım:
//   VERCEL_TOKEN=... GODADDY_KEY=... GODADDY_SECRET=... node scripts/go-live.mjs
// (Supabase URL/anahtar .env'den okunur. Hiçbir sır dosyaya yazılmaz/commit edilmez.)

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const PROJECT = "ortaksat";
const APEX = "ortaksat.com";
const WWW = "www.ortaksat.com";

function loadDotEnv() {
  const env = {};
  try {
    for (const line of readFileSync(resolve(process.cwd(), ".env"), "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const m = t.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
  } catch {
    /* opsiyonel */
  }
  return env;
}

const TOKEN = process.env.VERCEL_TOKEN;
const GKEY = process.env.GODADDY_KEY;
const GSECRET = process.env.GODADDY_SECRET;

async function v(path, opts = {}, teamId) {
  const sep = path.includes("?") ? "&" : "?";
  const url = `https://api.vercel.com${path}${teamId ? `${sep}teamId=${teamId}` : ""}`;
  const res = await fetch(url, {
    ...opts,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json", ...(opts.headers || {}) }
  });
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { ok: res.ok, status: res.status, json };
}

async function vercelStep(env) {
  console.log("== VERCEL ==");
  // 0) Takım
  const teams = await v("/v2/teams", {});
  let teamId;
  if (teams.ok && Array.isArray(teams.json.teams)) {
    const t = teams.json.teams.find((x) => x.slug === "fatih5" || x.slug?.startsWith("fatih")) || teams.json.teams[0];
    teamId = t?.id;
    console.log("  takım:", t?.slug, teamId ? "(bulundu)" : "(yok)");
  }
  // 1) Proje
  let proj = await v(`/v9/projects/${PROJECT}`, {}, teamId);
  if (!proj.ok) {
    proj = await v(`/v9/projects/${PROJECT}`, {}); // takımsız dene (kişisel hesap)
    if (proj.ok) teamId = undefined;
  }
  if (!proj.ok) {
    console.log("  HATA: proje bulunamadı:", proj.status, JSON.stringify(proj.json).slice(0, 160));
    return false;
  }
  const projectId = proj.json.id;
  console.log("  proje:", PROJECT, projectId);

  // 2) Env değişkenleri (upsert)
  const vars = [
    ["EXPO_PUBLIC_SUPABASE_URL", env.EXPO_PUBLIC_SUPABASE_URL],
    ["EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY],
    ["EXPO_PUBLIC_SUPABASE_ANON_KEY", env.EXPO_PUBLIC_SUPABASE_ANON_KEY || env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY]
  ];
  for (const [key, value] of vars) {
    if (!value) {
      console.log(`  ! ${key} .env'de yok, atlandı`);
      continue;
    }
    const r = await v(`/v10/projects/${projectId}/env?upsert=true`, {
      method: "POST",
      body: JSON.stringify({ key, value, type: "plain", target: ["production", "preview", "development"] })
    }, teamId);
    console.log(`  env ${key}: ${r.ok ? "OK" : "HATA " + r.status + " " + JSON.stringify(r.json).slice(0, 120)}`);
  }

  // 3) Domainler
  for (const name of [APEX, WWW]) {
    const r = await v(`/v10/projects/${projectId}/domains`, { method: "POST", body: JSON.stringify({ name }) }, teamId);
    const already = r.status === 409 || JSON.stringify(r.json).includes("already");
    console.log(`  domain ${name}: ${r.ok ? "EKLENDI" : already ? "zaten var" : "HATA " + r.status + " " + JSON.stringify(r.json).slice(0, 140)}`);
  }

  // 4) Gerekli DNS kayıtlarını oku (apex A IP + www CNAME hedefi)
  const cfg = await v(`/v6/domains/${APEX}/config`, {}, teamId);
  let apexIp = "76.76.21.21";
  let cnameTarget = "cname.vercel-dns.com";
  if (cfg.ok) {
    const recs = cfg.json.recommendedIPv4 || cfg.json.aValues || cfg.json.recommendedCNAME;
    if (Array.isArray(cfg.json.recommendedIPv4) && cfg.json.recommendedIPv4[0]) apexIp = cfg.json.recommendedIPv4[0];
    if (Array.isArray(cfg.json.aValues) && cfg.json.aValues[0]) apexIp = cfg.json.aValues[0];
    void recs;
  }
  console.log("  istenen DNS -> A @", apexIp, "| CNAME www", cnameTarget);

  // 5) Yeniden deploy (en güncel commit) — env'ler artık build'e gömülür
  const deps = await v(`/v6/deployments?projectId=${projectId}&limit=1&state=READY,BUILDING,QUEUED`, {}, teamId);
  const latest = deps.ok && deps.json.deployments && deps.json.deployments[0];
  if (latest) {
    const rd = await v(`/v13/deployments`, {
      method: "POST",
      body: JSON.stringify({ name: PROJECT, deploymentId: latest.uid, target: "production" })
    }, teamId);
    console.log(`  yeniden deploy: ${rd.ok ? "BASLATILDI " + (rd.json.url || "") : "HATA " + rd.status + " " + JSON.stringify(rd.json).slice(0, 140)}`);
  } else {
    console.log("  ! son deployment bulunamadı; Vercel panelinden 'Redeploy' deyebilirsiniz (env'ler eklendi).");
  }

  return { apexIp, cnameTarget };
}

async function godaddy(records) {
  console.log("== GODADDY ==");
  if (!GKEY || !GSECRET) {
    console.log("  GODADDY_KEY/SECRET verilmedi; DNS otomatik ayarlanmadı.");
    console.log(`  Elle ekleyin -> A  @  ${records?.apexIp || "76.76.21.21"} (TTL 600) ; CNAME  www  ${records?.cnameTarget || "cname.vercel-dns.com"}`);
    return;
  }
  const auth = { Authorization: `sso-key ${GKEY}:${GSECRET}`, "Content-Type": "application/json" };
  const apexIp = records?.apexIp || "76.76.21.21";
  const cnameTarget = records?.cnameTarget || "cname.vercel-dns.com";
  // A @  (Parked'i değiştirir)
  let r = await fetch(`https://api.godaddy.com/v1/domains/${APEX}/records/A/%40`, {
    method: "PUT",
    headers: auth,
    body: JSON.stringify([{ data: apexIp, ttl: 600 }])
  });
  console.log(`  A @ -> ${apexIp}: ${r.ok ? "OK" : "HATA " + r.status + " " + (await r.text()).slice(0, 160)}`);
  // CNAME www
  r = await fetch(`https://api.godaddy.com/v1/domains/${APEX}/records/CNAME/www`, {
    method: "PUT",
    headers: auth,
    body: JSON.stringify([{ data: cnameTarget, ttl: 3600 }])
  });
  console.log(`  CNAME www -> ${cnameTarget}: ${r.ok ? "OK" : "HATA " + r.status + " " + (await r.text()).slice(0, 160)}`);
}

async function main() {
  const env = loadDotEnv();
  if (!TOKEN) {
    console.log("VERCEL_TOKEN verilmedi; Vercel adımı atlanıyor.");
  }
  let records;
  if (TOKEN) records = await vercelStep(env);
  await godaddy(typeof records === "object" ? records : undefined);
  console.log("\nBitti. Yayılma (DNS + SSL) birkaç dakika–saat sürebilir.");
}

main().catch((e) => {
  console.error("Beklenmeyen hata:", e?.message ?? e);
  process.exit(1);
});
