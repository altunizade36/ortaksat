import { displayListingTitle } from "./listing-title";
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
 * Bir satış için EFEKTİF komisyon — sunucudaki `compute_agreed_commission` ile AYNI kural:
 *   taban = KİLİTLİ anlaşma (agreed_*; eski kayıtta canlı ilan), kademeli oran dahil;
 *   satıcının ortağa özel oranı YALNIZ tabandan yüksekse uygulanır → greatest(anlaşılan, özel).
 * Eskiden özel oran tabanın önüne geçiyordu: özel oran anlaşılandan düşükken ekranda düşük tutar
 * görünüyor, sunucu ise yüksek olanı yazıyordu (görünen ≠ kaydedilen).
 */
export function effectiveCommissionAmount(listing: Listing, partnership: Partnership | undefined, priorSales: number, amount: number, quantity: number): number {
  const qty = Math.max(1, Math.floor(quantity || 1));
  const amt = Number.isFinite(amount) ? Math.max(0, amount) : 0; // NaN/negatif satış tutarı → 0
  // Sonuç ASLA NaN/negatif dönmesin (bozuk override/tier verisi para modelini kirletmesin).
  const safe = (n: number) => (Number.isFinite(n) ? Math.max(0, Math.round(n)) : 0);
  let base: number;
  if (partnership?.agreedCommissionType && typeof partnership.agreedCommissionValue === "number") {
    base = partnership.agreedCommissionType === "rate"
      ? safe((amt * tierRate(partnership.agreedCommissionTiers, partnership.agreedCommissionValue, priorSales)) / 100)
      : safe(partnership.agreedCommissionValue * qty);
  } else if (listing.commissionType === "rate") {
    base = safe((amt * tierRate(listing.commissionTiers, listing.commissionValue, priorSales)) / 100);
  } else {
    base = safe(listing.commissionValue * qty);
  }
  if (partnership?.commissionOverrideType && typeof partnership.commissionOverrideValue === "number") {
    const override = partnership.commissionOverrideType === "rate"
      ? safe((amt * partnership.commissionOverrideValue) / 100)
      : safe(partnership.commissionOverrideValue * qty);
    return Math.max(base, override);
  }
  return base;
}

/** "%12" ya da "₺1.500" — komisyon değerinin kısa gösterimi. */
export function commissionValueLabel(type: Listing["commissionType"], value: number, currency?: string | null): string {
  return type === "rate" ? `%${String(value).replace(".", ",")}` : moneyIn(value, currency);
}

export type PartnershipTerms = {
  /** Anlaşılan (kilitli) komisyon; eski kayıtta ilanın güncel değeri. Kademeli oranda o anki kademe. */
  agreedType: Listing["commissionType"];
  agreedValue: number;
  /** Anlaşma katılımda kilitlendi mi (false = eski kayıt, ilanın güncel şartları gösterilir). */
  locked: boolean;
  /** Satıcının bu ortağa özel komisyonu (varsa). */
  overrideType?: Listing["commissionType"];
  overrideValue?: number;
  /** Özel komisyon, anlaşılandan yüksek olduğu için UYGULANIYOR mu (ilan fiyatı üzerinden karşılaştırılır). */
  overrideApplies: boolean;
  /** Uygulanan (gösterilecek) komisyon: anlaşılan ile özelden yüksek olan. */
  type: Listing["commissionType"];
  value: number;
  /** İlan fiyatı × 1 adet için uygulanan komisyon tutarı. */
  amount: number;
  bonusAmount: number;
  bonusQuota: number;
  returnWindowDays: number;
  commissionDueDays: number;
};

/**
 * Bir ortaklığın GEÇERLİ şartları — tek kaynak. Bütün ekranlar (anlaşma kartı, ortak/satıcı panelleri,
 * satış kaydı) komisyonu, bonusu, iade süresini ve ödeme vadesini buradan okur; sunucu da satışta
 * aynı değerleri (kilitli anlaşma → yoksa ilan) kullanır.
 */
