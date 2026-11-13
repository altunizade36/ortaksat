// Kayıtlı XML bağlantılarını eşitler: fiyat/stok, isteğe bağlı içerik (başlık, açıklama, görsel) ve
// isteğe bağlı YENİ ürünlerin ilan olarak açılması.
//
// İki çağrı biçimi:
//  • Zamanlayıcı (pg_cron → pg_net): `x-feed-secret` başlığı FEED_SYNC_SECRET ile eşleşir → vakti gelen bağlantılar.
//  • Satıcı ("Şimdi eşitle"): kendi oturumu + { feedId } → yalnız KENDİ bağlantısı.
//
// Güvenlik ve bütünlük:
//  • Bu işlev servis yetkisiyle yazar; ilan tablosundaki içerik taraması ve hız sınırı tetikleyicileri servis
//    yetkisini MUAF tutar. Bu yüzden içerik taraması (scan_prohibited) burada AYRICA çağrılır: yasaklı içerikli
//    yeni ürün açılmaz, taramaya takılan içerik değişikliği uygulanmaz.
//  • Otomatik açılan ilanlar doğrudan YAYINLANIR (platform sahibinin kararı). Taramada "inceleme" çıkan
//    (riskli) ürün yayına alınmaz, incelemeye düşer; nedeni attributes._reviewReason'a yazılır ve
//    veritabanı tetikleyicisi yöneticilere bildirim gönderir. Yasaklı içerikli ürün hiç açılmaz.
//  • Karar mantığı ../_shared/feed-plan.ts içindedir.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2.107.0";
import { corsHeaders, FeedError, fetchFeedText } from "../_shared/feed-http.ts";
import { attrKey, planFeedSync, rowToProduct, slugify, type ListingPatch, type ListingRow, type NewListing } from "../_shared/feed-plan.ts";
import { parseXmlFeed } from "../_shared/xml-feed.ts";

type CategoryTarget = { label: string; text?: string; root?: string; attrs?: Record<string, unknown>; brandKey?: string | null; image?: string | null; fields?: Record<string, { key: string; type?: string }> };
type Settings = {
  createNew?: boolean; syncContent?: boolean; shortenTitles?: boolean; commission?: number; partnershipMode?: string;
  provinceId?: number | null; districtId?: number | null; location?: string;
  defaultCategory?: CategoryTarget | null; categoryMap?: Record<string, CategoryTarget>;
};
type Feed = { id: string; owner_id: string; url: string; enabled: boolean; interval_hours: number; pause_missing: boolean; settings: Settings | null; last_summary: { products?: number } | null };

const FEED_COLUMNS = "id, owner_id, url, enabled, interval_hours, pause_missing, settings, last_summary, last_run_at";
const MAX_NEW_PER_RUN = 150;
const MAX_PATCHES_PER_RUN = 800;
const RUN_BUDGET_MS = 95_000;

async function verdictOf(admin: SupabaseClient, text: string): Promise<string> {
  const { data, error } = await admin.rpc("scan_prohibited", { p_text: text });
  // Tarama yapılamıyorsa güvenli taraf: içerik İNCELEME gerektirir sayılır (yeni ilan zaten incelemeye düşer,
  // içerik değişikliği uygulanmaz).
  return error || typeof data !== "string" ? "review" : data;
}

function canCreate(settings: Settings): string | null {
  if (!settings.defaultCategory?.label) return "Yeni ürünlerin açılabilmesi için varsayılan kategori seçilmeli.";
  if (!settings.provinceId || !settings.location) return "Yeni ürünlerin açılabilmesi için varsayılan il seçilmeli.";
  const commission = Number(settings.commission);
  if (settings.partnershipMode !== "none" && !(commission > 0 && commission <= 90)) return "Yeni ürünlerin açılabilmesi için komisyon 1–90 arasında olmalı.";
  return null;
}

function targetOf(settings: Settings, item: NewListing): CategoryTarget {
  return (item.product.category && settings.categoryMap?.[item.product.category]) || settings.defaultCategory!;
}

