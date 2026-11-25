/**
 * APP STORE CONNECT — API ile yapılan işler (tarayıcı gerekmez).
 *
 *   node scripts/app-store-connect.mjs durum
 *       → sürüm, Türkçe sayfa, ekran görüntüsü setleri ve inceleme bilgisinin durumu
 *   node scripts/app-store-connect.mjs gorseller [--degistir]
 *       → store/screenshots/ios-6.9 ve ipad-13 görsellerini sürümün Türkçe sayfasına yükler
 *         (sette görsel varsa dokunmaz; --degistir önce eskileri siler)
 *   node scripts/app-store-connect.mjs inceleme-hesabi <dosya>
 *       → dosyadaki "E-posta:" ve "Şifre:" satırlarını inceleme bilgilerine (demo hesap) yazar, "giriş gerekli" açık.
 *         Şifre ekrana YAZILMAZ.
 *
 * Anahtar depoda DURMAZ: ASC_KEY_PATH (varsayılan ~/.ortaksat-keys/AuthKey_<KEY_ID>.p8), ASC_KEY_ID, ASC_ISSUER_ID.
 */
import { createHash, createPrivateKey, sign } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import process from "node:process";

const APP_ID = "6839320320";
const KEY_ID = process.env.ASC_KEY_ID || "ZAAZ4C3NLL";
const ISSUER_ID = process.env.ASC_ISSUER_ID || "89f3c3c5-4303-43fe-b799-dbf72adefff2";
const KEY_PATH = process.env.ASC_KEY_PATH || join(homedir(), ".ortaksat-keys", `AuthKey_${KEY_ID}.p8`);
const LOCALE = "tr";
// Klasör → App Store Connect ekran türü (6,9" telefon seti 6,7" ile aynı türdür; 13" iPad = 12,9" 3. kuşak türü).
const SETS = [
  { dir: "store/screenshots/ios-6.9", type: "APP_IPHONE_67" },
  { dir: "store/screenshots/ipad-13", type: "APP_IPAD_PRO_3GEN_129" }
];

