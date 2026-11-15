import { supabase } from "@/lib/supabase";

/** İlan fiyatının geçmiş değişiklikleri (sunucu: listing_price_history; yalnız yayındaki ilan ya da sahibi). */
export type PriceChange = { oldPrice: number; newPrice: number; changedAt: string };

export async function fetchListingPriceHistory(listingId: string): Promise<PriceChange[]> {
  if (!supabase || !listingId) return [];
  try {
    const { data, error } = await supabase.rpc("listing_price_history", { p_listing: listingId });
    if (error || !Array.isArray(data)) return [];
    return (data as Array<{ old_price: number | string; new_price: number | string; changed_at: string }>)
      .map((row) => ({ oldPrice: Number(row.old_price), newPrice: Number(row.new_price), changedAt: String(row.changed_at) }))
      .filter((row) => Number.isFinite(row.oldPrice) && Number.isFinite(row.newPrice) && row.oldPrice > 0);
  } catch {
    return [];
  }
}

/** Yüzde değişim (işaretli, tam sayı): 22.000 → 20.000 = -9. */
export function priceChangePct(change: PriceChange): number {
  return Math.round(((change.newPrice - change.oldPrice) / change.oldPrice) * 100);
}

/** "bugün", "dün", "3 gün önce", "2 ay önce". */
export function priceChangeWhen(iso: string, nowMs: number = Date.now()): string {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return "";
  const days = Math.floor(Math.max(0, nowMs - t) / 86_400_000);
  if (days === 0) return "bugün";
  if (days === 1) return "dün";
  if (days < 30) return `${days} gün önce`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months} ay önce` : `${Math.floor(months / 12)} yıl önce`;
}
