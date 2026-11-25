/**
 * APPLE İLE GİRİŞ — WEB + ANDROID KURULUMU (tek komut)
 *
 * iOS uygulamasındaki Apple girişi yerel penceredir ve bu betiğe ihtiyaç duymaz. Web sitesinde ve Android
 * uygulamasında Apple girişi tarayıcı yönlendirmesiyle çalışır; bunun için Apple Developer'da:
 *   1) Identifiers → "+" → Services IDs → kimlik ör. com.ortaksat.web → "Sign in with Apple" işaretle → Configure:
 *        Primary App ID:  com.ortaksat.app
 *        Domains:         akyzzdwbzgsnhdircuce.supabase.co
 *        Return URLs:     https://akyzzdwbzgsnhdircuce.supabase.co/auth/v1/callback
 *   2) Keys → "+" → "Sign in with Apple" işaretli anahtar → AuthKey_<KEY_ID>.p8 indir (bir kez indirilebilir).
 *   3) Membership → Team ID.
 *
 * KULLANIM:
 *   node scripts/setup-apple-web-login.mjs <AuthKey_XXXX.p8> <TEAM_ID> <SERVICES_ID>
 *       → gizli anahtarı (ES256 imzalı, 180 gün geçerli) üretir, Supabase'e yazar, düğmeyi açar
 *         (platform_settings.apple_web_login = true; uygulamayı yeniden derlemek gerekmez).
 *   node scripts/setup-apple-web-login.mjs --off      → web/Android Apple düğmesini gizler (iOS etkilenmez).
 *   node scripts/setup-apple-web-login.mjs --status   → mevcut durumu gösterir.
 *
 * ÖNEMLİ: Apple bu gizli anahtarı EN ÇOK 6 AY geçerli sayar. Süre dolmadan betiği aynı .p8 ile yeniden çalıştır;
 * yoksa web/Android Apple girişi "invalid_client" ile durur (iOS etkilenmez). Anahtar içeriği ekrana/depoya yazılmaz.
 */
import { createPrivateKey, sign } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import process from "node:process";

const BUNDLE_ID = "com.ortaksat.app";

