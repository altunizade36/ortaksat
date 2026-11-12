import { useCallback, useEffect, useRef, useState } from "react";

import type { CategoryNode } from "@/lib/category-tree";
import { groupThousands } from "@/lib/format";
import { fetchMobileCatalogue } from "@/lib/mobile-catalogue-service";
import { emptyMobileFilters, type MobileFilters } from "@/lib/mobile-filters";
import { isSupabaseConfigured } from "@/lib/supabase";
import { fetchPublicProfiles } from "@/lib/supabase-data";
import type { Listing, User } from "@/lib/types";

/**
 * WEB sunucu-tarafı katalog (ölçek): Keşfet, masaüstü ana sayfa ve kategori sayfası filtre/
 * sıralama/arama ölçütlerini `mobile_catalogue_page` RPC'sine eşler. Sonuç ve TOPLAM sunucudan
 * gelir; RPC'nin desteklemediği üç ölçüt (tam şehir metni, aynı alanda çoklu-VEYA facet, göreli
 * "Trend" eşiği) sayfa tarafında yüklü sunucu sayfalarının üzerine yerelde uygulanır. Supabase yoksa ya da RPC hata verirse `fallback` true olur →
 * sayfa mevcut yerel süzmesine döner (sayfa hiçbir zaman bu yüzden boş kalmaz).
 */

/** RPC'nin `sort` parametresinde desteklediği değerler. */
export type WebCatalogueSort = "recommended" | "newest" | "priceAsc" | "priceDesc" | "commission" | "popular" | "commissionRate" | "rating";

/** mobile_catalogue_page v3'ün web'e özel ek `filters` anahtarları (hepsi isteğe bağlı). */
type WebExtraFilters = {
  instant?: boolean; minCommission?: number; minRate?: number; commissionType?: "rate" | "fixed"; stock?: "in" | "low";
  featured?: boolean; createdAfter?: string; minRating?: number; verified?: boolean;
};

export type WebCatalogueCriteria = {
  /** Kökten seçili düğüme kategori yolu; boş = kategori yok. */
  trail: CategoryNode[];
  query?: string;
  priceMin?: number | null;
  priceMax?: number | null;
  provinceId?: number | null;
  districtId?: number | null;
  /** Facet seçimleri (alan → seçili değerler; değerler web'de VEYA'lanır). */
  attrs?: Record<string, string[]>;
  /** Sayısal aralıklar (yalnız kategori şemasında bulunan alanlar gönderilmeli). */
  ranges?: Record<string, { min: string; max: string }>;
  /** Yalnız anında ortaklık (partnership_mode = open). */
  instant?: boolean;
  /** En az ortak kazancı (₺) / en az komisyon oranı (%). */
  minCommission?: number;
  minRate?: number;
  commissionType?: "rate" | "fixed" | null;
  stock?: "in" | "low" | null;
  onlyFeatured?: boolean;
  /** Son N gün içinde eklenenler (createdAfter; saat başına yuvarlanır → istek anahtarı kararlı). */
  newerThanDays?: number;
  /** Satıcı puanı alt sınırı / yalnız doğrulanmış satıcı. */
  minRating?: number;
  verified?: boolean;
  sort: WebCatalogueSort;
};

export type WebCatalogueRequest = {
  key: string;
  trail: CategoryNode[];
  filters: MobileFilters & WebExtraFilters;
  query: string;
  sort: string;
  /** Sunucuya gönderilEMEYEN, sayfanın yerelde uygulamaya devam etmesi gereken parçalar. */
  local: { attrKeys: string[] };
};

/** Web filtre girdisi: "100.000" (TR binlik) → 100000; "1,5" / "1.5" → 1.5; geçersiz → null. */
export function webFilterNumber(raw: string | number | null | undefined): number | null {
  if (raw == null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) && Math.abs(raw) < 1e15 ? raw : null;
  const value = raw.trim();
  if (!value) return null;
  const n = /^\d{1,3}(\.\d{3})+(,\d+)?$/.test(value) ? Number(value.replace(/\./g, "").replace(",", ".")) : Number(value.replace(",", "."));
  return Number.isFinite(n) && Math.abs(n) < 1e15 ? n : null;
}

