import { supabase } from "@/lib/supabase";
import type { Listing } from "@/lib/types";

/**
 * MAĞAZA SIRASI — satıcı, ilanlarının mağazasında hangi sırayla görüneceğini kendisi belirler.
 *
 * Sıra ilanın `attributes._storeRank` alanındadır (1, 2, 3 …); yazma yalnız `set_store_listing_order`
 * sunucu işlevinden yapılır (çağıran yalnız kendi ilanlarını sıralayabilir, başka alan değişmez —
 * bkz. supabase/migrations/20261114030000_store_listing_order.sql).
 *
 * KURAL (her yerde aynı): sırası OLMAYAN ilan (yeni eklenen) en başta ve kendi içinde en yeni önce; ardından
 * satıcının sırası. Böylece satıcı yeni ilan ekleyince ilan mağazanın başına düşer, sıralamayı bozmaz.
 */

/** Sunucuda sıralama için PostgREST sütun ifadesi (jsonb sayı karşılaştırması → sayısal sıra). */
export const STORE_RANK_COLUMN = "attributes->_storeRank";

export function storeRank(listing: Pick<Listing, "attributes">): number | null {
  const value = listing.attributes?._storeRank;
  const rank = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  return Number.isFinite(rank) ? rank : null;
}

/** Mağazada görünen sıra (yukarıdaki kural). Girdi diziyi değiştirmez. */
export function sortByStoreOrder<T extends Pick<Listing, "attributes" | "createdAt" | "id">>(listings: T[]): T[] {
  return [...listings].sort((a, b) => {
    const ra = storeRank(a), rb = storeRank(b);
    if (ra === null && rb === null) return (b.createdAt || "").localeCompare(a.createdAt || "") || a.id.localeCompare(b.id);
    if (ra === null) return -1;
    if (rb === null) return 1;
    return ra - rb || (b.createdAt || "").localeCompare(a.createdAt || "") || a.id.localeCompare(b.id);
  });
}

/** Verilen kimlik sırasını kaydeder. Başarıda true. */
export async function saveStoreOrder(ids: string[]): Promise<boolean> {
  if (!supabase) return false;
  try {
    const { error } = await supabase.rpc("set_store_listing_order", { p_ids: ids });
    return !error;
  } catch {
    return false;
  }
}
