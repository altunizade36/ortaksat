// Kalıcı olarak silinmiş (profiles.status = 'deleted') bir hesabın depodaki dosyalarını temizler.
// SQL tarafı (private.finalize_account_deletion) kişisel veriyi anonimleştirir ama Storage nesnelerini
// silemez (Storage API gerekir). Bu fonksiyon YALNIZ yönetici oturumuyla çağrılır ve YALNIZ
// durumu 'deleted' olan hesaplar için çalışır.
//
// Korunanlar: karşı tarafın mesaj geçmişinde görünen sohbet ekleri (messages.attachment_url) ve
// yayındaki (silinmemiş) yorumların medya dosyaları — bunlar başka kullanıcıların kaydıdır.
import { createClient } from "npm:@supabase/supabase-js@2.107.0";

const BUCKETS = ["profile-avatars", "listing-videos", "listing-images", "review-media"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ORIGINS = new Set(["https://www.ortaksat.com", "https://ortaksat.com"]);

function cors(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ORIGINS.has(origin) ? origin : "https://www.ortaksat.com",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin"
  };
}

Deno.serve(async (request) => {
  const headers = { ...cors(request), "Content-Type": "application/json", "Cache-Control": "no-store" };
  const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply({ error: "Unavailable" }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) Çağıran: geçerli oturum + aktif yönetici.
  const jwt = (request.headers.get("Authorization") ?? "").replace(/^Bearer /i, "");
  if (!jwt || jwt.length > 4096) return reply({ error: "Unauthorized" }, 401);
  const { data: caller, error: callerError } = await admin.auth.getUser(jwt);
  if (callerError || !caller?.user) return reply({ error: "Unauthorized" }, 401);
  const { data: staff } = await admin.from("profiles").select("role, status").eq("id", caller.user.id).maybeSingle();
  if (!staff || staff.status !== "active" || !["admin", "super_admin"].includes(staff.role)) {
    return reply({ error: "Forbidden" }, 403);
  }

  // 2) Hedef: yalnız kalıcı silinmiş hesap.
  let userId = "";
  try { userId = String((await request.json())?.userId ?? ""); } catch { /* geçersiz gövde */ }
  if (!UUID.test(userId)) return reply({ error: "Invalid userId" }, 400);
  if (userId === caller.user.id) return reply({ error: "Forbidden" }, 403);
  const { data: target } = await admin.from("profiles").select("status").eq("id", userId).maybeSingle();
  if (!target || target.status !== "deleted") return reply({ error: "Account is not permanently deleted" }, 409);

  // 3) Korunacak yollar.
  const keep = new Set<string>();
  const { data: sent, error: sentError } = await admin.from("messages")
    .select("attachment_url").eq("sender_id", userId).not("attachment_url", "is", null).limit(5000);
  if (sentError) return reply({ error: "Unavailable" }, 503);
  for (const row of sent ?? []) {
    const at = String(row.attachment_url ?? "").indexOf("/listing-images/");
    if (at >= 0) keep.add("listing-images:" + decodeURIComponent(String(row.attachment_url).slice(at + "/listing-images/".length).split(/[?#]/)[0]));
  }
  const { data: reviews, error: reviewError } = await admin.from("reviews")
    .select("media_paths").eq("reviewer_id", userId).is("deleted_at", null).limit(2000);
  if (reviewError) return reply({ error: "Unavailable" }, 503);
  for (const row of reviews ?? []) for (const path of (row.media_paths ?? []) as string[]) keep.add("review-media:" + path);

  // 4) Kullanıcının kendi klasöründeki dosyaları sil.
  const removed: Record<string, number> = {};
  let failed = 0;
  for (const bucket of BUCKETS) {
    removed[bucket] = 0;
    const skipped = new Set<string>();
    for (let round = 0; round < 50; round++) {
      const { data: files, error } = await admin.storage.from(bucket).list(userId, { limit: 100, offset: skipped.size });
      if (error) { failed++; break; }
      const names = (files ?? []).filter((f) => f.name && f.id).map((f) => `${userId}/${f.name}`);
      if (!names.length) break;
      const doomed = names.filter((path) => !keep.has(`${bucket}:${path}`));
      for (const path of names) if (keep.has(`${bucket}:${path}`)) skipped.add(path);
      if (doomed.length) {
        const { data: gone, error: removeError } = await admin.storage.from(bucket).remove(doomed);
        if (removeError) { failed++; break; }
        removed[bucket] += gone?.length ?? 0;
        if ((gone?.length ?? 0) === 0) break; // ilerleme yok → sonsuz döngüye girme
      } else if (names.length < 100) break;
    }
  }
  return reply({ ok: failed === 0, removed, kept: keep.size }, failed === 0 ? 200 : 207);
});
