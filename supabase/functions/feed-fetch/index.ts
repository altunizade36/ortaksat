// XML bağlantısından ürün akışını indirir ve metnini döndürür (toplu ilan ekranındaki "Bağlantıdan getir").
// Tarayıcı başka sitenin XML'ini okuyamadığı (CORS) için indirme sunucuda yapılır; ayrıştırma ve önizleme
// istemcide, dosya yüklemeyle AYNI yoldan geçer. Yalnız giriş yapmış kullanıcı çağırabilir.
import { createClient } from "npm:@supabase/supabase-js@2.107.0";
import { corsHeaders, FeedError, fetchFeedText } from "../_shared/feed-http.ts";

Deno.serve(async (request) => {
  const headers = { ...corsHeaders(request), "Content-Type": "application/json" };
  const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply({ error: "Yalnız POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return reply({ error: "Hizmet şu anda kullanılamıyor." }, 503);
  const jwt = (request.headers.get("Authorization") ?? "").replace(/^Bearer /i, "");
  if (!jwt || jwt.length > 4096) return reply({ error: "Giriş gerekli." }, 401);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: caller, error: callerError } = await admin.auth.getUser(jwt);
  if (callerError || !caller?.user) return reply({ error: "Giriş gerekli." }, 401);

  let body: { url?: unknown };
  try { body = await request.json(); } catch { return reply({ error: "Geçersiz istek." }, 400); }
  try {
    const result = await fetchFeedText(String(body?.url ?? ""));
    return reply({ text: result.text, bytes: result.bytes, finalUrl: result.finalUrl }, 200);
  } catch (error) {
    return reply({ error: error instanceof FeedError ? error.message : "XML bağlantısı okunamadı." }, 422);
  }
});
