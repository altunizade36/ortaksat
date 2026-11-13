/**
 * XML bağlantıları: bağlantıdan akış getirme + kayıtlı bağlantıların otomatik eşitlenmesi.
 *
 * İndirme ve eşitleme sunucuda yapılır (supabase/functions/feed-fetch, feed-sync): tarayıcı başka sitenin
 * XML'ini okuyamaz, zamanlanmış eşitleme de uygulama kapalıyken çalışmalıdır. Karar kuralları
 * supabase/functions/_shared/feed-plan.ts içindedir.
 *
 * KATEGORİ EŞLEMESİ: kategori ağacı istemci kodundadır; sunucu ağacı bilmez. Bu yüzden akıştaki her kategori
 * metni burada OrtakSat kategorisine çözülür ve sonuç (etiket + özellik alanları) bağlantının ayarlarına
 * yazılır; sunucu yeni ilanı açarken bu kaydı aynen kullanır.
 */
import { categoryPathAttributes, matchCategoryLabelPath } from "@/lib/category-path";
import { getFormSchema, matchCategoryByName, resolveFormKey, type CategoryNode } from "@/lib/category-tree";
import { supabase } from "@/lib/supabase";
import type { PartnershipMode } from "@/lib/types";
import type { FeedTable } from "@/lib/xml-feed";

export type CategoryTarget = { label: string; text: string; root: string; attrs: Record<string, unknown>; brandKey: string | null; image: string | null };
export type FeedSettings = {
  createNew: boolean; syncContent: boolean; shortenTitles: boolean;
  commission: number; partnershipMode: PartnershipMode;
  provinceId: number | null; districtId: number | null; location: string;
  defaultCategory: CategoryTarget | null;
  categoryMap: Record<string, CategoryTarget>;
};
export type FeedSummary = {
  products?: number; matched?: number; priceChanged?: number; stockChanged?: number; contentChanged?: number; contentHeld?: number;
  paused?: number; resumed?: number; created?: number; newProducts?: number; remainingNew?: number; invalidNew?: number; blocked?: number;
  unmappedCategories?: number; otherFeed?: number; outOfStock?: number; foreignCurrency?: number; failed?: number; deferred?: number;
  skippedPauseMissing?: boolean; createBlocked?: string | null;
};
export type ListingFeed = {
  id: string; name: string; url: string; enabled: boolean; intervalHours: number; pauseMissing: boolean; settings: FeedSettings;
  lastRunAt: string | null; nextRunAt: string | null; lastStatus: "ok" | "partial" | "error" | null; lastError: string | null; lastSummary: FeedSummary | null;
};
export const FEED_INTERVALS = [1, 3, 6, 12, 24] as const;
export const MAX_FEEDS = 5;

export const DEFAULT_FEED_SETTINGS: FeedSettings = {
  createNew: false, syncContent: false, shortenTitles: true, commission: 10, partnershipMode: "approval",
  provinceId: null, districtId: null, location: "", defaultCategory: null, categoryMap: {}
};

type Row = { id: string; name: string; url: string; enabled: boolean; interval_hours: number; pause_missing: boolean; settings: Partial<FeedSettings> | null; last_run_at: string | null; next_run_at: string | null; last_status: ListingFeed["lastStatus"]; last_error: string | null; last_summary: FeedSummary | null };
const COLUMNS = "id, name, url, enabled, interval_hours, pause_missing, settings, last_run_at, next_run_at, last_status, last_error, last_summary";
const map = (r: Row): ListingFeed => ({
  id: r.id, name: r.name, url: r.url, enabled: r.enabled, intervalHours: r.interval_hours, pauseMissing: r.pause_missing,
  settings: { ...DEFAULT_FEED_SETTINGS, ...(r.settings ?? {}), categoryMap: { ...(r.settings?.categoryMap ?? {}) } },
  lastRunAt: r.last_run_at, nextRunAt: r.next_run_at, lastStatus: r.last_status, lastError: r.last_error, lastSummary: r.last_summary
});

/** İşlev 2xx dışı döndüğünde supabase-js gövdeyi `error.context` içinde bırakır; Türkçe iletiyi oradan al. */
async function functionError(error: unknown, fallback: string): Promise<string> {
  const context = (error as { context?: unknown } | null)?.context;
  if (context && typeof (context as Response).json === "function") {
    try {
      const body = await (context as Response).json();
      if (body && typeof body.error === "string" && body.error) return body.error;
    } catch { /* gövde JSON değil */ }
  }
  return fallback;
}