/** Yalnız kategori şemasında bulunan (`fields`) ve değeri girilmiş sayısal aralıklar. */
export function catalogueRanges(fields: Array<{ key: string }>, numRange: Record<string, { min: string; max: string }>): Record<string, { min: string; max: string }> {
  const out: Record<string, { min: string; max: string }> = {};
  for (const field of fields) {
    const r = numRange[field.key];
    if (r && ((r.min ?? "").trim() || (r.max ?? "").trim())) out[field.key] = r;
  }
  return out;
}

// Sunucudaki mobile_filter_number metinde "." işaretini binlik sayıp siler → ondalığı "," ile yolla.
const serverNumber = (n: number) => String(n).replace(".", ",");

export function buildCatalogueRequest(c: WebCatalogueCriteria): WebCatalogueRequest {
  const filters: MobileFilters & WebExtraFilters = emptyMobileFilters();
  let min = c.priceMin != null && Number.isFinite(c.priceMin) && c.priceMin > 0 ? c.priceMin : null;
  let max = c.priceMax != null && Number.isFinite(c.priceMax) && c.priceMax > 0 && c.priceMax < Number.MAX_SAFE_INTEGER ? c.priceMax : null;
  if (min != null && max != null && min > max) { const t = min; min = max; max = t; }
  if (min != null) filters.min = serverNumber(min);
  if (max != null) filters.max = serverNumber(max);
  if (c.provinceId != null) filters.loc = c.districtId != null ? { provinceId: c.provinceId, districtId: c.districtId } : { provinceId: c.provinceId };
  const positive = (n: number | undefined) => (n != null && Number.isFinite(n) && n > 0 ? n : undefined);
  if (c.instant) filters.instant = true;
  if (positive(c.minCommission)) filters.minCommission = c.minCommission;
  if (positive(c.minRate)) filters.minRate = c.minRate;
  if (positive(c.minRating)) filters.minRating = c.minRating;
  if (c.commissionType === "rate" || c.commissionType === "fixed") filters.commissionType = c.commissionType;
  if (c.stock === "in" || c.stock === "low") filters.stock = c.stock;
  if (c.onlyFeatured) filters.featured = true;
  if (c.verified) filters.verified = true;
  // Saat başına yuvarla: Date.now() her render'da değişirdi → anahtar değişir → sonsuz yeniden istek.
  const days = positive(c.newerThanDays);
  if (days) filters.createdAfter = new Date(Math.floor(Date.now() / 3_600_000) * 3_600_000 - days * 86_400_000).toISOString();

  // Facet: tek değer → sunucu (tek elemanlı dizi; ilan değeri tekil de dizi de olsa eşleşir).
  // Aynı alanda birden çok değer web'de VEYA'dır, sunucu dizi beklentisini VE'ler → yerelde kalır.
  const localAttrKeys: string[] = [];
  for (const key of Object.keys(c.attrs ?? {}).sort()) {
    const values = (c.attrs?.[key] ?? []).filter(Boolean);
    if (values.length === 1) filters.attrs[key] = [values[0]];
    else if (values.length > 1) localAttrKeys.push(key);
  }
  for (const key of Object.keys(c.ranges ?? {}).sort()) {
    const lo = webFilterNumber(c.ranges?.[key]?.min);
    const hi = webFilterNumber(c.ranges?.[key]?.max);
    if (lo == null && hi == null) continue;
    filters.ranges[key] = { min: lo == null ? "" : serverNumber(lo), max: hi == null ? "" : serverNumber(hi) };
  }

  const sort: string = c.sort;
  const query = (c.query ?? "").replace(/\s+/g, " ").trim().slice(0, 120);
  const key = JSON.stringify({ t: c.trail.map((n) => n.key), f: filters, q: query, s: sort });
  return { key, trail: c.trail, filters, query, sort, local: { attrKeys: localAttrKeys } };
}

