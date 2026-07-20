import type { Listing, Partnership } from "@/lib/types";
import { defaultCurrency, deviceLocale, localize } from "@/lib/locale";

const formatter = new Intl.NumberFormat(deviceLocale, {
  style: "currency",
  currency: defaultCurrency,
  currencyDisplay: "narrowSymbol",
  maximumFractionDigits: 0
});

// Deterministic thousands grouping with "." — identical on Node (static export)
// and the browser, so prices don't trigger a hydration mismatch (React #418).
export function groupThousands(value: number) {
  const rounded = Math.round(Math.abs(Number.isFinite(value) ? value : 0));
  const digits = String(rounded);
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += ".";
    out += digits[i];
  }
  return (value < 0 ? "-" : "") + out;
}

export function money(value: number) {
  if (defaultCurrency === "TRY") {
    return `₺${groupThousands(value)}`;
  }
  const formatted = formatter.format(Number.isFinite(value) ? value : 0);
  return formatted;
}

/**
 * Kompakt para: dar istatistik kartlarında büyük tutarları kısaltır (₺6,1M / ₺1,5B).
 * Tam gösterim yeri olan yerlerde money() kullanılır; bu yalnız 3-sütun kart gibi
 * sıkışık alanlar için — eskiden "₺6.141...." diye kırpılıyordu.
 */
export function moneyCompact(value: number): string {
  const v = Number.isFinite(value) ? Math.round(value) : 0;
  const sym = defaultCurrency === "TRY" ? "₺" : "";
  const abs = Math.abs(v);
  // Türkçe kısaltma: M = milyon, Mr = milyar. "B" (bin/billion karışır) KULLANMA.
  if (abs >= 1_000_000_000) return `${sym}${(v / 1_000_000_000).toFixed(1).replace(".0", "").replace(".", ",")} Mr`;
  if (abs >= 1_000_000) return `${sym}${(v / 1_000_000).toFixed(1).replace(".0", "").replace(".", ",")} M`;
  return money(v); // milyon altı tam sığar
}

export type CurrencyCode = "TRY" | "USD" | "EUR";
export const CURRENCIES: Array<{ code: CurrencyCode; symbol: string; label: string }> = [
  { code: "TRY", symbol: "₺", label: "Türk Lirası (₺)" },
  { code: "USD", symbol: "$", label: "Dolar ($)" },
  { code: "EUR", symbol: "€", label: "Euro (€)" }
];
const CURRENCY_SYMBOL: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€" };

/** İlanın para birimine göre fiyat gösterimi (₺/$/€ + deterministik binlik ayırıcı). */
export function moneyIn(value: number, currency?: string | null) {
  const sym = CURRENCY_SYMBOL[currency ?? "TRY"] ?? "₺";
  return `${sym}${groupThousands(value)}`;
}

export function commissionText(listing: Listing) {
  if (listing.commissionType === "rate") {
    return localize(`%${listing.commissionValue} komisyon`, `${listing.commissionValue}% commission`);
  }

  // Sabit komisyon: ilanın para birimiyle göster (money() her zaman ₺ verirdi).
  const fixed = moneyIn(listing.commissionValue, listing.currency);
  return localize(`${fixed} komisyon`, `${fixed} commission`);
}

export function commissionAmount(listing: Listing) {
  if (listing.commissionType === "rate") {
    return Math.round((listing.price * listing.commissionValue) / 100);
  }

  return listing.commissionValue;
}

/**
 * Komisyon ORANI (%). Oran tipinde doğrudan değer; SABİT tipte fiyata göre
 * efektif oran (sabit komisyonlu ilanlar da orana göre filtrelenip sıralanabilsin).
 * Fiyat 0/eksikse 0 döner. Tek kaynak — ana sayfa filtre/sıralamaları buradan okur.
 */
export function commissionRatePct(listing: Listing) {
  if (listing.commissionType === "rate") return listing.commissionValue;
  return listing.price > 0 ? Math.round((listing.commissionValue / listing.price) * 100) : 0;
}

/** Kademeli komisyonda uygulanan oran: min <= priorSales olan en yüksek tier; yoksa baz oran. */
export function tierRate(tiers: Array<{ minSales: number; rate: number }> | undefined, baseRate: number, priorSales: number): number {
  if (!tiers || tiers.length === 0) return baseRate;
  let rate = baseRate;
  for (const t of [...tiers].sort((a, b) => a.minSales - b.minSales)) {
    if (priorSales >= t.minSales) rate = t.rate;
  }
  return rate;
}

/**
 * Bir satış için EFEKTİF komisyon (öncelik sırası): 1) per-ortak override, 2) kademeli
 * (rate) oran (ortağın o ilandaki kümülatif satışına göre), 3) ilan varsayılanı.
 */