function buildRow(feed: Feed, settings: Settings, item: NewListing, risky: boolean) {
  const id = crypto.randomUUID();
  const product = item.product;
  const target = targetOf(settings, item);
  const mode = settings.partnershipMode === "open" || settings.partnershipMode === "none" ? settings.partnershipMode : "approval";
  // ÖZELLİKLER: akıştaki ad, kategorinin özellik alanıyla eşleşirse o alana yazılır (filtrelerde çalışır);
  // eşleşmeyen özellik kaybolmaz, "_extra" altında saklanır ve ilan sayfasındaki özellik tablosunda görünür.
  const attributes: Record<string, unknown> = {};
  const extra: Record<string, string> = {};
  for (const [name, value] of Object.entries(product.attrs ?? {})) {
    const field = target.fields?.[attrKey(name)];
    if (!field) { extra[name] = value; continue; }
    attributes[field.key] = field.type === "number" && /^\d+([.,]\d+)?$/.test(value) ? Number(value.replace(",", ".")) : value;
  }
  if (Object.keys(extra).length) attributes._extra = extra;
  Object.assign(attributes, target.attrs ?? {}, { _feedId: feed.id });
  if (risky) attributes._reviewReason = "Otomatik tarama: başlık, açıklama ya da kategori inceleme gerektiren bir ifade içeriyor.";
  if (product.brand && target.brandKey) attributes[target.brandKey] = product.brand;
  return {
    id,
    owner_id: feed.owner_id,
    title: item.title,
    slug: `${slugify(item.title)}-${id.slice(0, 8)}`,
    description: item.description,
    price: product.price,
    currency: "TRY",
    commission_type: "rate",
    commission_value: Number(settings.commission) > 0 ? Number(settings.commission) : 10,
    category: target.label,
    location: settings.location,
    province_id: settings.provinceId ?? null,
    district_id: settings.districtId ?? null,
    address_visibility: "neighborhood",
    status: risky ? "pending_review" : "active",
    partnership_mode: mode,
    external_id: product.sku,
    stock_count: product.stock != null && product.stock >= 1 ? product.stock : 1,
    return_window_days: 7,
    partner_rules: ["Komisyon sadece onaylı satış kaydında oluşur."],
    delivery_note: "Teslimat ve ödeme satıcıyla alıcı arasında netleştirilir; OrtakSat para tutmaz.",
    cover_image_url: product.images[0] ?? target.image ?? null,
    ad_assets: product.images.slice(1, 5),
    tags: [target.root, target.label].filter((t): t is string => typeof t === "string" && t.length > 0),
    attributes
  };
}

