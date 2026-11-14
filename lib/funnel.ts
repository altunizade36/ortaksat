import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

/**
 * İLAN HUNİSİ — "ilan sayfasına gelen kişi neden satıcıya ulaşmıyor?" sorusunu ölçer.
 *
 * Sunucuda yalnız (gün, ilan, olay, kaynak, ortam) başına bir SAYAÇ artar; kişi/cihaz/oturum kimliği
 * gönderilmez ve saklanmaz, çerez ya da yerel kayıt kullanılmaz (bkz. supabase/migrations/20261114040000_listing_funnel.sql).
 * Bu yüzden çerez rızasına bağlı değildir; yine de yalnız TOPLAM sayı üretir, kişi takibi yapılamaz.
 *
 * Aynı oturumda (sekme/uygulama açık kaldığı sürece) aynı ilan + olay bir kez sayılır. Otomasyon ve arama
 * motoru tarayıcıları sayılmaz (testlerimiz ve botlar görüntüleme sayısını şişiriyordu).
 */
export type FunnelEvent = "view" | "contact_click" | "partner_click" | "offer_click" | "share" | "auth_wall";
type FunnelSource = "direct" | "internal" | "search" | "social" | "other" | "app";

const sent = new Set<string>();

const SEARCH = /(^|\.)(google|bing|yandex|duckduckgo|yahoo|ecosia|brave)\./i;
const SOCIAL = /(^|\.)(instagram|facebook|fb|t\.co|twitter|x\.com|tiktok|whatsapp|wa\.me|telegram|t\.me|linkedin|lnkd\.in|pinterest|youtube|youtu\.be)(\.|$)/i;
const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview|headless|lighthouse|pagespeed|gptbot|claude|perplexity/i;

// Siteye GİRİŞ anı (modül yüklenirken, ilk sayfada): hangi sayfaya, nereden gelindi. Sonraki sayfalar "site içi"dir.
const landing: { path: string; source: FunnelSource } | null = (() => {
  if (Platform.OS !== "web" || typeof window === "undefined" || typeof document === "undefined") return null;
  let source: FunnelSource = "direct";
  try {
    const referrer = document.referrer ? new URL(document.referrer).hostname : "";
    if (!referrer) source = "direct";
    else if (referrer === window.location.hostname) source = "internal";
    else if (SEARCH.test(referrer)) source = "search";
    else if (SOCIAL.test(referrer)) source = "social";
    else source = "other";
  } catch { source = "direct"; }
  return { path: window.location.pathname, source };
})();

function isAutomated(): boolean {
  if (Platform.OS !== "web" || typeof navigator === "undefined") return false;
  return (navigator as Navigator & { webdriver?: boolean }).webdriver === true || BOT.test(navigator.userAgent || "");
}

function currentSource(): FunnelSource {
  if (Platform.OS !== "web") return "app";
  if (!landing || typeof window === "undefined") return "direct";
  // Ziyaretçi siteye doğrudan bu sayfadan girdiyse giriş kaynağı; başka sayfadan geldiyse "site içi".
  return window.location.pathname === landing.path ? landing.source : "internal";
}

function currentPlatform(): "web" | "mweb" | "ios" | "android" {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return typeof window !== "undefined" && window.innerWidth > 0 && window.innerWidth < 768 ? "mweb" : "web";
}

/** Sayaç artırır; hata sessizce yutulur (ölçüm hiçbir akışı bozmamalı). */
export function trackListingEvent(listingId: string | undefined | null, event: FunnelEvent): void {
  if (!supabase || !listingId) return;
  const key = `${listingId}:${event}`;
  if (sent.has(key) || isAutomated()) return;
  sent.add(key);
  void Promise.resolve(
    supabase.rpc("track_listing_event", { p_listing: listingId, p_event: event, p_source: currentSource(), p_platform: currentPlatform() })
  ).catch(() => { /* ölçüm kaydı zorunlu değil */ });
}

export type FunnelSummary = {
  from: string;
  totals: Partial<Record<FunnelEvent, number>>;
  by_source: { source: string; platform: string; views: number | null; clicks: number | null; auth_walls: number | null }[];
  top_listings: { listing_id: string; title: string; views: number | null; clicks: number | null; auth_walls: number | null }[];
};

/** Yönetici özeti (son `days` gün). Yetki yoksa ya da hata olursa null. */
export async function fetchFunnelSummary(days = 30): Promise<FunnelSummary | null> {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase.rpc("listing_funnel_summary", { p_days: days });
    if (error || !data) return null;
    return data as FunnelSummary;
  } catch { return null; }
}