const b64url = (value) => Buffer.from(value).toString("base64url");
function token() {
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "ES256", kid: KEY_ID, typ: "JWT" }));
  const body = b64url(JSON.stringify({ iss: ISSUER_ID, iat: now, exp: now + 900, aud: "appstoreconnect-v1" }));
  const signature = sign("sha256", Buffer.from(`${head}.${body}`), { key: createPrivateKey(readFileSync(KEY_PATH, "utf8")), dsaEncoding: "ieee-p1363" });
  return `${head}.${body}.${signature.toString("base64url")}`;
}
async function api(path, method = "GET", body) {
  const res = await fetch(path.startsWith("http") ? path : `https://api.appstoreconnect.apple.com${path}`, {
    method,
    headers: { Authorization: `Bearer ${token()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 400);
    try { detail = JSON.parse(text).errors.map((e) => `${e.code}: ${e.detail}`).join(" | "); } catch { /* ham metin */ }
    throw new Error(`${method} ${path.split("?")[0]} → ${res.status} ${detail}`);
  }
  return text ? JSON.parse(text) : null;
}

async function editableVersion() {
  const versions = (await api(`/v1/apps/${APP_ID}/appStoreVersions?filter[platform]=IOS&limit=10`)).data;
  if (!versions.length) throw new Error("Uygulamada iOS sürümü yok.");
  return versions.find((v) => /PREPARE_FOR_SUBMISSION|REJECTED|DEVELOPER_REJECTED|METADATA_REJECTED|INVALID_BINARY/.test(v.attributes.appStoreState)) ?? versions[0];
}
async function localization(versionId) {
  const list = (await api(`/v1/appStoreVersions/${versionId}/appStoreVersionLocalizations?limit=50`)).data;
  const found = list.find((l) => l.attributes.locale === LOCALE) ?? list.find((l) => l.attributes.locale.startsWith(LOCALE));
  if (!found) throw new Error(`Türkçe sayfa yok (mevcut: ${list.map((l) => l.attributes.locale).join(", ")}).`);
  return found;
}
async function screenshotSets(localizationId) {
  return (await api(`/v1/appStoreVersionLocalizations/${localizationId}/appScreenshotSets?include=appScreenshots&limit=50`));
}

async function status() {
  const version = await editableVersion();
  const loc = await localization(version.id);
  console.log(`Sürüm ${version.attributes.versionString} — ${version.attributes.appStoreState}; sayfa: ${loc.attributes.locale}`);
  const sets = await screenshotSets(loc.id);
  for (const set of sets.data) {
    const shots = (sets.included ?? []).filter((s) => set.relationships.appScreenshots.data.some((d) => d.id === s.id));
    console.log(`  ${set.attributes.screenshotDisplayType}: ${shots.length} görsel — ${shots.map((s) => s.attributes.assetDeliveryState?.state ?? "?").join(", ")}`);
  }
  if (!sets.data.length) console.log("  ekran görüntüsü seti yok");
  const review = await api(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`).catch(() => null);
  const a = review?.data?.attributes;
  console.log(a ? `İnceleme: iletişim ${a.contactEmail ? "var" : "YOK"}, demo hesap ${a.demoAccountName || "YOK"}, giriş gerekli: ${a.demoAccountRequired}, not ${a.notes ? "var" : "YOK"}` : "İnceleme bilgisi yok");
  const builds = (await api(`/v1/builds?filter[app]=${APP_ID}&limit=5&sort=-uploadedDate`)).data;
  console.log(builds.length ? `Yüklenen derlemeler: ${builds.map((b) => `${b.attributes.version} (${b.attributes.processingState})`).join(", ")}` : "Yüklenen derleme yok");
}

async function uploadScreenshots(replace) {
  const version = await editableVersion();
  const loc = await localization(version.id);
  const sets = await screenshotSets(loc.id);
  for (const { dir, type } of SETS) {
    const files = readdirSync(resolve(dir)).filter((f) => /\.(png|jpe?g)$/i.test(f)).sort();
    let set = sets.data.find((s) => s.attributes.screenshotDisplayType === type);
    if (!set) {
      set = (await api("/v1/appScreenshotSets", "POST", { data: { type: "appScreenshotSets", attributes: { screenshotDisplayType: type }, relationships: { appStoreVersionLocalization: { data: { type: "appStoreVersionLocalizations", id: loc.id } } } } })).data;
    }
    const existing = set.relationships?.appScreenshots?.data ?? [];
    if (existing.length && !replace) { console.log(`${type}: sette zaten ${existing.length} görsel var, dokunulmadı (--degistir ile yenilenir)`); continue; }
    for (const shot of existing) await api(`/v1/appScreenshots/${shot.id}`, "DELETE");
    for (const file of files) {
      const path = resolve(dir, file);
      const bytes = readFileSync(path);
      const created = (await api("/v1/appScreenshots", "POST", { data: { type: "appScreenshots", attributes: { fileName: file, fileSize: statSync(path).size }, relationships: { appScreenshotSet: { data: { type: "appScreenshotSets", id: set.id } } } } })).data;
      for (const op of created.attributes.uploadOperations) {
        const headers = Object.fromEntries(op.requestHeaders.map((h) => [h.name, h.value]));
        const put = await fetch(op.url, { method: op.method, headers, body: bytes.subarray(op.offset, op.offset + op.length) });
        if (!put.ok) throw new Error(`${file} parça yüklenemedi: ${put.status}`);
      }
      await api(`/v1/appScreenshots/${created.id}`, "PATCH", { data: { type: "appScreenshots", id: created.id, attributes: { uploaded: true, sourceFileChecksum: createHash("md5").update(bytes).digest("hex") } } });
      console.log(`${type}: ${file} yüklendi`);
    }
  }
}

async function setReviewAccount(file) {
  const text = readFileSync(file, "utf8");
  const email = (text.match(/E-posta:\s*(\S+)/) || [])[1];
  const password = (text.match(/(?:Şifre|Yeni şifre):\s*(\S+)/) || [])[1];
  if (!email || !password) throw new Error("Dosyada 'E-posta:' ve 'Şifre:' satırları bulunamadı.");
  const version = await editableVersion();
  const attributes = { demoAccountName: email, demoAccountPassword: password, demoAccountRequired: true };
  const current = await api(`/v1/appStoreVersions/${version.id}/appStoreReviewDetail`).catch(() => null);
  if (current?.data?.id) await api(`/v1/appStoreReviewDetails/${current.data.id}`, "PATCH", { data: { type: "appStoreReviewDetails", id: current.data.id, attributes } });
  else await api("/v1/appStoreReviewDetails", "POST", { data: { type: "appStoreReviewDetails", attributes, relationships: { appStoreVersion: { data: { type: "appStoreVersions", id: version.id } } } } });
  console.log(`İnceleme demo hesabı yazıldı: ${email} (şifre gösterilmez), giriş gerekli: evet`);
}

const [command, ...rest] = process.argv.slice(2);
try {
  if (command === "durum") await status();
  else if (command === "gorseller") await uploadScreenshots(rest.includes("--degistir"));
  else if (command === "inceleme-hesabi" && rest[0]) await setReviewAccount(rest[0]);
  else { console.error("Kullanım: node scripts/app-store-connect.mjs durum | gorseller [--degistir] | inceleme-hesabi <dosya>"); process.exit(1); }
} catch (error) {
  console.error("HATA:", error.message);
  process.exit(1);
}