/** Bağlantıdaki XML metnini getirir. */
export async function fetchFeedFromUrl(url: string): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: "Bağlantıdan getirme yalnızca canlı modda çalışır." };
  const clean = url.trim();
  if (!/^https?:\/\/\S+$/i.test(clean)) return { ok: false, error: "Geçerli bir bağlantı gir (https:// ile başlamalı)." };
  try {
    const { data, error } = await supabase.functions.invoke("feed-fetch", { body: { url: clean } });
    if (error) return { ok: false, error: await functionError(error, "XML bağlantısı okunamadı. Adresi kontrol edip tekrar dene.") };
    const text = (data as { text?: unknown } | null)?.text;
    if (typeof text !== "string" || !text) return { ok: false, error: "XML bağlantısı boş yanıt verdi." };
    return { ok: true, text };
  } catch {
    return { ok: false, error: "XML bağlantısına ulaşılamadı. İnternetini kontrol edip tekrar dene." };
  }
}

export async function getMyFeeds(ownerId: string): Promise<ListingFeed[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("listing_feeds").select(COLUMNS).eq("owner_id", ownerId).order("created_at");
  if (error || !data) return [];
  return (data as Row[]).map(map);
}

export type FeedInput = { id?: string; name: string; url: string; enabled: boolean; intervalHours: number; pauseMissing: boolean; settings: FeedSettings };

/** Bağlantıyı oluşturur ya da günceller. Hata iletisi Türkçe döner (ör. "En fazla 5 XML bağlantısı…"). */
export async function saveFeed(ownerId: string, input: FeedInput): Promise<{ ok: true; feed: ListingFeed } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: "Kaydetme yalnızca canlı modda çalışır." };
  const url = input.url.trim();
  if (!/^https?:\/\/\S+$/i.test(url)) return { ok: false, error: "Bağlantı http:// ya da https:// ile başlamalı." };
  const fields = { name: input.name.trim().slice(0, 60) || "XML bağlantım", url, enabled: input.enabled, interval_hours: input.intervalHours, pause_missing: input.pauseMissing, settings: input.settings };
  const query = input.id
    ? supabase.from("listing_feeds").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", input.id).eq("owner_id", ownerId).select(COLUMNS).maybeSingle()
    : supabase.from("listing_feeds").insert({ owner_id: ownerId, ...fields }).select(COLUMNS).maybeSingle();
  const { data, error } = await query;
  if (error || !data) {
    if (error?.code === "23505") return { ok: false, error: "Bu bağlantı zaten kayıtlı." };
    if (error?.code === "P0001" && error.message) return { ok: false, error: error.message };
    return { ok: false, error: "Bağlantı kaydedilemedi. Tekrar dene." };
  }
  return { ok: true, feed: map(data as Row) };
}

export async function deleteFeed(ownerId: string, feedId: string): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.from("listing_feeds").delete().eq("id", feedId).eq("owner_id", ownerId);
  return !error;
}

/** Kayıtlı bağlantıyı şimdi eşitler (en sık dakikada bir). */
export async function syncFeedNow(feedId: string): Promise<{ ok: true; summary: FeedSummary } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: "Eşitleme yalnızca canlı modda çalışır." };
  try {
    const { data, error } = await supabase.functions.invoke("feed-sync", { body: { feedId } });
    if (error) return { ok: false, error: await functionError(error, "Eşitleme tamamlanamadı. Biraz sonra tekrar dene.") };
    return { ok: true, summary: ((data as { summary?: FeedSummary } | null)?.summary ?? {}) };
  } catch {
    return { ok: false, error: "Eşitleme başlatılamadı. İnternetini kontrol edip tekrar dene." };
  }
}