// Öncelik: satıcı per-ortak override > KİLİTLİ agreed snapshot (Faz 3) > canlı ilan.
// Böylece satıcı ilanı sonradan düzenlese de MEVCUT ortağın komisyonu değişmez.
// (Sunucu tarafı otorite: partnerships.agreed_* trigger ile ilandan kilitlenir; DB
//  compute_agreed_commission fonksiyonu aynı mantığı sunucuda uygular.)
export function effectiveCommissionAmount(listing: Listing, partnership: Partnership | undefined, priorSales: number, amount: number, quantity: number): number {
  const qty = Math.max(1, Math.floor(quantity || 1));
  const amt = Number.isFinite(amount) ? Math.max(0, amount) : 0; // NaN/negatif satış tutarı → 0
  // Sonuç ASLA NaN/negatif dönmesin (bozuk override/tier verisi para modelini kirletmesin).
  const safe = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);
  if (partnership?.commissionOverrideType && typeof partnership.commissionOverrideValue === "number") {
    return partnership.commissionOverrideType === "rate"
      ? safe((amt * partnership.commissionOverrideValue) / 100)
      : safe(partnership.commissionOverrideValue * qty);
  }
  if (partnership?.agreedCommissionType && typeof partnership.agreedCommissionValue === "number") {
    return partnership.agreedCommissionType === "rate"
      ? safe((amt * tierRate(partnership.agreedCommissionTiers, partnership.agreedCommissionValue, priorSales)) / 100)
      : safe(partnership.agreedCommissionValue * qty);
  }
  if (listing.commissionType === "rate") {
    return safe((amt * tierRate(listing.commissionTiers, listing.commissionValue, priorSales)) / 100);
  }
  return safe(listing.commissionValue * qty);
}

/** Ortağın paylaşım linki. `channel` (whatsapp/instagram/tiktok/share) verilirse `&c=` ile
 *  eklenir → landing kanalı yakalayıp referral_clicks'e yazar (hangi kanal dönüşüm getiriyor
 *  ölçülür; büyüme buna göre optimize edilir). */
export function shareUrl(listing: Listing, refCode: string, channel?: string) {
  const base = `https://www.ortaksat.com/i/${listing.slug}?ref=${refCode}`;
  return channel ? `${base}&c=${encodeURIComponent(channel)}` : base;
}

// Düz ürün paylaşımı: herkesin açabileceği ürün detay sayfası (referans formu değil).
export function productUrl(listing: Listing) {
  return `https://www.ortaksat.com/listing/${listing.id}`;
}

/**
 * "Sadece davetle" modundaki ilanlar için ilana-bağlı deterministik davet kodu.
 * İlan id'si zaten tahmin edilemez; kod, linki paylaşmayan birinin ortak
 * olmasını engelleyen ek kapıdır (FNV-1a, kısa base36). Satıcı bu kodu içeren
 * daveti paylaşınca, linke sahip ortak anında (ön-onaylı) katılabilir.
 */
export function listingInviteCode(listing: Pick<Listing, "id" | "ownerId">): string {
  const s = `ortak-davet:${listing.id}:${listing.ownerId}`;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Satıcının paylaşacağı ortak davet linki (ilan detayında ?ortak-davet=<kod>). */
export function partnerInviteUrl(listing: Listing) {
  return `https://www.ortaksat.com/listing/${listing.id}?ortak-davet=${listingInviteCode(listing)}`;
}

/** TR cep telefonunu WhatsApp/wa.me için uluslararası haneye çevirir ("0555…" -> "90555…"). Geçersizse "". */
export function trPhoneIntl(phone: string | undefined | null): string {
  let d = (phone ?? "").replace(/[^0-9]/g, "");
  if (d.startsWith("90")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d.length === 10 && d.startsWith("5") ? "90" + d : "";
}

/**
 * Kanala özel paylaşım metinleri. `refCode` verilirse her kanal KENDİ kanal-etiketli linkini
 * alır (dönüşüm ölçümü). Instagram metni BİO-YÖNELİMLİDİR: IG gönderi/açıklamasında ham URL
 * TIKLANAMAZ → "link bio'da/profilde" der (ham link basıp ölü-uç yaratmaz; en büyük sosyal
 * kanalda tıklama kaybını önler).
 */
export function listingShareTemplates(listing: Listing, url?: string, refCode?: string) {
  const mk = (channel: string) => (refCode ? shareUrl(listing, refCode, channel) : (url ?? `https://www.ortaksat.com/listing/${listing.id}`));
  const commission = commissionText(listing);
  const firstPitch = listing.salesPitch[0] ?? listing.description;

  return {
    // IG: ham link tıklanamaz → bio/profil yönlendirmesi + DM daveti (link yine yakalanır ama
    // vurgu tıklanabilir yüzeyde). Satıcının özel şablonu varsa aynen korunur.
    instagram: listing.shareTemplates?.instagram || `${listing.title}\n${firstPitch}\nFiyat: ${money(listing.price)}\n🔗 Satın alma linki profilimde (bio) — ya da DM'den yazın.\n${mk("instagram")}`,
    whatsapp: listing.shareTemplates?.whatsapp || `Merhaba, ${listing.title} ürünü için detayları göndereyim.\nFiyat: ${money(listing.price)}\n${firstPitch}\nLink: ${mk("whatsapp")}`,
    tiktok: listing.shareTemplates?.tiktok || `${listing.title} için kısa tanıtım: ${firstPitch} ${commission}. Detay linki profilde: ${mk("tiktok")}`
  };
}

/**
 * Mesaj/sohbet zaman damgası: YEREL saat, saniye hassasiyeti "YYYY-MM-DD HH:MM:SS".
 * `iso` verilirse (sunucudan gelen UTC ISO) yerel saate çevrilir; verilmezse şu an.
 * Amaç: gerçek-zamanlı (sunucu) + yerel gönderim mesajlarının hep AYNI format ve
 * zaman diliminde olması → thread sıralaması (createdAt.localeCompare) tutarlı,
 * gösterilen saat cihaz saatiyle uyumlu, gün ayracı (Bugün) yerel güne göre doğru.
 */
export function msgStamp(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  if (Number.isNaN(d.getTime())) return (iso ?? "").slice(0, 19).replace("T", " ");
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Yerel bugünün tarihi "YYYY-MM-DD" (mesaj gün ayracı için; UTC değil). */
export function localToday(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