type State = {
  listings: Listing[];
  owners: Record<string, User>;
  total: number;
  loadedKey: string;
  hasMore: boolean;
  loading: boolean;
  loadingMore: boolean;
  failedInitial: boolean;
  failedMore: boolean;
};
const EMPTY: State = { listings: [], owners: {}, total: 0, loadedKey: "", hasMore: false, loading: false, loadingMore: false, failedInitial: false, failedMore: false };
const DEBOUNCE_MS = 250;

const dedupe = (items: Listing[]) => Array.from(new Map(items.map((l) => [l.id, l])).values());

async function loadPage(request: WebCatalogueRequest, offset: number, limit: number, known: Record<string, User>) {
  const data = await fetchMobileCatalogue({ trail: request.trail, filters: request.filters, query: request.query, sort: request.sort, offset, limit });
  // Sahipler (kart rozeti + satıcı puanı/doğrulama süzmesi) sayfayla BİRLİKTE gelir; profil
  // sorgusu düşerse ilanlar yine gösterilir (sahip bilgisi bellekteki kullanıcıdan çözülür).
  const owners: Record<string, User> = {};
  const missing = Array.from(new Set(data.listings.map((l) => l.ownerId))).filter((id) => id && !known[id]);
  if (missing.length) {
    try { for (const user of await fetchPublicProfiles(missing)) owners[user.id] = user; } catch { /* sahipsiz göster */ }
  }
  return { listings: data.listings, total: data.total, count: data.listings.length, owners };
}

export type ServerCatalogue = {
  /** Geçerli ölçütlerin anahtarı ("" = devre dışı). */
  key: string;
  /** Son başarılı sunucu sonucu (yeni ölçüt yüklenirken bir önceki sonuç korunur). */
  listings: Listing[];
  owners: Record<string, User>;
  /** Sunucudaki GERÇEK toplam (yerel ek süzmeler hariç). */
  total: number;
  /** Sunucu sonucu gösterilebilir (başarılı yanıt var, hata yok, boş-ve-yükleniyor değil). */
  ready: boolean;
  /** `listings` tam olarak geçerli ölçütlere ait (bayat değil). */
  settled: boolean;
  loading: boolean;
  loadingMore: boolean;
  failed: boolean;
  /** Sunucu kullanılamıyor (Supabase yok / ilk istek hatası) → sayfa yerel süzmeye dönmeli. */
  fallback: boolean;
  hasMore: boolean;
  loadMore: () => void;
  retry: () => void;
  /** Geçerli isteğin yerelde kalan parçaları. */
  local: WebCatalogueRequest["local"];
};

