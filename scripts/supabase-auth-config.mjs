// OrtakSat — Supabase Auth yapılandırmasını otomatik ayarlar (Management API).
//  - Site URL + Redirect URL'ler (e-posta doğrulama/şifre sıfırlama + OAuth dönüşü için)
//  - Google sağlayıcısını açar (Client ID + Secret ile)
//
// Kullanım:
//   SUPABASE_MGMT_TOKEN=sbp_... GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... node scripts/supabase-auth-config.mjs

import process from "node:process";

const REF = "akyzzdwbzgsnhdircuce";
const SITE_URL = "https://ortaksat.com";
const REDIRECTS = "https://ortaksat.com/**,https://ortaksat.vercel.app/**,ortaksat://**";

const TOKEN = process.env.SUPABASE_MGMT_TOKEN;
const CID = process.env.GOOGLE_CLIENT_ID;
const CSECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!TOKEN) {
  console.error("HATA: SUPABASE_MGMT_TOKEN gerekli (supabase.com/dashboard/account/tokens).");
  process.exit(1);
}

const body = {
  site_url: SITE_URL,
  uri_allow_list: REDIRECTS
};
if (CID && CSECRET) {
  body.external_google_enabled = true;
  body.external_google_client_id = CID;
  body.external_google_secret = CSECRET;
}

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  method: "PATCH",
  headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(body)
});
const text = await res.text();
if (!res.ok) {
  console.error(`HATA ${res.status}: ${text.slice(0, 400)}`);
  process.exit(2);
}
console.log("OK — Supabase Auth ayarlandı:");
console.log("  Site URL:", SITE_URL);
console.log("  Redirect:", REDIRECTS);
console.log("  Google sağlayıcı:", CID && CSECRET ? "AÇILDI" : "(client verilmedi, atlandı)");

// Doğrulama
const check = await fetch(`https://api.supabase.com/v1/projects/${REF}/config/auth`, {
  headers: { Authorization: `Bearer ${TOKEN}` }
});
if (check.ok) {
  const cfg = await check.json();
  console.log("  -> site_url:", cfg.site_url, "| google_enabled:", cfg.external_google_enabled);
}
