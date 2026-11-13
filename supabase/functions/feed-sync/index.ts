// Kayıtlı XML bağlantılarından fiyat ve stokları otomatik eşitler.
//
// İki çağrı biçimi:
//  • Zamanlayıcı (pg_cron → pg_net): `x-feed-secret` başlığı FEED_SYNC_SECRET ile eşleşir → vakti gelen akışlar.
//  • Satıcı ("Şimdi eşitle"): kendi oturumu + { feedId } → yalnız KENDİ akışı.
// Karar mantığı ../_shared/feed-plan.ts içindedir (yeni ilan açmaz; yalnız eşleşen ilanların fiyat/stok/durumu).
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.107.0";
import { corsHeaders, FeedError, fetchFeedText } from "../_shared/feed-http.ts";
import { feedPriceToNumber, planFeedSync, type FeedProduct, type ListingRow } from "../_shared/feed-plan.ts";
import { parseXmlFeed } from "../_shared/xml-feed.ts";

type Feed = { id: string; owner_id: string; url: string; enabled: boolean; interval_hours: number; pause_missing: boolean; last_summary: { products?: number } | null };
const MAX_FEEDS_PER_RUN = 15;

async function syncFeed(admin: SupabaseClient, feed: Feed) {
  const started = new Date().toISOString();
  try {
    const { text } = await fetchFeedText(feed.url);
    let table;
    try { table = parseXmlFeed(text); } catch (error) { throw new FeedError(error instanceof Error ? error.message : "XML ayrıştırılamadı."); }
    if (table.total === 0) throw new FeedError("XML akışında ürün bulunamadı.");
    const products: FeedProduct[] = table.rows.map((row) => ({ sku: row[0], price: feedPriceToNumber(row[3]), stock: row[8] ? Number(row[8]) : null })).filter((p) => p.sku);

    const listings: ListingRow[] = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await admin.from("listings")
        .select("id, external_id, price, stock_count, status, attributes")
        .eq("owner_id", feed.owner_id).not("external_id", "is", null).is("deleted_at", null)
        .order("id").range(from, from + 999);
      if (error) throw new Error(error.message);
      listings.push(...((data ?? []) as ListingRow[]));
      if (!data || data.length < 1000) break;
    }

    const plan = planFeedSync(listings, products, table.outOfStockSkus, { pauseMissing: feed.pause_missing, previousProductCount: feed.last_summary?.products ?? null });
    let failed = 0;
    for (const patch of plan.patches) {
      const { id, ...fields } = patch;
      const { error } = await admin.from("listings").update(fields).eq("id", id).eq("owner_id", feed.owner_id);
      if (error) failed++;
    }
    const summary = {
      products: table.total, withCode: products.length, matched: plan.matched, priceChanged: plan.priceChanged, stockChanged: plan.stockChanged,
      paused: plan.paused, resumed: plan.resumed, newProducts: plan.newProducts, outOfStock: table.outOfStock, foreignCurrency: table.foreignCurrency,
      failed, skippedPauseMissing: plan.skippedPauseMissing
    };
    await admin.from("listing_feeds").update({
      last_run_at: started, last_status: failed ? "partial" : "ok", last_error: null, last_summary: summary,
      next_run_at: new Date(Date.now() + feed.interval_hours * 3600_000).toISOString(), updated_at: new Date().toISOString()
    }).eq("id", feed.id);
    return { id: feed.id, ok: true, summary };
  } catch (error) {
    const message = error instanceof FeedError ? error.message : "Eşitleme tamamlanamadı; bir sonraki denemede yeniden denenecek.";
    await admin.from("listing_feeds").update({
      last_run_at: started, last_status: "error", last_error: message,
      next_run_at: new Date(Date.now() + Math.min(feed.interval_hours, 6) * 3600_000).toISOString(), updated_at: new Date().toISOString()
    }).eq("id", feed.id);
    return { id: feed.id, ok: false, error: message };
  }
}

Deno.serve(async (request) => {
  const headers = { ...corsHeaders(request), "Content-Type": "application/json" };
  const reply = (body: unknown, status: number) => new Response(JSON.stringify(body), { status, headers });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply({ error: "Yalnız POST." }, 405);

  const url = Deno.env.get("SUPABASE_URL"), key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), secret = Deno.env.get("FEED_SYNC_SECRET");
  if (!url || !key) return reply({ error: "Hizmet şu anda kullanılamıyor." }, 503);
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  // 1) Zamanlayıcı
  const given = request.headers.get("x-feed-secret") ?? "";
  if (secret && given && given.length === secret.length && given === secret) {
    const { data, error } = await admin.from("listing_feeds").select("id, owner_id, url, enabled, interval_hours, pause_missing, last_summary")
      .eq("enabled", true).lte("next_run_at", new Date().toISOString()).order("next_run_at").limit(MAX_FEEDS_PER_RUN);
    if (error) return reply({ error: "Akışlar okunamadı." }, 500);
    const results = [];
    for (const feed of (data ?? []) as Feed[]) results.push(await syncFeed(admin, feed));
    return reply({ ran: results.length, ok: results.filter((r) => r.ok).length }, 200);
  }

  // 2) Satıcı: kendi akışı
  const jwt = (request.headers.get("Authorization") ?? "").replace(/^Bearer /i, "");
  if (!jwt || jwt.length > 4096) return reply({ error: "Giriş gerekli." }, 401);
  const { data: caller, error: callerError } = await admin.auth.getUser(jwt);
  if (callerError || !caller?.user) return reply({ error: "Giriş gerekli." }, 401);
  let body: { feedId?: unknown };
  try { body = await request.json(); } catch { return reply({ error: "Geçersiz istek." }, 400); }
  const { data: feed } = await admin.from("listing_feeds").select("id, owner_id, url, enabled, interval_hours, pause_missing, last_summary, last_run_at")
    .eq("id", String(body?.feedId ?? "")).eq("owner_id", caller.user.id).maybeSingle();
  if (!feed) return reply({ error: "Kayıtlı XML bağlantısı bulunamadı." }, 404);
  // Elle eşitleme en sık dakikada bir (karşı siteyi ve sistemi yormamak için).
  const last = (feed as { last_run_at?: string | null }).last_run_at;
  if (last && Date.now() - Date.parse(last) < 60_000) return reply({ error: "Az önce eşitlendi; bir dakika sonra tekrar dene." }, 429);
  const result = await syncFeed(admin, feed as Feed);
  return reply(result, result.ok ? 200 : 422);
});
