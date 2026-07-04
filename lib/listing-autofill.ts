import { moneyIn } from "@/lib/format";
import {
  getCategoryPartnerHint,
  getCategoryRequiredDetails,
  inferListingSubcategory,
  listingCategories
} from "@/lib/categories";

/**
 * Shopify-tarzı otomatik ilan taslağı üretici.
 *
 * ÖNEMLİ (sahte veri yasağı): Bu üretici ürünün OLMAYAN teknik özelliğini
 * (kamera MP, kapasite, garanti vb.) UYDURMAZ. Yalnızca satıcının girdiği
 * gerçek verilerden (başlık, kategori, fiyat, komisyon) yola çıkıp düzenlenebilir
 * bir taslak — açıklama iskeleti, satış argümanları, etiketler ve paylaşım
 * metinleri — üretir. Satıcı yayınlamadan önce her alanı düzenleyebilir.
 */

const STOPWORDS = new Set([
  "ve", "ile", "için", "bir", "bu", "the", "and", "pro", "plus", "yeni", "orijinal",
  "sıfır", "adet", "set", "cm", "mm", "ml", "gr", "kg"
]);

function keywordsFromTitle(title: string): string[] {
  return Array.from(
    new Set(
      title
        .toLocaleLowerCase("tr-TR")
        .replace(/[^\p{L}\p{N}\s]/gu, " ")
        .split(/\s+/)
        .map((w) => w.trim())
        .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
    )
  ).slice(0, 6);
}

/**
 * Serbest metin kategoriyi bilinen üst kategorilerden en yakınına eşler.
 * Eşleşme yoksa girdiyi olduğu gibi döndürür (kullanıcının yazdığı korunur).
 */
export function matchCategory(text: string): string {
  const q = (text ?? "").trim();
  if (!q) return "";
  const low = q.toLocaleLowerCase("tr-TR");
  // 1) Üst kategori adı/kısa adı birebir/içerir
  for (const c of listingCategories) {
    if (c.key.toLocaleLowerCase("tr-TR") === low || c.label.toLocaleLowerCase("tr-TR") === low) return c.key;
  }
  for (const c of listingCategories) {
    const hay = [c.key, c.label, c.shortLabel, ...c.subcategories].join(" ").toLocaleLowerCase("tr-TR");
    if (c.subcategories.some((s) => s.toLocaleLowerCase("tr-TR") === low)) return c.key;
    if (hay.includes(low) || low.includes(c.key.toLocaleLowerCase("tr-TR"))) return c.key;
  }
  return q;
}

export type AutoFillInput = {
  title: string;
  category: string;
  price?: number;
  commission?: number;
  currency?: "TRY" | "USD" | "EUR";
};

export type AutoFillResult = {
  description: string;
  salesPitch: string[];
  tags: string[];
  shareTemplates: { instagram: string; whatsapp: string; tiktok: string };
};

/**
 * Başlık + kategori + (varsa) fiyat/komisyondan düzenlenebilir ilan taslağı üretir.
 */
export function autoFillListing(input: AutoFillInput): AutoFillResult {
  const title = (input.title ?? "").trim();
  const category = (input.category ?? "").trim() || "Genel";
  const currency = input.currency ?? "TRY";
  const price = input.price && input.price > 0 ? input.price : undefined;
  const commission = input.commission && input.commission > 0 ? input.commission : undefined;
  const subcat = inferListingSubcategory({ category, title });
  const details = getCategoryRequiredDetails(category);
  const partnerHint = getCategoryPartnerHint(category);
  const keywords = keywordsFromTitle(title);

  const priceLine = price ? `Fiyat: ${moneyIn(price, currency)}.` : "Fiyat ilan detayında belirtilir.";
  const commLine = commission ? `Ortaklara %${commission} komisyon sunulur.` : "Komisyon oranı ilanda belirtilir.";

  // Açıklama: yalnızca gerçek girdiye dayalı, düzenlenebilir iskelet.
  const description = [
    `${title} — ${category}${subcat ? ` / ${subcat}` : ""} kategorisinde satışa sunulmuştur.`,
    `${priceLine} ${commLine}`,
    `Alıcı için önemli detaylar (${details.slice(0, 3).join(", ")}) satıcı tarafından güncellenecektir; lütfen yayınlamadan önce bu alanları kendi ürününe göre düzenle.`,
    `Ortak satış: Bu ürünü tanıtan ortaklar, onaylı satış gerçekleştiğinde komisyon kazanır. Ortaksat yalnızca eşleştirme yapar; ödeme, teslimat ve iade satıcı ile alıcı arasındadır.`
  ].join("\n\n");

  const salesPitch = [
    price
      ? `${title}, ${moneyIn(price, currency)} fiyatla ortak satışa açık.`
      : `${title} ortak satışa açık.`,
    commission
      ? `Ortaklar %${commission} komisyonla kazanç sağlar — hazır paylaşım metinleriyle hızlı başla.`
      : `Ortaklar hazır paylaşım metinleriyle hızlı başlar.`,
    partnerHint
  ];

  const tags = Array.from(new Set([...keywords, category.toLocaleLowerCase("tr-TR"), subcat.toLocaleLowerCase("tr-TR"), "ortak satış"]))
    .filter(Boolean)
    .slice(0, 8);

  const hashtag = category.replace(/[^\p{L}\p{N}]/gu, "").toLocaleLowerCase("tr-TR");
  const priceText = price ? ` — ${moneyIn(price, currency)}` : "";
  const commText = commission ? ` %${commission} komisyon` : "";
  const shareTemplates = {
    instagram: `${title}${priceText} 🔥\nOrtak satışta${commText}! Detay ve link için profildeki bağlantıya bak 👉\n#ortaksat #${hashtag || "firsat"}`,
    whatsapp: `Merhaba! ${title}${priceText} ilanını paylaşıyorum.${commission ? ` Ortak olup %${commission} komisyon kazanabilirsin.` : ""} İlan linki: `,
    tiktok: `${title} kaçırma!${commText ? ` Ortak satışta${commText} 🤝` : ""} #ortaksat #${hashtag || "firsat"} #fırsat`
  };

  return { description, salesPitch, tags, shareTemplates };
}
