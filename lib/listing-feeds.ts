/**
 * XML bağlantısı: bağlantıdan akış getirme + kayıtlı bağlantının otomatik fiyat/stok eşitlemesi.
 *
 * İndirme ve eşitleme sunucuda yapılır (supabase/functions/feed-fetch, feed-sync): tarayıcı başka sitenin
 * XML'ini okuyamaz, zamanlanmış eşitleme de uygulama kapalıyken çalışmalıdır. Karar kuralları
 * supabase/functions/_shared/feed-plan.ts içindedir (yeni ilan açmaz; yalnız ürün kodu eşleşen ilanlar).
 */
import { supabase } from "@/lib/supabase";

export type FeedSummary = {
  products?: number; matched?: number; priceChanged?: number; stockChanged?: number; paused?: number; resumed?: number;
  newProducts?: number; outOfStock?: number; foreignCurrency?: number; failed?: number; skippedPauseMissing?: boolean;
};
export type ListingFeed = {
  id: string; url: string; enabled: boolean; intervalHours: number; pauseMissing: boolean;
  lastRunAt: string | null; nextRunAt: string | null; lastStatus: "ok" | "partial" | "error" | null; lastError: string | null; lastSummary: FeedSummary | null;
};
export const FEED_INTERVALS = [1, 3, 6, 12, 24] as const;

type Row = { id: string; url: string; enabled: boolean; interval_hours: number; pause_missing: boolean; last_run_at: string | null; next_run_at: string | null; last_status: ListingFeed["lastStatus"]; last_error: string | null; last_summary: FeedSummary | null };
const COLUMNS = "id, url, enabled, interval_hours, pause_missing, last_run_at, next_run_at, last_status, last_error, last_summary";
const map = (r: Row): ListingFeed => ({ id: r.id, url: r.url, enabled: r.enabled, intervalHours: r.interval_hours, pauseMissing: r.pause_missing, lastRunAt: r.last_run_at, nextRunAt: r.next_run_at, lastStatus: r.last_status, lastError: r.last_error, lastSummary: r.last_summary });

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

export async function getMyFeed(ownerId: string): Promise<ListingFeed | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from("listing_feeds").select(COLUMNS).eq("owner_id", ownerId).maybeSingle();
  if (error || !data) return null;
  return map(data as Row);
}

/** Satıcının (tek) akış kaydını oluşturur ya da günceller. Kayıt hemen eşitlenmek üzere sıraya girer. */
export async function saveMyFeed(ownerId: string, input: { url: string; enabled: boolean; intervalHours: number; pauseMissing: boolean }): Promise<ListingFeed | null> {
  if (!supabase) return null;
  const existing = await getMyFeed(ownerId);
  const fields = { url: input.url.trim(), enabled: input.enabled, interval_hours: input.intervalHours, pause_missing: input.pauseMissing };
  const query = existing
    ? supabase.from("listing_feeds").update({ ...fields, updated_at: new Date().toISOString() }).eq("id", existing.id).select(COLUMNS).maybeSingle()
    : supabase.from("listing_feeds").insert({ owner_id: ownerId, ...fields }).select(COLUMNS).maybeSingle();
  const { data, error } = await query;
  if (error || !data) { console.warn("listing feed save failed", error); return null; }
  return map(data as Row);
}

export async function deleteMyFeed(ownerId: string): Promise<boolean> {
  if (!supabase) return true;
  const { error } = await supabase.from("listing_feeds").delete().eq("owner_id", ownerId);
  return !error;
}

/** Kayıtlı bağlantıyı şimdi eşitler (en sık dakikada bir). */
export async function syncMyFeedNow(feedId: string): Promise<{ ok: true; summary: FeedSummary } | { ok: false; error: string }> {
  if (!supabase) return { ok: false, error: "Eşitleme yalnızca canlı modda çalışır." };
  try {
    const { data, error } = await supabase.functions.invoke("feed-sync", { body: { feedId } });
    if (error) return { ok: false, error: await functionError(error, "Eşitleme tamamlanamadı. Biraz sonra tekrar dene.") };
    return { ok: true, summary: ((data as { summary?: FeedSummary } | null)?.summary ?? {}) };
  } catch {
    return { ok: false, error: "Eşitleme başlatılamadı. İnternetini kontrol edip tekrar dene." };
  }
}

/** Özet cümlesi: "12 ilan eşleşti · 3 fiyat, 1 stok güncellendi · 2 pasife alındı · 5 yeni ürün". */
export function describeFeedSummary(s: FeedSummary | null): string {
  if (!s) return "";
  const parts: string[] = [`${s.matched ?? 0} ilan eşleşti`];
  const changed: string[] = [];
  if (s.priceChanged) changed.push(`${s.priceChanged} fiyat`);
  if (s.stockChanged) changed.push(`${s.stockChanged} stok`);
  parts.push(changed.length ? `${changed.join(", ")} güncellendi` : "değişiklik yok");
  if (s.paused) parts.push(`${s.paused} ilan pasife alındı`);
  if (s.resumed) parts.push(`${s.resumed} ilan yeniden yayına alındı`);
  if (s.newProducts) parts.push(`${s.newProducts} yeni ürün (içe aktarılmayı bekliyor)`);
  if (s.failed) parts.push(`${s.failed} ilan güncellenemedi`);
  if (s.skippedPauseMissing) parts.push("akış aniden küçüldüğü için eksik ürünler pasife alınmadı");
  return parts.join(" · ");
}