async function syncFeed(admin: SupabaseClient, feed: Feed) {
  const started = new Date().toISOString();
  const settings: Settings = feed.settings && typeof feed.settings === "object" ? feed.settings : {};
  try {
    const { text } = await fetchFeedText(feed.url);
    let table;
    try { table = parseXmlFeed(text); } catch (error) { throw new FeedError(error instanceof Error ? error.message : "XML ayrıştırılamadı."); }
    if (table.total === 0) throw new FeedError("XML akışında ürün bulunamadı.");
    const products = table.rows.map(rowToProduct).filter((p) => p.sku);

    const listings: ListingRow[] = [];
    for (let from = 0; from < 20000; from += 1000) {
      const { data, error } = await admin.from("listings")
        .select("id, external_id, title, description, price, stock_count, status, attributes, cover_image_url, ad_assets")
        .eq("owner_id", feed.owner_id).not("external_id", "is", null).is("deleted_at", null)
        .order("id").range(from, from + 999);
      if (error) throw new Error(error.message);
      listings.push(...((data ?? []) as ListingRow[]));
      if (!data || data.length < 1000) break;
    }

    const createBlock = settings.createNew ? canCreate(settings) : null;
    const plan = planFeedSync(listings, products, table.outOfStockSkus, {
      feedId: feed.id, pauseMissing: feed.pause_missing, previousProductCount: feed.last_summary?.products ?? null,
      createNew: !!settings.createNew && !createBlock, syncContent: !!settings.syncContent, shortenTitles: !!settings.shortenTitles, maxNew: MAX_NEW_PER_RUN
    });

    // ---- Mevcut ilanlar
    let failed = 0, contentHeld = 0;
    const patches: ListingPatch[] = plan.patches.slice(0, MAX_PATCHES_PER_RUN);
    for (const patch of patches) {
      const { id, ...fields } = patch as ListingPatch & Record<string, unknown>;
      if (fields.title !== undefined || fields.description !== undefined) {
        const current = listings.find((l) => l.id === id);
        const verdict = await verdictOf(admin, `${fields.title ?? current?.title ?? ""} ${fields.description ?? current?.description ?? ""}`);
        if (verdict !== "none") { delete fields.title; delete fields.description; contentHeld++; }
      }
      if (Object.keys(fields).length === 0) continue;
      const { error } = await admin.from("listings").update(fields).eq("id", id).eq("owner_id", feed.owner_id);
      if (error) failed++;
    }

    // ---- Yeni ürünler → incelemeye düşen ilanlar
    let created = 0, review = 0, blocked = 0, createFailed = 0;
    const unmapped = new Set<string>();
    for (const item of plan.creates) {
      const target = targetOf(settings, item);
      // Kategori adı da taranır: hassas kategoriye (ilaç, takviye…) düşen ürün incelemeye gider.
      const verdict = await verdictOf(admin, `${item.title} ${item.description} ${target.label} ${target.root ?? ""}`);
      if (verdict === "block") { blocked++; continue; }
      if (item.product.category && !settings.categoryMap?.[item.product.category]) unmapped.add(item.product.category);
      const risky = verdict !== "none";
      const { error } = await admin.from("listings").insert(buildRow(feed, settings, item, risky));
      // 23505: aynı ürün kodu araya girmiş (eşzamanlı çalışma) → mükerrer açma, hata sayma.
      if (error && error.code !== "23505") createFailed++;
      else if (!error) { created++; if (risky) review++; }
    }

    const summary = {
      products: table.total, withCode: products.length, matched: plan.matched, priceChanged: plan.priceChanged, stockChanged: plan.stockChanged,
      contentChanged: Math.max(0, plan.contentChanged - contentHeld), contentHeld, paused: plan.paused, resumed: plan.resumed,
      created, published: created - review, review, newProducts: Math.max(0, plan.newProducts - created), remainingNew: plan.remainingNew, invalidNew: plan.invalidNew, blocked,
      unmappedCategories: unmapped.size, otherFeed: plan.otherFeed, outOfStock: table.outOfStock, foreignCurrency: table.foreignCurrency,
      failed: failed + createFailed, deferred: Math.max(0, plan.patches.length - patches.length),
      skippedPauseMissing: plan.skippedPauseMissing, createBlocked: createBlock
    };
    // Sıraya kalan iş varsa bir sonraki turu beklemeden (yarım saat içinde) devam et.
    const pending = summary.remainingNew > 0 || summary.deferred > 0;
    await admin.from("listing_feeds").update({
      last_run_at: started, last_status: summary.failed ? "partial" : "ok", last_error: null, last_summary: summary,
      next_run_at: new Date(Date.now() + (pending ? 20 * 60_000 : feed.interval_hours * 3600_000)).toISOString(), updated_at: new Date().toISOString()
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

  // 1) Zamanlayıcı: süre bütçesi dolana kadar vakti gelen bağlantılar (kalanlar bir sonraki tura).
  const given = request.headers.get("x-feed-secret") ?? "";
  if (secret && given && given.length === secret.length && given === secret) {
    const begun = Date.now();
    const { data, error } = await admin.from("listing_feeds").select(FEED_COLUMNS)
      .eq("enabled", true).lte("next_run_at", new Date().toISOString()).order("next_run_at").limit(20);
    if (error) return reply({ error: "Bağlantılar okunamadı." }, 500);
    let ran = 0, ok = 0;
    for (const feed of (data ?? []) as Feed[]) {
      if (Date.now() - begun > RUN_BUDGET_MS) break;
      const result = await syncFeed(admin, feed);
      ran++;
      if (result.ok) ok++;
    }
    return reply({ ran, ok, due: (data ?? []).length }, 200);
  }

  // 2) Satıcı: kendi bağlantısı
  const jwt = (request.headers.get("Authorization") ?? "").replace(/^Bearer /i, "");
  if (!jwt || jwt.length > 4096) return reply({ error: "Giriş gerekli." }, 401);
  const { data: caller, error: callerError } = await admin.auth.getUser(jwt);
  if (callerError || !caller?.user) return reply({ error: "Giriş gerekli." }, 401);
  let body: { feedId?: unknown };
  try { body = await request.json(); } catch { return reply({ error: "Geçersiz istek." }, 400); }
  const { data: feed } = await admin.from("listing_feeds").select(FEED_COLUMNS)
    .eq("id", String(body?.feedId ?? "")).eq("owner_id", caller.user.id).maybeSingle();
  if (!feed) return reply({ error: "Kayıtlı XML bağlantısı bulunamadı." }, 404);
  // Elle eşitleme en sık dakikada bir (karşı siteyi ve sistemi yormamak için).
  const last = (feed as { last_run_at?: string | null }).last_run_at;
  if (last && Date.now() - Date.parse(last) < 60_000) return reply({ error: "Az önce eşitlendi; bir dakika sonra tekrar dene." }, 429);
  const result = await syncFeed(admin, feed as Feed);
  return reply(result, result.ok ? 200 : 422);
});