/** Özet cümlesi: "12 ilan eşleşti · 3 fiyat, 1 stok güncellendi · 5 yeni ilan incelemeye gönderildi". */
export function describeFeedSummary(s: FeedSummary | null): string {
  if (!s) return "";
  const parts: string[] = [`${s.matched ?? 0} ilan eşleşti`];
  const changed: string[] = [];
  if (s.priceChanged) changed.push(`${s.priceChanged} fiyat`);
  if (s.stockChanged) changed.push(`${s.stockChanged} stok`);
  if (s.contentChanged) changed.push(`${s.contentChanged} içerik`);
  parts.push(changed.length ? `${changed.join(", ")} güncellendi` : "değişiklik yok");
  if (s.created) parts.push(`${s.created} yeni ilan incelemeye gönderildi`);
  if (s.remainingNew) parts.push(`${s.remainingNew} yeni ürün sırada (yarım saat içinde açılır)`);
  if (s.createBlocked) parts.push(s.createBlocked);
  else if (s.newProducts && !s.created && !s.remainingNew) parts.push(`${s.newProducts} yeni ürün var (otomatik açma kapalı ya da ürün bilgisi eksik)`);
  if (s.invalidNew) parts.push(`${s.invalidNew} ürün açılamadı (fiyatı yok ya da başlığı kurala uymuyor)`);
  if (s.blocked) parts.push(`${s.blocked} ürün yasaklı içerik nedeniyle açılmadı`);
  if (s.contentHeld) parts.push(`${s.contentHeld} ilanın içeriği inceleme gerektirdiği için değiştirilmedi`);
  if (s.unmappedCategories) parts.push(`${s.unmappedCategories} kategori eşlenmediği için varsayılan kategori kullanıldı`);
  if (s.paused) parts.push(`${s.paused} ilan pasife alındı`);
  if (s.resumed) parts.push(`${s.resumed} ilan yeniden yayına alındı`);
  if (s.otherFeed) parts.push(`${s.otherFeed} ürün başka bağlantına bağlı olduğu için atlandı`);
  if (s.deferred) parts.push(`${s.deferred} güncelleme sonraki tura kaldı`);
  if (s.failed) parts.push(`${s.failed} işlem tamamlanamadı`);
  if (s.skippedPauseMissing) parts.push("akış aniden küçüldüğü için eksik ürünler pasife alınmadı");
  return parts.join(" · ");
}

// ---------------------------------------------------------------------------------------------
// Kategori eşlemesi
// ---------------------------------------------------------------------------------------------
const PATH_SEP = /[>›»]/;

function targetOf(hit: { node: CategoryNode; path: CategoryNode[] } | undefined): CategoryTarget | null {
  if (!hit || !hit.path.length) return null;
  const leaf = hit.path[hit.path.length - 1];
  const fields = getFormSchema(resolveFormKey(hit.path)).fields;
  const brand = fields.find((f) => f.key === "brand") ?? fields.find((f) => f.label.toLocaleLowerCase("tr-TR").trim() === "marka");
  return {
    label: leaf.label,
    text: hit.path.map((n) => n.label).join(" > "),
    root: hit.path[0].label,
    attrs: categoryPathAttributes(hit.path),
    brandKey: brand?.key ?? null,
    image: leaf.image || hit.path.find((p) => p.image)?.image || null
  };
}

/** Satıcının yazdığı metni (tam yol "A > B > C" ya da ad) OrtakSat kategorisine çözer. */
export function resolveCategoryText(tree: CategoryNode[], text: string): CategoryTarget | null {
  const raw = text.trim();
  if (!raw) return null;
  return targetOf(PATH_SEP.test(raw) ? matchCategoryLabelPath(tree, raw) : matchCategoryByName(raw));
}

/** Akıştaki kategori için ÖNERİ: önce tam yol, olmazsa yolun son adı. Satıcı ekranda onaylar ya da düzeltir. */
export function suggestCategory(tree: CategoryNode[], feedCategory: string): CategoryTarget | null {
  const raw = feedCategory.trim();
  if (!raw) return null;
  if (PATH_SEP.test(raw)) {
    const exact = targetOf(matchCategoryLabelPath(tree, raw));
    if (exact) return exact;
    const last = raw.split(PATH_SEP).map((p) => p.trim()).filter(Boolean).pop();
    return last ? targetOf(matchCategoryByName(last)) : null;
  }
  return targetOf(matchCategoryByName(raw));
}

/** Akıştaki kategori metinleri, ürün sayısına göre azalan. */
export function feedCategories(table: FeedTable): Array<{ name: string; count: number }> {
  const counts = new Map<string, number>();
  for (const row of table.rows) {
    const name = (row[4] ?? "").trim();
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}
