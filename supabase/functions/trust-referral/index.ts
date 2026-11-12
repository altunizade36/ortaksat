import { createClient } from "npm:@supabase/supabase-js@2.107.0";
import { boundedJson } from "../_shared/trust-http.ts";

const encode = new TextEncoder();
async function fingerprint(secret: string, value: string) {
  const key = await crypto.subtle.importKey("raw", encode.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", key, encode.encode(value))), b => b.toString(16).padStart(2, "0")).join("");
}
Deno.serve(async request => {
  const origin = request.headers.get("Origin"), allowed = new Set((Deno.env.get("TRUST_ALLOWED_ORIGINS") || "https://www.ortaksat.com,https://ortaksat.com").split(","));
  const headers: Record<string, string> = { "Content-Type": "application/json", "Cache-Control": "no-store", "Vary": "Origin", "Access-Control-Allow-Headers": "authorization,apikey,content-type,x-client-info", "Access-Control-Allow-Methods": "POST,OPTIONS" };
  const result = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers });
  if (origin && !allowed.has(origin)) return result({ error: "Origin denied" }, 403);
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return result({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL"), service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), mailKey = Deno.env.get("RESEND_API_KEY"), from = Deno.env.get("TRUST_EMAIL_FROM"), secret = Deno.env.get("TRUST_OTP_SECRET");
  // Separate secrets and flag deliberately prevent using existing mail credentials automatically.
  if (Deno.env.get("TRUST_GUEST_ENABLED") !== "true" || !url || !service || !mailKey || !from || !secret || secret.length < 32) return result({ error: "Guest verification unavailable" }, 503);
  try {
    const body = await boundedJson(request, 2048), db = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    if (body.operation === "confirm") {
      if (typeof body.challengeId !== "string" || typeof body.code !== "string" || !/^[a-f0-9-]{36}$/i.test(body.challengeId) || !/^\d{6}$/.test(body.code)) return result({ error: "Invalid code" }, 400);
      const verified = await db.rpc("trust_v1_guest_confirm", { p_challenge_id: body.challengeId, p_code_hash: await fingerprint(secret, `${body.challengeId}:${body.code}`) });
      if (verified.error) throw verified.error;
      return result(verified.data, verified.data?.ok ? 200 : 400);
    }
    if (body.operation !== "begin" || typeof body.email !== "string" || body.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || typeof body.transactionId !== "string" || !/^[a-f0-9-]{36}$/i.test(body.transactionId) || typeof body.refCode !== "string" || body.refCode.length > 128 || body.consent !== true) return result({ error: "Invalid request" }, 400);
    const challenge = crypto.randomUUID(); let random: number;
    do { random = crypto.getRandomValues(new Uint32Array(1))[0]; } while (random >= 4294000000);
    const code = String(random % 1000000).padStart(6, "0");
    // Gateway IP is hashed; no raw IP or email is saved in the Trust tables.
    const ip = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() || "unknown";
    const pending = await db.rpc("trust_v1_guest_begin", { p_transaction_id: body.transactionId, p_ref_code: body.refCode, p_email: body.email.trim().toLowerCase(), p_code_hash: await fingerprint(secret, `${challenge}:${code}`), p_ip_hash: await fingerprint(secret, `ip:${ip}`), p_challenge_id: challenge });
    if (pending.error) return result({ error: "Request unavailable or rate limited" }, 429);
    const sent = await fetch("https://api.resend.com/emails", { method: "POST", headers: { "Authorization": `Bearer ${mailKey}`, "Content-Type": "application/json", "Idempotency-Key": `trust-referral-${challenge}` }, body: JSON.stringify({ from, to: [body.email.trim()], subject: "OrtakSat yönlendirme doğrulama kodu", text: `Yönlendirme doğrulama kodun: ${code}\nKod 10 dakika geçerlidir. Bu işlem satın alma veya ödeme onayı değildir. Bu isteği sen yapmadıysan kodu kimseyle paylaşma.` }), signal: AbortSignal.timeout(15000), redirect: "error" });
    if (!sent.ok) throw new Error("Mail unavailable");
    return result(pending.data);
  } catch { return result({ error: "Verification unavailable" }, 503); }
});