function loadDotEnv() {
  const out = {};
  for (const line of readFileSync(resolve(process.cwd(), ".env"), "utf8").split(/\r?\n/)) {
    const m = line.trim().match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^['"]|['"]$/g, "").trim();
  }
  return out;
}

const ENV = loadDotEnv();
const REF = ENV.SUPABASE_PROJECT_REF;
const TOKEN = ENV.SUPABASE_MGMT_TOKEN;
if (!REF || !TOKEN) { console.error(".env içinde SUPABASE_PROJECT_REF / SUPABASE_MGMT_TOKEN yok."); process.exit(1); }
const API = `https://api.supabase.com/v1/projects/${REF}`;

async function call(path, method = "GET", body) {
  const res = await fetch(API + path, {
    method,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status} ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : null;
}
const sql = (query) => call("/database/query", "POST", { query });
const setFlag = (on) => sql(`update public.platform_settings set apple_web_login = ${on ? "true" : "false"}, updated_at = now() where id = 1`);

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");

function appleClientSecret(p8Pem, keyId, teamId, servicesId, days = 180) {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + days * 86400; // Apple sınırı 15.777.000 sn (~182 gün)
  const header = b64url(JSON.stringify({ alg: "ES256", kid: keyId, typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: teamId, iat, exp, aud: "https://appleid.apple.com", sub: servicesId }));
  const signature = sign("sha256", Buffer.from(`${header}.${payload}`), { key: createPrivateKey(p8Pem), dsaEncoding: "ieee-p1363" });
  return { jwt: `${header}.${payload}.${b64url(signature)}`, exp };
}

// Yönetim API'si gizli anahtarı geri VERMEZ (yalnız özetini döndürür) → bitiş tarihi oradan okunamaz.
// Bu yüzden kurulumda bitiş tarihi depoya yazılır (docs/release/apple-web-login.json; gizli bilgi içermez) ve
// asıl sınama giriş servisine sorularak yapılır: Apple'a yönlendiriyor mu, hangi kimlikle?
const RECORD = resolve(process.cwd(), "docs/release/apple-web-login.json");

async function status() {
  const cfg = await call("/config/auth");
  const [row] = await sql("select apple_web_login from public.platform_settings where id = 1");
  let record = null;
  try { record = JSON.parse(readFileSync(RECORD, "utf8")); } catch { /* henüz kurulmamış */ }
  let redirect = "sınanamadı";
  try {
    const res = await fetch(`${ENV.EXPO_PUBLIC_SUPABASE_URL}/auth/v1/authorize?provider=apple&redirect_to=${encodeURIComponent("https://www.ortaksat.com/auth")}`, {
      redirect: "manual", headers: { apikey: ENV.EXPO_PUBLIC_SUPABASE_ANON_KEY || ENV.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY }
    });
    const location = res.headers.get("location") || "";
    redirect = location.startsWith("https://appleid.apple.com/") ? `Apple'a yönlendiriyor (${new URL(location).searchParams.get("client_id")})` : `yönlendirmiyor (HTTP ${res.status})`;
  } catch { /* ağ hatası */ }
  console.log("Apple sağlayıcısı etkin :", cfg.external_apple_enabled);
  console.log("İstemci kimlikleri      :", cfg.external_apple_client_id);
  console.log("Giriş servisi sınaması  :", redirect);
  console.log("Gizli anahtar bitişi    :", record?.secretExpires ? `${record.secretExpires} (anahtar ${record.keyId})` : "kayıt yok");
  console.log("Web/Android düğmesi     :", row?.apple_web_login ? "AÇIK" : "kapalı");
}

const args = process.argv.slice(2);
if (args[0] === "--status") { await status(); process.exit(0); }
if (args[0] === "--off") { await setFlag(false); console.log("Web/Android Apple düğmesi gizlendi (iOS etkilenmez)."); process.exit(0); }
if (args.length < 3) {
  console.error("Kullanım: node scripts/setup-apple-web-login.mjs <AuthKey_XXXX.p8> <TEAM_ID> <SERVICES_ID>   (ya da --status / --off)");
  process.exit(1);
}

const [p8Path, teamId, servicesId] = args;
const keyId = (basename(p8Path).match(/AuthKey_([A-Z0-9]+)\.p8$/i) || [])[1];
if (!keyId) { console.error("Anahtar kimliği dosya adından okunamadı (AuthKey_<KEY_ID>.p8 bekleniyor)."); process.exit(1); }
if (!/^[A-Z0-9]{10}$/.test(teamId)) { console.error("Team ID 10 karakter (büyük harf/rakam) olmalı."); process.exit(1); }
if (servicesId === BUNDLE_ID) { console.error("Services ID, uygulama kimliğiyle (com.ortaksat.app) AYNI olamaz; ör. com.ortaksat.web."); process.exit(1); }

const { jwt, exp } = appleClientSecret(readFileSync(p8Path, "utf8"), keyId, teamId, servicesId);
// İlk kimlik tarayıcı akışında kullanılır (Services ID); ikincisi iOS yerel belirtecinin hedefi (bundle ID).
await call("/config/auth", "PATCH", {
  external_apple_enabled: true,
  external_apple_client_id: `${servicesId},${BUNDLE_ID}`,
  external_apple_secret: jwt
});
await setFlag(true);
writeFileSync(RECORD, JSON.stringify({ servicesId, teamId, keyId, secretExpires: new Date(exp * 1000).toISOString().slice(0, 10), configuredAt: new Date().toISOString().slice(0, 10) }, null, 2) + "\n");
console.log(`Tamam: Apple ile giriş web ve Android'de açıldı. Gizli anahtar ${new Date(exp * 1000).toISOString().slice(0, 10)} tarihinde biter — öncesinde bu betiği yeniden çalıştır.`);
await status();