export function partnershipTerms(listing: Listing, partnership: Partnership | undefined, priorSales = 0): PartnershipTerms {
  const locked = Boolean(partnership?.agreedCommissionType) && typeof partnership?.agreedCommissionValue === "number";
  const agreedType = locked ? partnership!.agreedCommissionType! : listing.commissionType;
  const rawValue = locked ? partnership!.agreedCommissionValue! : listing.commissionValue;
  const agreedValue = agreedType === "rate" ? tierRate(locked ? partnership!.agreedCommissionTiers : listing.commissionTiers, rawValue, priorSales) : rawValue;
  const hasOverride = Boolean(partnership?.commissionOverrideType) && typeof partnership?.commissionOverrideValue === "number";
  const overrideType = hasOverride ? partnership!.commissionOverrideType : undefined;
  const overrideValue = hasOverride ? partnership!.commissionOverrideValue : undefined;
  const at = (type: Listing["commissionType"], value: number) => (type === "rate" ? (Math.max(0, listing.price) * value) / 100 : value);
  const overrideApplies = hasOverride && (overrideType === agreedType ? overrideValue! > agreedValue : at(overrideType!, overrideValue!) > at(agreedType, agreedValue));
  const num = (value: number | undefined, fallback: number | undefined) => { const n = value ?? fallback ?? 0; return Number.isFinite(n) ? Math.max(0, n) : 0; };
  return {
    agreedType,
    agreedValue,
    locked,
    overrideType,
    overrideValue,
    overrideApplies,
    type: overrideApplies ? overrideType! : agreedType,
    value: overrideApplies ? overrideValue! : agreedValue,
    amount: effectiveCommissionAmount(listing, partnership, priorSales, listing.price, 1),
    bonusAmount: num(partnership?.agreedBonusAmount, listing.bonusAmount),
    bonusQuota: num(partnership?.agreedBonusQuota, listing.bonusQuota),
    returnWindowDays: num(partnership?.agreedReturnWindowDays, listing.returnWindowDays),
    commissionDueDays: num(partnership?.agreedCommissionDueDays, listing.commissionDueDays)
  };
}

/** Bu satışa eklenecek başlangıç bonusu: anlaşmadaki ilk `bonusQuota` satışta +`bonusAmount` (sunucuyla aynı kural). */
export function partnershipBonusFor(listing: Listing, partnership: Partnership | undefined, priorSales: number): number {
  const terms = partnershipTerms(listing, partnership, priorSales);
  return terms.bonusAmount > 0 && terms.bonusQuota > 0 && priorSales < terms.bonusQuota ? Math.round(terms.bonusAmount) : 0;
}

/**
 * Ortağın komisyon önerisi satıcıya ayrıca sunulmalı mı: yalnız onay bekleyen başvuruda ve öneri
 * anlaşılan (ilan) komisyonundan YÜKSEKSE (sunucu daha düşük öneriyi uygulamaz; yüzde 90'ı aşamaz).
 */
