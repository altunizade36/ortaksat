// Otomatik XML eşitlemesinin KARAR mantığı (saf işlev; ağ ve veritabanı yok → yerelde sınanabilir).
//
// Kurallar:
//  • Yalnız satıcının harici kodu (SKU) akıştaki ürünle eşleşen ilanları değişir. Yeni ilan AÇILMAZ
//    (yeni ürün kategori eşlemesi ve inceleme ister; satıcı toplu ilan ekranından içe aktarır).
//  • Fiyat ve stok akıştakiyle aynı yapılır. Başlık, açıklama, komisyon, görsel ve kategoriye dokunulmaz.
//  • Akışta stokta olmayan ürünün YAYINDAKİ ilanı pasife alınır. "Akışta olmayanları pasife al" açıksa akıştan
//    çıkarılan ürünler de pasife alınır.
//  • Eşitlemenin pasife aldığı ilan (işaretli) ürün yeniden stoğa girince kendiliğinden yayına döner. Satıcının
//    ELLE pasife aldığı ilana dokunulmaz. İncelemedeki, reddedilen, satılan, arşivlenen ilanın durumu değişmez.
//  • KORUMA: akış bir öncekine göre yarıdan fazla küçüldüyse (bozuk/yarım dosya) "akışta yok" diye pasife alma yapılmaz.

export type FeedProduct = { sku: string; price: number | null; stock: number | null };
export type ListingRow = { id: string; external_id: string; price: number; stock_count: number; status: string; attributes: Record<string, unknown> | null };
export type ListingPatch = { id: string; price?: number; stock_count?: number; status?: "active" | "paused"; attributes?: Record<string, unknown> };
export type SyncPlan = {
  patches: ListingPatch[];
  matched: number;
  priceChanged: number;
  stockChanged: number;
  paused: number;
  resumed: number;
  newProducts: number;
  skippedPauseMissing: boolean;
};

const FLAG = "_feedPaused";
const MANAGED = new Set(["active", "paused", "draft", "pending_review"]);

export function planFeedSync(
  listings: ListingRow[],
  products: FeedProduct[],
  outOfStockSkus: string[],
  options: { pauseMissing: boolean; previousProductCount: number | null }
): SyncPlan {
  const bySku = new Map<string, FeedProduct>();
  for (const product of products) if (product.sku && !bySku.has(product.sku)) bySku.set(product.sku, product);
  const outOfStock = new Set(outOfStockSkus);
  const feedSize = bySku.size + outOfStock.size;
  // Akış aniden küçüldüyse eksikleri pasife alma (yarım inen dosya tüm mağazayı kapatmasın).
  const shrunk = options.previousProductCount != null && options.previousProductCount >= 10 && feedSize < options.previousProductCount * 0.5;
  const pauseMissing = options.pauseMissing && !shrunk;
  const plan: SyncPlan = { patches: [], matched: 0, priceChanged: 0, stockChanged: 0, paused: 0, resumed: 0, newProducts: 0, skippedPauseMissing: options.pauseMissing && shrunk };
  const known = new Set<string>();

  for (const listing of listings) {
    const sku = listing.external_id;
    if (!sku) continue;
    known.add(sku);
    if (!MANAGED.has(listing.status)) continue;
    const attrs = listing.attributes && typeof listing.attributes === "object" && !Array.isArray(listing.attributes) ? listing.attributes : {};
    const flagged = attrs[FLAG] === true;
    const product = bySku.get(sku);
    const patch: ListingPatch = { id: listing.id };
    if (product) {
      plan.matched++;
      if (product.price != null && product.price > 0 && Math.abs(product.price - Number(listing.price)) >= 0.005) { patch.price = product.price; plan.priceChanged++; }
      if (product.stock != null && product.stock >= 1 && product.stock !== Number(listing.stock_count)) { patch.stock_count = product.stock; plan.stockChanged++; }
      if (listing.status === "paused" && flagged) {
        const next = { ...attrs };
        delete next[FLAG];
        patch.status = "active";
        patch.attributes = next;
        plan.resumed++;
      }
    } else if (listing.status === "active" && (outOfStock.has(sku) || pauseMissing)) {
      patch.status = "paused";
      patch.attributes = { ...attrs, [FLAG]: true };
      plan.paused++;
    }
    if (Object.keys(patch).length > 1) plan.patches.push(patch);
  }
  for (const sku of bySku.keys()) if (!known.has(sku)) plan.newProducts++;
  return plan;
}

/** Ayrıştırıcının Türkçe yazımlı fiyatını ("1299,90") sayıya çevirir; boşsa null. */
export function feedPriceToNumber(value: string): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}
