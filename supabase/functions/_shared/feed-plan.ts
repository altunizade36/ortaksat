// Otomatik XML eşitlemesinin KARAR mantığı (saf işlev; ağ ve veritabanı yok → yerelde sınanabilir).
//
// Kurallar:
//  • SAHİPLİK: bir ilan ilk eşleştiği bağlantıya bağlanır (attributes._feedId). Satıcının başka bir XML
//    bağlantısına bağlı ilana bu bağlantı DOKUNMAZ (iki bağlantı aynı ürün kodunu çekiştirmesin).
//  • Fiyat ve stok akıştakiyle aynı yapılır. "İçeriği de eşitle" açıksa başlık, açıklama ve görseller de
//    akıştakiyle değişir (başlık kurala uymuyorsa ya da açıklama çok kısaysa o alan olduğu gibi kalır).
//  • "Yeni ürünleri ilan olarak aç" açıksa, satıcının hiçbir ilanında olmayan ürün kodları için ilan taslağı
//    üretilir (çağıran bunları İNCELEMEYE düşecek biçimde ekler). Kapalıysa yalnız sayılır.
//  • Akışta stokta olmayan ürünün YAYINDAKİ ilanı pasife alınır. "Akıştan çıkanları pasife al" açıksa bu
//    bağlantıya bağlı olup akıştan çıkarılan ürünler de pasife alınır.
//  • Eşitlemenin pasife aldığı ilan (işaretli) ürün yeniden stoğa girince kendiliğinden yayına döner. Satıcının
//    ELLE pasife aldığı ilana dokunulmaz. İncelemedeki, reddedilen, satılan, arşivlenen ilanın durumu değişmez.
//  • KORUMA: akış bir öncekine göre yarıdan fazla küçüldüyse (bozuk/yarım dosya) "akışta yok" diye pasife alma yapılmaz.

export type FeedProduct = { sku: string; title: string; description: string; price: number | null; category: string; stock: number | null; images: string[]; brand: string; attrs?: Record<string, string> };
export type ListingRow = {
  id: string; external_id: string; title: string; description: string; price: number; stock_count: number; status: string;
  attributes: Record<string, unknown> | null; cover_image_url: string | null; ad_assets: string[] | null;
};
export type ListingPatch = {
  id: string; price?: number; stock_count?: number; status?: "active" | "paused"; attributes?: Record<string, unknown>;
  title?: string; description?: string; cover_image_url?: string; ad_assets?: string[];
};
export type NewListing = { product: FeedProduct; title: string; description: string };
export type SyncOptions = {
  feedId: string; pauseMissing: boolean; previousProductCount: number | null;
  createNew: boolean; syncContent: boolean; shortenTitles: boolean; maxNew: number;
};
export type SyncPlan = {
  patches: ListingPatch[];
  creates: NewListing[];
  matched: number; priceChanged: number; stockChanged: number; contentChanged: number; paused: number; resumed: number;
  newProducts: number; remainingNew: number; invalidNew: number; otherFeed: number; skippedPauseMissing: boolean;
};

const PAUSED_FLAG = "_feedPaused";
const OWNER_FLAG = "_feedId";
const MANAGED = new Set(["active", "paused", "draft", "pending_review"]);
export const TITLE_MIN = 10;
export const TITLE_MAX = 70;
export const DESCRIPTION_MIN = 20;