export function useServerCatalogue({ enabled, criteria, pageSize = 40 }: { enabled: boolean; criteria: WebCatalogueCriteria; pageSize?: number }): ServerCatalogue {
  const request = buildCatalogueRequest(criteria);
  const key = enabled ? request.key : "";
  const [state, setState] = useState<State>(EMPTY);
  const [retryTick, setRetryTick] = useState(0);
  const requestRef = useRef(request);
  const stateRef = useRef(state);
  const revision = useRef(0);
  const moreLock = useRef(false);
  const offsetRef = useRef(0);
  // Yalnız effect/handler içinde okunur (render çıktısını etkilemez).
  requestRef.current = request;
  stateRef.current = state;

  useEffect(() => {
    const rev = ++revision.current;
    moreLock.current = false;
    if (!key) {
      offsetRef.current = 0;
      setState((s) => (s === EMPTY ? s : EMPTY));
      return;
    }
    if (!isSupabaseConfigured) {
      setState({ ...EMPTY, failedInitial: true });
      return;
    }
    setState((s) => ({ ...s, loading: true, loadingMore: false, failedMore: false }));
    const timer = setTimeout(() => {
      loadPage(requestRef.current, 0, pageSize, stateRef.current.owners).then((page) => {
        if (rev !== revision.current) return;
        offsetRef.current = page.count;
        setState((s) => ({
          listings: dedupe(page.listings), owners: { ...s.owners, ...page.owners }, total: page.total, loadedKey: key,
          hasMore: page.count > 0 && page.count < page.total, loading: false, loadingMore: false, failedInitial: false, failedMore: false
        }));
      }).catch(() => {
        if (rev === revision.current) setState((s) => ({ ...s, loading: false, failedInitial: true }));
      });
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); revision.current++; };
  }, [key, retryTick, pageSize]);

  const loadMore = useCallback(() => {
    const s = stateRef.current;
    if (!key || moreLock.current || s.loading || s.failedInitial || s.loadedKey !== key || !s.hasMore) return;
    const rev = revision.current;
    moreLock.current = true;
    setState((p) => ({ ...p, loadingMore: true, failedMore: false }));
    loadPage(requestRef.current, offsetRef.current, pageSize, s.owners).then((page) => {
      if (rev !== revision.current) return;
      offsetRef.current += page.count;
      const offset = offsetRef.current;
      setState((p) => ({
        ...p, listings: dedupe([...p.listings, ...page.listings]), owners: { ...p.owners, ...page.owners }, total: page.total,
        hasMore: page.count > 0 && offset < page.total, loadingMore: false
      }));
    }).catch(() => {
      if (rev === revision.current) setState((p) => ({ ...p, loadingMore: false, failedMore: true }));
    }).finally(() => {
      if (rev === revision.current) moreLock.current = false;
    });
  }, [key, pageSize]);

  const failedMore = state.failedMore;
  const retry = useCallback(() => { if (failedMore) loadMore(); else setRetryTick((v) => v + 1); }, [failedMore, loadMore]);

  // `pending` render anında türetilir (effect'i beklemez) → ölçüt değişiminde tek karelik
  // "bayat-boş sonuç" görünmez.
  const pending = !!key && (state.loading || state.loadedKey !== key);
  const fallback = !!key && state.failedInitial;
  const hasResult = state.loadedKey !== "";
  return {
    key,
    listings: state.listings,
    owners: state.owners,
    total: state.total,
    ready: !!key && !fallback && hasResult && !(pending && state.listings.length === 0),
    settled: !!key && !pending && !fallback,
    loading: pending && !fallback,
    loadingMore: state.loadingMore,
    failed: state.failedInitial || state.failedMore,
    fallback,
    hasMore: !!key && !pending && state.hasMore,
    loadMore,
    retry,
    local: request.local
  };
}

/**
 * Görünür ilan sayısı (`have`) istenenin (`want`) altındaysa sonraki sunucu sayfasını ister.
 * İki işi görür: (1) "daha fazla göster"/sonsuz kaydırma `want`'ı artırınca sayfa çekilir;
 * (2) yerel ek süzme bir sayfanın çoğunu elerse art arda sayfa çekilir. Kaçak döngü olmasın
 * diye her `want`/ölçüt değişimi başına en çok `maxAuto` sayfa.
 */
export function useCatalogueFill(cat: ServerCatalogue, have: number, want: number, maxAuto = 6) {
  const budget = useRef(maxAuto);
  const { key, ready, settled, hasMore, loadingMore, failed, loadMore } = cat;
  useEffect(() => { budget.current = maxAuto; }, [key, want, maxAuto]);
  useEffect(() => {
    if (!ready || !settled || !hasMore || loadingMore || failed || have >= want || budget.current <= 0) return;
    budget.current--;
    loadMore();
  }, [ready, settled, hasMore, loadingMore, failed, loadMore, have, want]);
}

/**
 * Gösterilecek sonuç sayısı. `exact` (yerel ek süzme YOK) → sunucunun gerçek toplamı;
 * aksi halde yüklü+süzülmüş adet, devamı varsa "+" ile (gerçek toplam bilinemez).
 */
export function catalogueCountLabel(cat: ServerCatalogue, exact: boolean, have: number): string {
  return exact ? groupThousands(cat.total) : `${groupThousands(have)}${cat.hasMore ? "+" : ""}`;
}