export function partnershipProposal(listing: Listing, partnership: Partnership): { type: Listing["commissionType"]; value: number } | null {
  const value = partnership.proposedCommissionValue;
  if (partnership.status !== "pending" || typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const type = partnership.agreedCommissionType ?? listing.commissionType;
  const base = partnership.agreedCommissionValue ?? listing.commissionValue;
  if (value <= base || (type === "rate" && value > 90)) return null;
  return { type, value };
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
  return `https://www.ortaksat.com/ilan/${listing.id}`; // Türkçe adres (iç rota /listing/[id]; bkz. lib/url-aliases.ts)
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
  return `https://www.ortaksat.com/ilan/${listing.id}?ortak-davet=${listingInviteCode(listing)}`;
}

/** TR cep telefonunu WhatsApp/wa.me için uluslararası haneye çevirir ("0555…" -> "90555…"). Geçersizse "". */
export function trPhoneIntl(phone: string | undefined | null): string {
  let d = (phone ?? "").replace(/[^0-9]/g, "");
  if (d.startsWith("90")) d = d.slice(2);
  if (d.startsWith("0")) d = d.slice(1);
  return d.length === 10 && d.startsWith("5") ? "90" + d : "";
}

/**
 * Komisyon karşılığı yapılan paylaşımın REKLAM olduğunu belirten zorunlu satır.
 * Dayanak: 6502 sayılı Kanun md. 61 (örtülü reklam yasağı), Ticari Reklam ve Haksız Ticari Uygulamalar
 * Yönetmeliği ve Reklam Kurulu kılavuzu — "Reklam"/"Tanıtım" ibaresi ile reklam verenin (satıcının) adı
 * birlikte ve ilk bakışta görünür olmalı. Bu yüzden metnin EN BAŞINA konur (bkz. Ortak Sözleşmesi md. 13).
 * Yalnız ORTAK paylaşırken kullanılır; satıcının kendi ilanını paylaşması bu kapsamda değildir.
 */
export function adDisclosureLine(sellerName?: string | null): string {
  const name = (sellerName ?? "").trim();
  return name ? `#Reklam · Satıcı: ${name}` : "#Reklam";
}

/**
 * Ortağın ürünü tanıtırken kullanabileceği HAZIR metinler. MODEL: zorunlu referans linki/kodu
 * veya takip YOKTUR → düz ürün sayfası linki. Metin ALICI-YÜZÜDÜR (komisyon bilgisi içermez).
 * (`refCode` param'ı geriye-uyumluluk için korunur ama artık kullanılmaz.)
 * `disclosure` verilirse (ortak paylaşımı → adDisclosureLine) her metnin başına reklam bildirimi eklenir;
 * satıcının yazdığı özel şablonlara da eklenir.
 */
export function listingShareTemplates(listing: Listing, url?: string, _refCode?: string, disclosure?: string) {
  const link = url ?? `https://www.ortaksat.com/ilan/${listing.id}`;
  const firstPitch = listing.salesPitch[0] ?? listing.description;
  const lead = disclosure ? `${disclosure}\n` : "";

  return {
    instagram: lead + (listing.shareTemplates?.instagram || `${displayListingTitle(listing.title)}\n${firstPitch}\nFiyat: ${money(listing.price)}\n${link}`),
    whatsapp: lead + (listing.shareTemplates?.whatsapp || `Merhaba, ${displayListingTitle(listing.title)} ürünü ilgini çekebilir.\nFiyat: ${money(listing.price)}\n${firstPitch}\n${link}`),
    tiktok: lead + (listing.shareTemplates?.tiktok || `${displayListingTitle(listing.title)} — ${firstPitch}\nFiyat: ${money(listing.price)}\n${link}`)
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

/**
 * İLAN NUMARASI — her ilana özel, Sahibinden tarzı 10 haneli benzersiz kod (ör. 1229447664).
 * İlanın UUID'sinden DETERMİNİSTİK türetilir: aynı ilan → hep aynı numara; DB'ye kolon eklemeye
 * gerek yok, migration yok. Yalnız GÖSTERİM/aramada kullanılır (otoriter kimlik hâlâ UUID).
 *
 * 128-bit UUID → 32-bit FNV-1a hash → 9 haneye modlanır, başına "2" konur → sabit 10 hane,
 * hep 2 ile başlar (marka imzası). Çakışma olasılığı gösterim için ihmal edilebilir.
 */
export function listingNo(id: string | undefined | null): string {
  if (!id) return "";
  const hex = String(id).replace(/[^0-9a-fA-F]/g, "").toLowerCase();
  // FNV-1a 32-bit (deterministik, hızlı, iyi dağılım)
  let h = 0x811c9dc5;
  for (let i = 0; i < hex.length; i++) {
    h ^= hex.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  const nine = h % 1_000_000_000; // 0..999_999_999
  return "2" + String(nine).padStart(9, "0"); // hep 10 hane, "2" ile başlar
}