/** Veritabanındaki başlık politikasıyla (listing_title_policy) AYNI kurallar. */
export function isValidTitle(title: string): boolean {
  const clean = title.normalize("NFC").replace(/ /g, " ").replace(/ +/g, " ").trim();
  const length = Array.from(clean).length;
  if (length < TITLE_MIN || length > TITLE_MAX) return false;
  if (!/^[\p{L}\p{M}0-9²³ .,'’"()/:+&%\-]+$/u.test(clean)) return false;
  if (/[.,'’"()/:+&%\-]{3,}/u.test(clean)) return false;
  return /[\p{L}0-9]/u.test(clean);
}

/** Uzun başlığı kelime sınırında kısaltır (yalnız satıcı bu bağlantıda açtıysa). */
export function shortenTitle(title: string): string {
  const chars = Array.from(title.trim());
  if (chars.length <= TITLE_MAX) return title.trim();
  const cut = chars.slice(0, TITLE_MAX).join("");
  const space = cut.lastIndexOf(" ");
  const base = space >= Math.floor(TITLE_MAX * 0.6) ? cut.slice(0, space) : cut;
  return base.replace(/[\s.,'’"()/:+&%\-]+$/u, "").trim();
}

export function prepareTitle(raw: string, shorten: boolean): string | null {
  const clean = String(raw ?? "").normalize("NFC").replace(/ /g, " ").replace(/ +/g, " ").trim();
  const title = shorten ? shortenTitle(clean) : clean;
  return isValidTitle(title) ? title : null;
}

/** Akış açıklaması çok kısaysa yeni ilan için dürüst, genel bir açıklama kurar (uydurma özellik yazmaz). */
export function prepareDescription(product: FeedProduct, title: string): string {
  const text = (product.description ?? "").trim();
  if (text.length >= DESCRIPTION_MIN) return text.slice(0, 4000);
  const parts = [text || `${title}.`];
  if (product.brand) parts.push(`Marka: ${product.brand}.`);
  parts.push("Ayrıntılı bilgi için satıcıya mesaj gönderebilirsin.");
  return parts.join(" ");
}

function sameList(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, i) => value === b[i]);
}

export function planFeedSync(listings: ListingRow[], products: FeedProduct[], outOfStockSkus: string[], options: SyncOptions): SyncPlan {
  const bySku = new Map<string, FeedProduct>();
  for (const product of products) if (product.sku && !bySku.has(product.sku)) bySku.set(product.sku, product);
  const outOfStock = new Set(outOfStockSkus);
  const feedSize = bySku.size + outOfStock.size;
  // Akış aniden küçüldüyse eksikleri pasife alma (yarım inen dosya tüm mağazayı kapatmasın).
  const shrunk = options.previousProductCount != null && options.previousProductCount >= 10 && feedSize < options.previousProductCount * 0.5;
  const pauseMissing = options.pauseMissing && !shrunk;
  const plan: SyncPlan = {
    patches: [], creates: [], matched: 0, priceChanged: 0, stockChanged: 0, contentChanged: 0, paused: 0, resumed: 0,
    newProducts: 0, remainingNew: 0, invalidNew: 0, otherFeed: 0, skippedPauseMissing: options.pauseMissing && shrunk
  };
  const known = new Set<string>();

  for (const listing of listings) {
    const sku = listing.external_id;
    if (!sku) continue;
    known.add(sku);
    if (!MANAGED.has(listing.status)) continue;
    const attrs = listing.attributes && typeof listing.attributes === "object" && !Array.isArray(listing.attributes) ? listing.attributes : {};
    const owner = typeof attrs[OWNER_FLAG] === "string" ? (attrs[OWNER_FLAG] as string) : null;
    const product = bySku.get(sku);
    const inFeed = !!product || outOfStock.has(sku);
    if (owner && owner !== options.feedId) { if (inFeed) plan.otherFeed++; continue; }
    const flagged = attrs[PAUSED_FLAG] === true;
    const patch: ListingPatch = { id: listing.id };
    let nextAttrs: Record<string, unknown> | null = null;
    const touchAttrs = () => (nextAttrs ??= { ...attrs });
    // İlk eşleşmede ilanı bu bağlantıya bağla.
    if (inFeed && !owner) touchAttrs()[OWNER_FLAG] = options.feedId;

    if (product) {
      plan.matched++;
      if (product.price != null && product.price > 0 && Math.abs(product.price - Number(listing.price)) >= 0.005) { patch.price = product.price; plan.priceChanged++; }
      if (product.stock != null && product.stock >= 1 && product.stock !== Number(listing.stock_count)) { patch.stock_count = product.stock; plan.stockChanged++; }
      if (options.syncContent) {
        let changed = false;
        const title = prepareTitle(product.title, options.shortenTitles);
        if (title && title !== listing.title) { patch.title = title; changed = true; }
        const description = (product.description ?? "").trim().slice(0, 4000);
        if (description.length >= DESCRIPTION_MIN && description !== (listing.description ?? "").trim()) { patch.description = description; changed = true; }
        if (product.images.length) {
          const cover = product.images[0];
          const extra = product.images.slice(1);
          if (cover !== (listing.cover_image_url ?? "") || !sameList(extra, listing.ad_assets ?? [])) { patch.cover_image_url = cover; patch.ad_assets = extra; changed = true; }
        }
        if (changed) plan.contentChanged++;
      }
      if (listing.status === "paused" && flagged) {
        delete touchAttrs()[PAUSED_FLAG];
        patch.status = "active";
        plan.resumed++;
      }
    } else if (listing.status === "active" && (outOfStock.has(sku) || (pauseMissing && owner === options.feedId))) {
      touchAttrs()[PAUSED_FLAG] = true;
      patch.status = "paused";
      plan.paused++;
    }
    if (nextAttrs) patch.attributes = nextAttrs;
    if (Object.keys(patch).length > 1) plan.patches.push(patch);
  }

  for (const [sku, product] of bySku) {
    if (known.has(sku)) continue;
    plan.newProducts++;
    if (!options.createNew) continue;
    const title = prepareTitle(product.title, options.shortenTitles);
    if (!title || product.price == null || !(product.price > 0)) { plan.invalidNew++; continue; }
    if (plan.creates.length >= options.maxNew) { plan.remainingNew++; continue; }
    plan.creates.push({ product, title, description: prepareDescription(product, title) });
  }
  return plan;
}

/** Ayrıştırıcının Türkçe yazımlı fiyatını ("1299,90") sayıya çevirir; boşsa null. */
export function feedPriceToNumber(value: string): number | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = Number(text.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Ayrıştırıcı satırını (FEED_HEADERS sırası) ürüne çevirir. */
export function rowToProduct(row: string[]): FeedProduct {
  return {
    sku: row[0] ?? "", title: row[1] ?? "", description: row[2] ?? "", price: feedPriceToNumber(row[3] ?? ""), category: row[4] ?? "",
    stock: row[8] ? Number(row[8]) : null, images: (row[9] ?? "").split("|").map((u) => u.trim()).filter((u) => /^https?:\/\//i.test(u)), brand: row[10] ?? "",
    attrs: parseAttrs(row[11] ?? "")
  };
}

function parseAttrs(json: string): Record<string, string> {
  if (!json) return {};
  try {
    const value = JSON.parse(json);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === "string").slice(0, 20)) as Record<string, string>;
  } catch { return {}; }
}

/** Özellik adı karşılaştırma anahtarı — istemcideki normKey ile AYNI (tr küçük harf, boşluk/alt çizgi yok). */
export function attrKey(name: string): string {
  return name.toLocaleLowerCase("tr-TR").replace(/[\s_]+/g, "").trim();
}

/** Adres dostu kısa ad (Türkçe harfler sadeleşir). */
export function slugify(text: string): string {
  const map: Record<string, string> = { "ı": "i", "İ": "i", "ş": "s", "Ş": "s", "ğ": "g", "Ğ": "g", "ü": "u", "Ü": "u", "ö": "o", "Ö": "o", "ç": "c", "Ç": "c" };
  return Array.from(text).map((ch) => map[ch] ?? ch).join("").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "ilan";
}
