// "APPLE İLE GİRİŞ" BELİRTEÇLERİ (2026-11-16) — App Store kuralı 5.1.1(v): hesap silinirken Apple bağlantısı iptal edilir.
//
//   POST { action: "store", code }  → girişte alınan yetkilendirme kodunu Apple'da yenileme belirtecine çevirip saklar
//   POST { action: "revoke" }       → çağıranın saklı belirtecini Apple'da iptal eder ve kaydı siler (hesap silme talebinde)
//
// İkisi de geçerli kullanıcı oturumu ister ve YALNIZ çağıranın kendi kaydına dokunur.
// Apple anahtarları (APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY, APPLE_CLIENT_ID) tanımlı değilse işlev hiçbir şey
// yapmaz ve { skipped: true } döner — giriş ve hesap silme bundan ASLA etkilenmez.
import { createClient } from "npm:@supabase/supabase-js@2.107.0";
import { SignJWT, importPKCS8 } from "npm:jose@5.9.6";

const APPLE = "https://appleid.apple.com";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

async function clientSecret(): Promise<{ clientId: string; secret: string } | null> {
  const teamId = Deno.env.get("APPLE_TEAM_ID"), keyId = Deno.env.get("APPLE_KEY_ID");
  const pem = (Deno.env.get("APPLE_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n");
  const clientId = Deno.env.get("APPLE_CLIENT_ID") ?? "com.ortaksat.app";
  if (!teamId || !keyId || !pem.includes("PRIVATE KEY")) return null;
  const key = await importPKCS8(pem, "ES256");
  const secret = await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: keyId })
    .setIssuer(teamId).setSubject(clientId).setAudience(APPLE)
    .setIssuedAt().setExpirationTime("10m")
    .sign(key);
  return { clientId, secret };
}

async function form(path: string, fields: Record<string, string>) {
  return fetch(APPLE + path, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(fields) });
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return json({ error: "Unavailable" }, 503);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const jwt = (request.headers.get("Authorization") ?? "").replace(/^Bearer /i, "");
  if (!jwt || jwt.length > 4096) return json({ error: "Unauthorized" }, 401);
  const { data: caller } = await admin.auth.getUser(jwt);
  const userId = caller?.user?.id;
  if (!userId) return json({ error: "Unauthorized" }, 401);

  let body: { action?: string; code?: string } = {};
  try { body = await request.json(); } catch { /* boş gövde */ }

  const creds = await clientSecret().catch(() => null);
  if (!creds) return json({ skipped: true, reason: "apple-keys-missing" });

  if (body.action === "store") {
    const code = typeof body.code === "string" ? body.code.trim() : "";
    if (!code || code.length > 2048) return json({ error: "Bad request" }, 400);
    const res = await form("/auth/token", { client_id: creds.clientId, client_secret: creds.secret, code, grant_type: "authorization_code" });
    if (!res.ok) return json({ error: "exchange-failed", status: res.status }, 502);
    const token = (await res.json()) as { refresh_token?: string };
    if (!token.refresh_token) return json({ stored: false });
    const { error } = await admin.from("apple_tokens").upsert({ user_id: userId, refresh_token: token.refresh_token, updated_at: new Date().toISOString() });
    return json({ stored: !error });
  }

  if (body.action === "revoke") {
    const { data: row } = await admin.from("apple_tokens").select("refresh_token").eq("user_id", userId).maybeSingle();
    if (!row?.refresh_token) return json({ revoked: false, reason: "no-token" });
    const res = await form("/auth/revoke", { client_id: creds.clientId, client_secret: creds.secret, token: row.refresh_token, token_type_hint: "refresh_token" });
    if (!res.ok) return json({ revoked: false, status: res.status }, 502);
    await admin.from("apple_tokens").delete().eq("user_id", userId);
    return json({ revoked: true });
  }

  return json({ error: "Bad request" }, 400);
});
