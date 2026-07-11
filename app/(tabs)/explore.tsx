import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";

import { BrandFilter } from "@/components/brand-filter";
import { colors } from "@/components/colors";
import { ListingCard } from "@/components/listing-card";
import { MarketplaceRetry } from "@/components/marketplace-retry";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { listingCategories } from "@/lib/categories";
import { getFormSchema, matchCategoryByName, resolveFormKey, topCategories, type CategoryNode, type FieldDef } from "@/lib/category-tree";
import { NUM_RANGE_FILTERS } from "@/lib/filter-fields";
import { commissionAmount, money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { responsiveGrid, useIsWideWeb } from "@/lib/layout";
import { searchKey } from "@/lib/locale";
import { scoreListing } from "@/lib/search";
import { useSavedSearches, type SavedFilters, type SavedSearch } from "@/lib/saved-searches";
import { LocationSelector, type LocationValue } from "@/components/location-selector";
import { districtsOfProvince, getDistrict, getProvince, locKey, provinces } from "@/lib/locations";
import { searchListings } from "@/lib/supabase-data";
import { displayText } from "@/lib/text";
import type { Listing, User } from "@/lib/types";
import { useStore } from "@/lib/use-store";

type FeedFilter = "all" | "open" | "hot" | "new" | "commission";
type SortMode = "recommended" | "priceAsc" | "priceDesc" | "commission" | "new";

// Kategori-filtre sayısal aralık alanları (m²/km/yıl) — paylaşılan tek kaynak.
const EXPLORE_NUM_FILTERS = NUM_RANGE_FILTERS;
function collectDescendantLabels(node: CategoryNode): string[] {
  const out: string[] = [node.label];
  for (const c of node.children ?? []) out.push(...collectDescendantLabels(c));
  return out;
}
// Kategori-özel facet/sayısal filtreleri URL param'ından güvenle çöz (derin-link/kayıt).
function parseAttrParam(raw: string): Record<string, string[]> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return {};
    const out: Record<string, string[]> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) if (Array.isArray(v) && v.length) out[k] = v.map(String);
    return out;
  } catch { return {}; }
}
function parseNumParam(raw: string): Record<string, { min: string; max: string }> {
  if (!raw) return {};
  try {
    const o = JSON.parse(raw) as unknown;
    if (!o || typeof o !== "object") return {};
    const out: Record<string, { min: string; max: string }> = {};
    for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
      if (v && typeof v === "object") {
        const min = String((v as { min?: unknown }).min ?? "");
        const max = String((v as { max?: unknown }).max ?? "");
        if (min || max) out[k] = { min, max };
      }
    }
    return out;
  } catch { return {}; }
}
const SORT_LABELS: Record<SortMode, string> = {
  recommended: "Önerilen",
  priceAsc: "En düşük fiyat",
  priceDesc: "En yüksek fiyat",
  commission: "En yüksek komisyon",
  new: "En yeni"
};
const SORT_ORDER: SortMode[] = ["recommended", "priceAsc", "priceDesc", "commission", "new"];
const INITIAL_EXPLORE_ITEMS = 20;
const EXPLORE_PAGE_SIZE = 16;

type ExploreMedia = {
  id: string;
  index: number;
  poster: string;
  type: "image" | "video";
  uri: string;
  listing: Listing;
};

export default function ExploreScreen() {
  const { language, t } = useLanguage();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string; province?: string; district?: string; price?: string; comm?: string; stock?: string; verified?: string; open?: string; sort?: string; cat?: string; city?: string; tab?: string; attr?: string; num?: string }>();
  // Param değeri string | string[] gelebilir; tek değere indir.
  const sp = (v?: string | string[]) => (Array.isArray(v) ? v[0] ?? "" : v ?? "");
  const { findUser, listings, loadMoreMarketplace, marketplaceHasMore, marketplaceLoadingMore, marketplaceLoadFailed, retryMarketplace } = useStore();
  const { items: savedSearches, add: addSaved, remove: removeSaved } = useSavedSearches();
  const [refreshing, setRefreshing] = useState(false);
  const [seed, setSeed] = useState(1);
  // Filtre başlangıç durumu URL param'ından okunur → derin-linklenebilir/paylaşılabilir
  // filtreli sayfa (SEO). Değişince aşağıdaki senkron effect'i URL'e geri yazar.
  const [filter, setFilter] = useState<FeedFilter>(() => (["all", "commission", "open", "hot", "new"].includes(sp(params.tab)) ? (sp(params.tab) as FeedFilter) : "all"));
  const provinceId = useMemo(() => provinces.find((p) => p.slug === params.province)?.id, [params.province]);
  const districtId = useMemo(() => districtsOfProvince(provinceId).find((d) => d.slug === params.district)?.id, [provinceId, params.district]);
  const [city, setCity] = useState(() => sp(params.city)); // mobile-only exact city filter
  const [minCommission, setMinCommission] = useState(() => Number(sp(params.comm)) || 0);
  const [priceRange, setPriceRange] = useState(() => sp(params.price));
  const [stockFilter, setStockFilter] = useState(() => (sp(params.stock) === "in" || sp(params.stock) === "low" ? sp(params.stock) : ""));
  // Kategori-özel filtre: üst kategori seç → şemasından facet (Yakıt/Isıtma…) +
  // sayısal aralık (m²/km/yıl) filtreleri gelir. /kategori/[slug] ile aynı motor.
  // Çok seviyeli kategori yolu (Emlak > Konut > Satılık > Daire …), node key dizisi.
  const [catPath, setCatPath] = useState<string[]>(() => (sp(params.cat) ? sp(params.cat).split(">").filter(Boolean) : []));
  const [attrFilters, setAttrFilters] = useState<Record<string, string[]>>(() => parseAttrParam(sp(params.attr)));
  const [numRange, setNumRange] = useState<Record<string, { min: string; max: string }>>(() => parseNumParam(sp(params.num)));
  const [statusOpen, setStatusOpen] = useState(() => sp(params.open) === "1");
  const [showMobileFilters, setShowMobileFilters] = useState(false); // mobilde filtre panelini aç/kapat
  const [sortMode, setSortMode] = useState<SortMode>(() => (["priceAsc", "priceDesc", "commission", "new"].includes(sp(params.sort)) ? (sp(params.sort) as SortMode) : "recommended"));
  const [onlyVerified, setOnlyVerified] = useState(() => sp(params.verified) === "1");
  const [productVisible, setProductVisible] = useState(20);
  const [visibleCount, setVisibleCount] = useState(INITIAL_EXPLORE_ITEMS);
  // Sunucu-tarafli arama: q girilince tum katalogda arar (yuklu 90 ile sinirli
  // degil). Bos q -> null (mevcut istemci davranisi).
  const [serverResults, setServerResults] = useState<Listing[] | null>(null);
  const [serverOwners, setServerOwners] = useState<Record<string, User>>({});
  const [serverOffset, setServerOffset] = useState(0);
  const [serverHasMore, setServerHasMore] = useState(false);
  const [serverLoading, setServerLoading] = useState(false);
  const SERVER_PAGE = 40;
  const queryText = (params.q ?? "").trim();

  useEffect(() => {
    let alive = true;
    // Tek harf/boş sorguda sunucuya gitme; serverResults=null → istemci yüklü katalogda
    // arar (anlamsız tek-harf DB taraması ve gereksiz yük önlenir).
    if (queryText.length < 2) { setServerResults(null); setServerOwners({}); setServerOffset(0); setServerHasMore(false); return; }
    setServerLoading(true);
    const priceParts = priceRange ? priceRange.split("-") : [];
    const minPrice = priceParts[0] ? Number(priceParts[0]) : undefined;
    const maxPrice = priceParts[1] ? Number(priceParts[1]) : undefined;
    const sort = sortMode === "priceAsc" || sortMode === "priceDesc" || sortMode === "commission" || sortMode === "new" ? sortMode : "new";
    const handle = setTimeout(() => {
      void searchListings({ q: queryText, minPrice, maxPrice, openOnly: statusOpen, sort, offset: 0, limit: SERVER_PAGE }).then((res) => {
        if (!alive) return;
        setServerLoading(false);
        // Sunucu ilike Türkçe-katlama yapmaz ("sarj"≠"şarj") ve typo'da 0 döner. Sunucu
        // BOŞ/HATA dönerse serverResults=null bırak → baseListings yüklü kataloğa düşer,
        // istemci searchKey (fold) + fuzzy skorlamasıyla arar. Böylece "sonuç yok"a düşmez.
        if (!res || res.listings.length === 0) { setServerResults(null); setServerHasMore(false); return; }
        setServerResults(res.listings);
        setServerOwners(Object.fromEntries(res.users.map((u) => [u.id, u])));
        setServerOffset(res.listings.length);
        setServerHasMore(res.listings.length >= SERVER_PAGE);
      });
    }, 280);
    return () => { alive = false; clearTimeout(handle); };
  }, [queryText, priceRange, statusOpen, sortMode]);

  const loadMoreServer = () => {
    if (!queryText || serverLoading || !serverHasMore) return;
    setServerLoading(true);
    const priceParts = priceRange ? priceRange.split("-") : [];
    const minPrice = priceParts[0] ? Number(priceParts[0]) : undefined;
    const maxPrice = priceParts[1] ? Number(priceParts[1]) : undefined;
    const sort = sortMode === "priceAsc" || sortMode === "priceDesc" || sortMode === "commission" || sortMode === "new" ? sortMode : "new";
    void searchListings({ q: queryText, minPrice, maxPrice, openOnly: statusOpen, sort, offset: serverOffset, limit: SERVER_PAGE }).then((res) => {
      setServerLoading(false);
      if (!res) { setServerHasMore(false); return; }
      setServerOffset((o) => o + res.listings.length);
      if (res.listings.length < SERVER_PAGE) setServerHasMore(false);
      setServerOwners((prev) => ({ ...prev, ...Object.fromEntries(res.users.map((u) => [u.id, u])) }));
      setServerResults((prev) => {
        const seen = new Set((prev ?? []).map((l) => l.id));
        const fresh = res.listings.filter((l) => !seen.has(l.id));
        return [...(prev ?? []), ...fresh];
      });
    });
  };
  const resolveOwner = (id: string) => serverOwners[id] ?? findUser(id);
  const feedFilters: Array<{ key: FeedFilter; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
    { key: "all", label: t("all"), icon: "grid" },
    { key: "commission", label: translateCopy("Yüksek komisyon", language), icon: "cash-plus" },
    { key: "open", label: t("instantPartner"), icon: "flash" },
    { key: "hot", label: t("trend"), icon: "fire" },
    { key: "new", label: t("newest"), icon: "clock-outline" }
  ];
  const isWideWeb = useIsWideWeb();
  // Hidrasyon güvenliği: SSG'de genişlik bilinmez → isWideWeb dalı sunucu/istemci
  // arasında uyuşmayıp React #418 üretiyordu. Mount'a kadar deterministik kabuk
  // göster (home ile aynı desen), sonra gerçek düzene geç.
  const [mountedGate, setMountedGate] = useState(false);
  useEffect(() => { setMountedGate(true); }, []);
  // tokens memoize edilir: activeListings useMemo bağımlılığı; her render'da yeni dizi
  // kimliği memo'yu geçersizleştirip ağır scoreListing'i tekrar koşturuyordu.
  const tokens = useMemo(() => searchKey(params.q ?? "").split(" ").filter(Boolean), [params.q]);
  // Mobilde temiz 2-sütun ürün-kartı grid'i (görsel üstte + okunur beyaz metin altta);
  // masaüstü zaten ListingCard kullanır. Sıkışık overlay-reel yerine premium kart.
  const gap = isWideWeb ? 12 : 10;
  const padding = isWideWeb ? 20 : 12;
  const panelWidth = 260;
  // İçerik standart 1280 genişlikte ortalanır; grid hesabı da bu genişliğe göre.
  const contentW = Math.min(width, 1280);
  const gridArea = isWideWeb ? contentW - padding * 2 - panelWidth - 20 : contentW - padding * 2;
  const grid = responsiveGrid({ available: gridArea, gap, minCardWidth: isWideWeb ? 205 : 158, maxColumns: isWideWeb ? 4 : 2 });
  const columns = grid.columns;
  const tileSize = grid.cardWidth;
  // Kart yüksekliği: kare görsel (tileSize) + okunur metin bölümü (~112px).
  const tileHeight = tileSize + 112;

  const marketplaceListings = useMemo(() => {
    const visible = listings.filter((listing) => listing.status !== "draft" && listing.status !== "rejected" && listing.status !== "sold");
    return visible.length ? visible : listings;
  }, [listings]);

  const cities = useMemo(() => Array.from(new Set(marketplaceListings.map((l) => l.location))).sort((a, b) => a.localeCompare(b, "tr")), [marketplaceListings]);
  const provinceName = useMemo(() => (provinceId != null ? getProvince(provinceId)?.name : undefined), [provinceId]);
  const districtName = useMemo(() => (districtId != null ? getDistrict(districtId)?.name : undefined), [districtId]);
  // Seçili kategori düğümü + şeması + filtre alanları (facet/sayısal) + eşleşme etiketleri.
  // catPath'i düğüm zincirine çöz (üstten aşağı). Etkin düğüm = en derin seçili.
  const pathNodes = useMemo(() => {
    const out: CategoryNode[] = [];
    let level = topCategories();
    for (const key of catPath) {
      const found = level.find((n) => n.key === key);
      if (!found) break;
      out.push(found);
      level = found.children ?? [];
    }
    return out;
  }, [catPath]);
  const catNode = pathNodes[pathNodes.length - 1];
  // Mevcut seviyede inilebilecek alt düğümler (drill seçenekleri).
  const drillOptions = catNode?.children ?? [];
  const catSchema = useMemo(() => (catNode ? getFormSchema(resolveFormKey([catNode])) : undefined), [catNode]);
  const catFacets = useMemo<FieldDef[]>(() => (catSchema ? catSchema.fields.filter((f) => {
    const n = f.options?.length ?? 0;
    if (f.key === "seller") return false;
    if (f.key === "brand" && f.type === "select" && n > 16) return false; // marka ayrı aranabilir filtreye
    // Büyük listeler (İç Özellikler 46, CAR_COLORS…) artık düşmüyor: 12+ seçenekli facet
    // aranabilir/kaydırılabilir kutuda render edilir. Üst sınır 80.
    if (f.type === "select") return n >= 2 && n <= 80;
    if (f.type === "multiselect") return n >= 2 && n <= 80;
    return false;
  }) : []), [catSchema]);
  // Aranabilir bağımsız marka filtresi: seçenek sayısı facet sınırını (16) aşan
  // marka alanları (CAR_BRANDS ~74, PHONE_BRANDS 22…) chip-facet olarak sığmaz.
  const catBrandField = useMemo<FieldDef | undefined>(() => (catSchema ? catSchema.fields.find((f) => f.key === "brand" && f.type === "select" && (f.options?.length ?? 0) > 16) : undefined), [catSchema]);
  const catNums = useMemo(() => {
    if (!catSchema) return [] as Array<{ key: string; label: string; suffix?: string }>;
    const keys = new Set(catSchema.fields.map((f) => f.key));
    const seen = new Set<string>();
    return EXPLORE_NUM_FILTERS.filter((f) => keys.has(f.key) && !seen.has(f.label) && (seen.add(f.label), true));
  }, [catSchema]);
  const catLabelSet = useMemo(() => (catNode ? new Set(collectDescendantLabels(catNode).map((s) => s.toLocaleLowerCase("tr-TR").trim()).filter((s) => s.length > 2)) : null), [catNode]);
  // Üst kategori: seç/kaldır (tekrar basınca temizle). Alt seviyeye in / breadcrumb'a dön.
  const selectTop = (key: string) => { setCatPath((cur) => (cur.length === 1 && cur[0] === key ? [] : [key])); setAttrFilters({}); setNumRange({}); };
  const drillTo = (key: string) => { setCatPath((cur) => [...cur, key]); setAttrFilters({}); setNumRange({}); };
  const crumbTo = (i: number) => { setCatPath((cur) => cur.slice(0, i + 1)); setAttrFilters({}); setNumRange({}); };
  const toggleAttr = (key: string, val: string) => setAttrFilters((s) => { const cur = s[key] ?? []; const next = cur.includes(val) ? cur.filter((x) => x !== val) : [...cur, val]; const copy = { ...s }; if (next.length) copy[key] = next; else delete copy[key]; return copy; });
  const setNum = (key: string, side: "min" | "max", v: string) => setNumRange((s) => ({ ...s, [key]: { min: s[key]?.min ?? "", max: s[key]?.max ?? "", [side]: v } }));
  const clearCatFilter = () => { setCatPath([]); setAttrFilters({}); setNumRange({}); };
  const clearAllFilters = () => { setPriceRange(""); setMinCommission(0); router.setParams({ province: undefined, district: undefined }); setStockFilter(""); setStatusOpen(false); setOnlyVerified(false); setFilter("all"); setCity(""); setSortMode("recommended"); clearCatFilter(); };

  // Kayıtlı arama: o anki filtre kümesini yakala + tıklanınca geri yükle.
  const currentFilters = (): SavedFilters => {
    const f: SavedFilters = {};
    if (priceRange) f.price = priceRange;
    if (minCommission) f.comm = minCommission;
    if (catPath.length) f.cat = catPath.join(">");
    if (city) f.city = city;
    if (statusOpen) f.open = true;
    if (stockFilter) f.stock = stockFilter;
    if (sortMode && sortMode !== "recommended") f.sort = sortMode;
    if (Object.keys(attrFilters).length) f.attr = attrFilters;
    if (Object.keys(numRange).length) f.num = numRange;
    return f;
  };
  const hasSaveableFilter = Boolean(priceRange) || minCommission > 0 || catPath.length > 0 || Boolean(city) || statusOpen || Boolean(stockFilter) || sortMode !== "recommended" || Object.keys(attrFilters).length > 0 || Object.keys(numRange).length > 0;
  // Sunucuya GÖNDERİLMEYEN (yalnızca istemcide uygulanan) filtreler. Bunlar aktifken
  // sunucu-sayfalama güvenilmez (getirilen sayfa tümden elenebilir) → "daha fazla yükle"
  // ölü görünür. Bu durumda sunucu-sayfalama butonu gizlenip ipucu gösterilir.
  const clientOnlyActive = minCommission > 0 || catPath.length > 0 || Boolean(stockFilter) || onlyVerified || Object.keys(attrFilters).length > 0 || Object.keys(numRange).length > 0;
  const isCurrentSaved = savedSearches.some((s) => (s.q ?? "").toLocaleLowerCase("tr-TR") === queryText.toLocaleLowerCase("tr-TR") && JSON.stringify(s.f ?? {}) === JSON.stringify(currentFilters()));
  const applySaved = (s: SavedSearch) => {
    const f = s.f ?? {};
    setPriceRange(typeof f.price === "string" ? f.price : "");
    setMinCommission(typeof f.comm === "number" ? f.comm : 0);
    setCatPath(typeof f.cat === "string" ? f.cat.split(">").filter(Boolean) : []);
    setCity(typeof f.city === "string" ? f.city : "");
    setStatusOpen(f.open === true);
    setStockFilter(typeof f.stock === "string" ? f.stock : "");
    setSortMode(typeof f.sort === "string" ? (f.sort as SortMode) : "recommended");
    setAttrFilters(f.attr && typeof f.attr === "object" ? f.attr : {});
    setNumRange(f.num && typeof f.num === "object" ? f.num : {});
    router.setParams({ q: s.q || undefined });
  };

  const hasPanelFilter = provinceId != null || Boolean(city) || minCommission > 0 || statusOpen || Boolean(priceRange) || Boolean(stockFilter) || onlyVerified || catPath.length > 0;

  // Aktif filtre çipleri: seçili her filtre için tek-tek kaldırılabilir rozet (× ile).
  // Kullanıcı hangi filtrelerin açık olduğunu görür ve tek tıkla kaldırır.
  const activeChips: Array<{ key: string; label: string; onRemove: () => void }> = [];
  if (provinceId != null) activeChips.push({ key: "prov", label: getProvince(provinceId)?.name ?? "İl", onRemove: () => router.setParams({ province: undefined, district: undefined }) });
  if (districtId != null) activeChips.push({ key: "dist", label: getDistrict(districtId)?.name ?? "İlçe", onRemove: () => router.setParams({ district: undefined }) });
  if (city) activeChips.push({ key: "city", label: city, onRemove: () => setCity("") });
  if (priceRange) { const [mn, mx] = priceRange.split("-"); activeChips.push({ key: "price", label: `₺${mn || "0"} – ${mx || "∞"}`, onRemove: () => setPriceRange("") }); }
  if (minCommission > 0) activeChips.push({ key: "comm", label: `Komisyon ₺${minCommission}+`, onRemove: () => setMinCommission(0) });
  if (stockFilter) activeChips.push({ key: "stock", label: stockFilter === "in" ? "Stokta var" : "Az stok", onRemove: () => setStockFilter("") });
  if (onlyVerified) activeChips.push({ key: "ver", label: "Onaylı satıcı", onRemove: () => setOnlyVerified(false) });
  if (statusOpen) activeChips.push({ key: "open", label: "Ortak satışa açık", onRemove: () => setStatusOpen(false) });
  if (catPath.length) activeChips.push({ key: "cat", label: catPath[catPath.length - 1], onRemove: clearCatFilter });
  if (sortMode !== "recommended") activeChips.push({ key: "sort", label: `Sırala: ${SORT_LABELS[sortMode]}`, onRemove: () => setSortMode("recommended") });
  // Kategori-özel facet (Yakıt=Dizel…) + sayısal aralık (Km 0–100000) seçimleri de
  // kaldırılabilir çip olarak görünsün (eskiden yalnız panelde vardı, geri alması zordu).
  for (const [key, vals] of Object.entries(attrFilters)) {
    for (const v of vals) activeChips.push({ key: `attr-${key}-${v}`, label: v, onRemove: () => toggleAttr(key, v) });
  }
  for (const [key, r] of Object.entries(numRange)) {
    if (r?.min?.trim() || r?.max?.trim()) {
      const nf = EXPLORE_NUM_FILTERS.find((f) => f.key === key);
      activeChips.push({ key: `num-${key}`, label: `${translateCopy(nf?.label ?? key, language)}: ${r.min || "0"}–${r.max || "∞"}`, onRemove: () => setNumRange((s) => { const c = { ...s }; delete c[key]; return c; }) });
    }
  }

  // q girildiyse temel set sunucu sonuclari (tum katalog); degilse yuklu katalog.
  const baseListings = serverResults ?? marketplaceListings;

  const activeListings = useMemo(() => {
    const provKey = provinceName ? locKey(provinceName) : "";
    const distKey = districtName ? locKey(districtName) : "";
    const nonText = baseListings.filter((listing) => {
      if (city && listing.location !== city) return false;
      // Yapısal id varsa kesin eşleşme; yoksa (eski ilan) serbest metne düş.
      // Alt-metin eşleştirmesi tek başına yanıltıcıydı (ör. "Van" ⊂ başka metinler).
      if (provinceId != null) {
        if (listing.provinceId != null) {
          if (listing.provinceId !== provinceId) return false;
        } else if (provKey && !locKey(listing.location).includes(provKey)) return false;
      }
      if (districtId != null) {
        if (listing.districtId != null) {
          if (listing.districtId !== districtId) return false;
        } else if (distKey && !locKey(listing.location).includes(distKey)) return false;
      }
      if (minCommission > 0 && commissionAmount(listing) < minCommission) return false;
      if (priceRange) {
        const [mn, mx] = priceRange.split("-");
        let min = Number(mn) || 0;
        let max = mx ? Number(mx) : Infinity;
        // URL/derin-link ile ters aralık (min>max) gelebilir → sonuç boş kalmasın, takas et.
        if (Number.isFinite(max) && min > max) { const t = min; min = max; max = t; }
        if (listing.price < min || listing.price > max) return false;
      }
      if (stockFilter === "in" && listing.stockCount <= 0) return false;
      if (stockFilter === "low" && (listing.stockCount > 5 || listing.stockCount <= 0)) return false;
      if (statusOpen && listing.partnershipMode !== "open") return false;
      if (filter === "open" && listing.partnershipMode !== "open") return false;
      if (filter === "hot" && listing.leadCount + listing.favoriteCount < 50) return false;
      if (filter === "new" && !isNewListing(listing.createdAt)) return false;
      // Kategori-özel filtre: seçili kategori + facet (attribute) + sayısal aralık.
      if (catLabelSet) {
        // Kesin (tam) eşleşme: alt-metin eşleşmesi kategoriler arası sızıntı yapıyordu
        // (ör. Vasıta alt "Yat" ⊂ "Yatak" → mobilya, araç filtresine düşüyordu).
        const nc = listing.category.toLocaleLowerCase("tr-TR").trim();
        const leaf = String(listing.attributes?._leaf ?? "").toLocaleLowerCase("tr-TR").trim();
        // Eski/bileşik kategori ("Konut - Satılık") → ayraçla böl, TAM segment eşleşmesi
        // dene (kelime-tam, alt-metin değil → sızıntı yok).
        const segs = nc.split(/\s*[-/>·|]\s*/).map((s) => s.trim()).filter((s) => s.length > 2);
        const catMatch = catLabelSet.has(nc) || (!!leaf && catLabelSet.has(leaf)) || (segs.length > 1 && segs.some((s) => catLabelSet.has(s)));
        if (!catMatch) return false;
      }
      for (const key of Object.keys(attrFilters)) {
        const want = attrFilters[key];
        const have = listing.attributes?.[key];
        const ok = Array.isArray(have) ? have.some((v) => want.includes(String(v))) : want.includes(String(have ?? ""));
        if (!ok) return false;
      }
      for (const nf of catNums) {
        const r = numRange[nf.key];
        const mn = r?.min?.trim() ? Number(r.min) : null;
        const mx = r?.max?.trim() ? Number(r.max) : null;
        if (mn === null && mx === null) continue;
        // Özellik değeri yoksa aralık filtresi bu ilanı eler; ama değer=0 (ör. km=0
        // sıfır araç, yeni m²) geçerlidir — "yok" ile "0"ı karıştırma.
        const raw = listing.attributes?.[nf.key] ?? (nf.key === "grossM2" ? listing.attributes?.m2 : undefined);
        if (raw === undefined || raw === null || raw === "") return false;
        const val = Number(raw);
        if (!Number.isFinite(val)) return false;
        if (mn !== null && val < mn) return false;
        if (mx !== null && val > mx) return false;
      }
      // Yalnızca onaylı satıcı: activeListings'e taşındı ki mobil feed de (media tiles)
      // bu filtreyi uygulasın (önceden yalnız masaüstü productListings'te vardı).
      if (onlyVerified) {
        const owner = findUser(listing.ownerId);
        if (!(owner?.verifiedPhone || owner?.verifiedIdentity)) return false;
      }
      return true;
    });

    // Metin sorgusu varsa: fuzzy (yazım-hata toleranslı) skorla, ALAKA sırasına diz.
    const filtered =
      tokens.length > 0
        ? nonText
            .map((l) => ({ l, s: scoreListing(l, findUser(l.ownerId)?.name, tokens) }))
            .filter((x) => x.s > 0)
            .sort((a, b) => b.s - a.s || Number(Boolean(b.l.featured)) - Number(Boolean(a.l.featured)))
            .map((x) => x.l)
        : nonText.sort((a, b) => (Number(Boolean(b.featured)) - Number(Boolean(a.featured))) || (filter === "commission" ? commissionAmount(b) - commissionAmount(a) : exploreScore(b, seed) - exploreScore(a, seed)));

    if (filtered.length || tokens.length > 0 || filter !== "all" || hasPanelFilter) return filtered;
    return baseListings.slice().sort((a, b) => exploreScore(b, seed) - exploreScore(a, seed));
  }, [baseListings, city, districtName, filter, findUser, hasPanelFilter, minCommission, onlyVerified, priceRange, provinceName, seed, statusOpen, stockFilter, tokens, catLabelSet, attrFilters, catNums, numRange]);

  const productListings = useMemo(() => {
    // onlyVerified artık activeListings'te uygulanıyor (mobil feed de kapsasın diye);
    // burada tekrar süzmeye gerek yok — yalnızca sıralama.
    const sorted = activeListings.slice();
    if (sortMode === "priceAsc") sorted.sort((a, b) => a.price - b.price);
    else if (sortMode === "priceDesc") sorted.sort((a, b) => b.price - a.price);
    else if (sortMode === "commission") sorted.sort((a, b) => commissionAmount(b) - commissionAmount(a));
    else if (sortMode === "new") sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [activeListings, sortMode]);
  // "Yeni eklenen" = en yeni ilanlar (gerçek). Önceden en-az-stoklu 3 ilan sahte
  // "fırsat/geri sayım/son X stok" aciliyetiyle sunuluyordu — kaldırıldı.
  const dealListings = useMemo(() => activeListings.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3), [activeListings]);
  const topCommissionListings = useMemo(() => activeListings.slice().sort((a, b) => commissionAmount(b) - commissionAmount(a)).slice(0, 3), [activeListings]);
  const sidebarWidth = 320;
  const productArea = width - padding * 2 - sidebarWidth - 24;
  const productGrid = responsiveGrid({ available: productArea, gap: 16, minCardWidth: 200, maxColumns: 5 });

  // Mobil medya-feed'i de sıralamaya (sortMode) uysun: kaynağı önce sırala, sonra
  // media öğelerine aç. "recommended" → activeListings'in mevcut (alaka/öne çıkan) düzeni.
  const mediaSourceListings = useMemo(() => {
    const arr = activeListings.slice();
    if (sortMode === "priceAsc") arr.sort((a, b) => a.price - b.price);
    else if (sortMode === "priceDesc") arr.sort((a, b) => b.price - a.price);
    else if (sortMode === "commission") arr.sort((a, b) => commissionAmount(b) - commissionAmount(a));
    else if (sortMode === "new") arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return arr;
  }, [activeListings, sortMode]);

  const mediaItems = useMemo(() => {
    return mediaSourceListings.flatMap((listing) => {
      const media = [listing.image, ...(listing.adAssets ?? [])]
        .map((item) => item?.trim())
        .filter((item): item is string => Boolean(item));

      const uniqueMedia = Array.from(new Set(media));
      return uniqueMedia.map((uri, index) => ({
        id: `${listing.id}-media-${index}`,
        index,
        poster: listing.image,
        type: (isVideoUri(uri) ? "video" : "image") as ExploreMedia["type"],
        uri,
        listing
      }));
    });
  }, [mediaSourceListings]);

  const visibleMediaItems = mediaItems.slice(0, visibleCount);
  const rows = useMemo(() => chunk(visibleMediaItems, columns), [visibleMediaItems, columns]);
  const videoCount = mediaItems.filter((item) => item.type === "video").length;
  const openCount = activeListings.filter((listing) => listing.partnershipMode === "open").length;

  useEffect(() => {
    setVisibleCount(INITIAL_EXPLORE_ITEMS);
    setProductVisible(20);
    // Kategori-özel filtreler (catPath/attrFilters/numRange) de sayacı sıfırlamalı;
    // yoksa daraltılan sonuç kümesinde eski "daha fazla göster" sayacı takılı kalıyordu.
  }, [filter, params.q, city, minCommission, statusOpen, sortMode, onlyVerified, priceRange, stockFilter, catPath, attrFilters, numRange, provinceId, districtId]);

  function refresh() {
    setRefreshing(true);
    setSeed((value) => value + 1);
    setVisibleCount(INITIAL_EXPLORE_ITEMS);
    setTimeout(() => setRefreshing(false), 420);
  }

  // Filtre durumunu URL'e yaz → paylaşılabilir/derin-linklenebilir filtreli sayfa (SEO).
  // setParams mevcut param'larla birleşir (q/province/district korunur); undefined =
  // param'ı kaldır. Bağımlılık yalnızca filtre state'i → setParams'ın yol açtığı
  // yeniden-render effect'i TEKRAR tetiklemez (döngü olmaz; başlangıç state param'dan gelir).
  useEffect(() => {
    router.setParams({
      price: priceRange || undefined,
      comm: minCommission > 0 ? String(minCommission) : undefined,
      stock: stockFilter || undefined,
      verified: onlyVerified ? "1" : undefined,
      open: statusOpen ? "1" : undefined,
      sort: sortMode !== "recommended" ? sortMode : undefined,
      cat: catPath.length ? catPath.join(">") : undefined,
      city: city || undefined,
      tab: filter !== "all" ? filter : undefined,
      // Kategori-özel filtreler de URL'e → "Otomobil, Dizel, 2018+" paylaşılabilir/derin-linklenebilir.
      attr: Object.keys(attrFilters).length ? JSON.stringify(attrFilters) : undefined,
      num: Object.keys(numRange).length ? JSON.stringify(numRange) : undefined
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [priceRange, minCommission, stockFilter, onlyVerified, statusOpen, sortMode, catPath, city, filter, attrFilters, numRange]);

  // KENAR-tetiklemeli: her scroll karesinde değil, dibe her yaklaşımda bir kez.
  const exploreLoadArmed = useRef(true);
  function loadMoreIfNeeded(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceToBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceToBottom > 820) exploreLoadArmed.current = true;
    if (distanceToBottom < 520 && exploreLoadArmed.current) {
      exploreLoadArmed.current = false;
      setVisibleCount((current) => {
        const next = Math.min(mediaItems.length, current + EXPLORE_PAGE_SIZE);
        // Yüklü medya bitmeye yakınsa sonraki sayfayı çek (arama -> sunucu araması,
        // aksi halde katalog sayfasi).
        if (next >= mediaItems.length) {
          if (queryText && serverHasMore) loadMoreServer();
          else if (!queryText && marketplaceHasMore) loadMoreMarketplace();
        }
        return next;
      });
    }
  }

  // Kategoriye göre dinamik filtre — hem masaüstü (ürün-kartı) hem mobil (medya-feed)
  // düzeninde HER ZAMAN görünür. Üst kategori seç → şemasından sayısal aralık
  // (m²/km/yıl) + facet (Yakıt/Vites/Isıtma…) filtreleri gelir.
  const renderCatFilter = () => (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 10, marginBottom: 12, marginHorizontal: isWideWeb ? 0 : padding, padding: 14 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="tune-variant" size={16} color={colors.primaryDark} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "900" }}>{translateCopy("Kategoriye göre filtrele", language)}</Text>
        {catPath.length > 0 ? <Pressable onPress={clearCatFilter} hitSlop={8}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: "900" }}>{translateCopy("Temizle", language)}</Text></Pressable> : null}
      </View>
      {/* Breadcrumb: Tümü > Emlak > Konut > … (tıklayınca o seviyeye dön) */}
      {pathNodes.length > 0 ? (
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          <Pressable onPress={clearCatFilter} hitSlop={6}><Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Tümü", language)}</Text></Pressable>
          {pathNodes.map((n, i) => (
            <View key={n.key} style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
              <MaterialCommunityIcons name="chevron-right" size={14} color={colors.subtle} />
              <Pressable onPress={() => crumbTo(i)} hitSlop={6}><Text style={{ color: i === pathNodes.length - 1 ? colors.primaryDark : colors.muted, fontSize: 12, fontWeight: i === pathNodes.length - 1 ? "900" : "800" }}>{translateCopy(n.label, language)}</Text></Pressable>
            </View>
          ))}
        </View>
      ) : null}
      {/* Seçilebilir seviye: yol boşsa ana kategoriler, değilse mevcut düğümün altları */}
      {(catPath.length === 0 || drillOptions.length > 0) ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>
          {(catPath.length === 0 ? topCategories() : drillOptions).map((n) => {
            const on = catPath.length === 0 && catNode?.key === n.key;
            const drilled = catPath.length > 0;
            return (
              <Pressable key={n.key} onPress={() => (drilled ? drillTo(n.key) : selectTop(n.key))} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 4, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{translateCopy(n.label, language)}</Text>
                {(n.children?.length ?? 0) > 0 ? <MaterialCommunityIcons name="chevron-right" size={13} color={on ? "#FFFFFF" : colors.subtle} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
      {catPath.length > 0 ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {catBrandField ? (
            <BrandFilter
              label={catBrandField.label}
              options={catBrandField.options ?? []}
              selected={attrFilters.brand ?? []}
              onToggle={(b) => toggleAttr("brand", b)}
              language={language}
            />
          ) : null}
          {catNums.map((nf) => (
            <View key={nf.key} style={{ gap: 4, minWidth: 160 }}>
              <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>{translateCopy(nf.label, language)}{nf.suffix ? ` (${nf.suffix})` : ""}</Text>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                <TextInput value={numRange[nf.key]?.min ?? ""} onChangeText={(v) => setNum(nf.key, "min", v)} keyboardType="numeric" placeholder={translateCopy("En az", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 9, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 13, minHeight: 38, paddingHorizontal: 9 }} />
                <Text style={{ color: colors.muted }}>—</Text>
                <TextInput value={numRange[nf.key]?.max ?? ""} onChangeText={(v) => setNum(nf.key, "max", v)} keyboardType="numeric" placeholder={translateCopy("En çok", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 9, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 13, minHeight: 38, paddingHorizontal: 9 }} />
              </View>
            </View>
          ))}
          {catFacets.map((f) => {
            const opts = f.options ?? [];
            const selected = attrFilters[f.key] ?? [];
            // Çok seçenekli facet (İç Özellikler, Muhit, renk…) → aranabilir/kaydırılabilir
            // kutu (BrandFilter deseni); azsa tüm seçenekler çip olarak (artık KIRPILMIYOR).
            if (opts.length > 12) {
              return <BrandFilter key={f.key} label={f.label} options={opts} selected={selected} onToggle={(v) => toggleAttr(f.key, v)} language={language} />;
            }
            return (
              <View key={f.key} style={{ gap: 4, minWidth: 160 }}>
                <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>{translateCopy(f.label, language)}{selected.length ? ` · ${selected.length}` : ""}</Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
                  {opts.map((opt) => {
                    const on = selected.includes(opt);
                    return (
                      <Pressable key={opt} onPress={() => toggleAttr(f.key, opt)} style={{ backgroundColor: on ? colors.primarySoft : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 }}>
                        <Text style={{ color: on ? colors.primaryDark : colors.ink, fontSize: 11, fontWeight: "800" }}>{translateCopy(opt, language)}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );

  // SSG + ilk istemci render'ı: genişlikten BAĞIMSIZ deterministik kabuk (temiz
  // hidrasyon). Mount sonrası (mountedGate) gerçek düzen render edilir.
  if (Platform.OS === "web" && !mountedGate) {
    return (
      <ScrollView contentContainerStyle={{ backgroundColor: colors.background, gap: 12, padding: 16 }} style={{ backgroundColor: colors.background }}>
        <View style={{ backgroundColor: colors.primarySoft, borderRadius: 18, height: 150 }} />
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <View key={i} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, height: 230, width: 200 }} />
          ))}
        </View>
      </ScrollView>
    );
  }

  if (isWideWeb) {
    const pills: Array<{ key: FeedFilter | "near"; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
      { key: "all", label: translateCopy("Tümü", language), icon: "grid" },
      { key: "hot", label: translateCopy("Trend", language), icon: "fire" },
      { key: "new", label: translateCopy("Yeni", language), icon: "clock-outline" },
      { key: "commission", label: translateCopy("En Yüksek Komisyon", language), icon: "cash-plus" },
      { key: "open", label: translateCopy("Anında ortak", language), icon: "flash" }
    ];
    const trust = [
      { icon: "shield-check" as const, label: translateCopy("Komisyon şartı kayıt altında", language) },
      { icon: "swap-horizontal" as const, label: translateCopy("Şeffaf & güvenilir süreç", language) },
      { icon: "message-text-outline" as const, label: translateCopy("Satıcıyla güvenli iletişim", language) },
      { icon: "account-check" as const, label: translateCopy("Doğrulanmış satıcılar", language) }
    ];
    const sortOrder: SortMode[] = ["recommended", "priceAsc", "priceDesc", "commission", "new"];
    const visibleProducts = productListings.slice(0, productVisible);

    const seoParts = [params.q, provinceName, districtName].filter(Boolean);
    const seoTitle = seoParts.length ? `${seoParts.join(" ")} ilanları — OrtakSat` : "İlanları Keşfet — OrtakSat";
    const seoDesc = seoParts.length
      ? `${seoParts.join(" ")} için ortak satış ilanları. Ürününü paylaş, satış yapabilecek ortaklarla eşleş.`
      : "Ortak satış ilanlarını keşfet. Ürününü paylaş, komisyonu birlikte belirle.";

    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 60 }}
        style={{ backgroundColor: colors.background }}
      >
        <Head>
          <title>{seoTitle}</title>
          <meta name="description" content={seoDesc} />
        </Head>
        <View style={{ alignSelf: "center", gap: 16, maxWidth: 1280, paddingHorizontal: padding, paddingTop: 16, width: "100%" }}>
        {/* Banner */}
        <View style={{ backgroundColor: colors.primarySoft, borderRadius: 20, flexDirection: "row", gap: 24, overflow: "hidden", paddingHorizontal: 28, paddingVertical: 26 }}>
          <View style={{ flex: 1.3, gap: 10, justifyContent: "center", minWidth: 0 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Keşfet, kazanmaya başla", language)}</Text>
            <Text style={{ color: colors.ink, fontSize: 28, fontWeight: "900", lineHeight: 34 }}>{translateCopy("Komisyonlu ilanları keşfet, ortak ol, kazan", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600", lineHeight: 22, maxWidth: 460 }}>{translateCopy("Kategorilere göz at, filtreleyin ve komisyonlu ilanlarla kolayca ortak olun.", language)}</Text>
          </View>
          <View style={{ flex: 1, gap: 10, justifyContent: "center", minWidth: 0 }}>
            {trust.map((item) => (
              <View key={item.label} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <MaterialCommunityIcons name={item.icon} size={18} color={colors.primary} />
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>{item.label}</Text>
              </View>
            ))}
          </View>
          <View style={{ alignItems: "center", justifyContent: "center", width: 140 }}>
            <View style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 999, height: 120, justifyContent: "center", width: 120 }}>
              <MaterialCommunityIcons name="magnify" size={64} color={colors.primary} />
            </View>
          </View>
        </View>

        {/* Filter pills + category buttons */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {pills.map((pill) => {
            const active = pill.key !== "near" && filter === pill.key;
            return (
              <Pressable
                key={pill.key}
                onPress={() => pill.key !== "near" && setFilter(pill.key)}
                style={{ alignItems: "center", backgroundColor: active ? colors.primary : colors.surface, borderColor: active ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}
              >
                <MaterialCommunityIcons name={pill.icon} size={15} color={active ? "#FFFFFF" : colors.primary} />
                <Text style={{ color: active ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "800" }}>{pill.label}</Text>
              </Pressable>
            );
          })}
          {listingCategories.slice(0, 6).map((category) => {
            // Hızlı kategori kısayolu: ağaçta gerçek düğüme çöz → gerçek kategori filtresi
            // (eskiden yalnız metin araması yapıyordu, chevron yanıltıcıydı).
            const match = matchCategoryByName(category.label);
            const on = match ? catPath[catPath.length - 1] === match.node.key : false;
            return (
              <Pressable
                key={category.key}
                onPress={() => { if (match) setCatPath(match.path.map((p) => p.key)); else router.setParams({ q: category.label }); }}
                style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 4, paddingHorizontal: 14, paddingVertical: 9 }}
              >
                <MaterialCommunityIcons name="tag-outline" size={14} color={on ? "#FFFFFF" : colors.primary} />
                <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "700" }}>{translateCopy(category.shortLabel, language)}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* Location filter */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 8, padding: 12, position: "relative", zIndex: 60 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
            <MaterialCommunityIcons name="map-marker-radius" size={17} color={colors.primary} />
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Konum", language)}</Text>
            {(provinceName || districtName) ? <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>· {[provinceName, districtName].filter(Boolean).join(" / ")}</Text> : null}
          </View>
          <View style={{ maxWidth: 520 }}>
            <LocationSelector
              mode="filter"
              showNeighborhood={false}
              value={{ provinceId, districtId }}
              onChange={(v) => router.setParams({ province: v.provinceId != null ? getProvince(v.provinceId)?.slug : undefined, district: v.districtId != null ? getDistrict(v.districtId)?.slug : undefined })}
            />
          </View>
        </View>

        {/* Toolbar */}
        <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 12, paddingVertical: 10, position: "relative", zIndex: 50 }}>
          <Pressable
            onPress={() => { setPriceRange(""); setMinCommission(0); router.setParams({ province: undefined, district: undefined }); setStockFilter(""); setStatusOpen(false); setOnlyVerified(false); setFilter("all"); setCity(""); setSortMode("recommended"); clearCatFilter(); }}
            style={{ alignItems: "center", backgroundColor: hasPanelFilter ? colors.primarySoft : colors.surfaceAlt, borderColor: hasPanelFilter ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <MaterialCommunityIcons name="filter-variant" size={15} color={colors.primaryDark} />
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{hasPanelFilter ? translateCopy("Filtreleri temizle", language) : translateCopy("Tüm Filtreler", language)}</Text>
          </Pressable>
          <PriceRangeFilter value={priceRange} onChange={setPriceRange} />
          <FilterDropdown label="Komisyon Oranı" value={minCommission} onSelect={(v) => setMinCommission(Number(v))} options={[
            { label: "Tümü", value: 0 },
            { label: "₺100+", value: 100 },
            { label: "₺250+", value: 250 },
            { label: "₺500+", value: 500 },
            { label: "₺1.000+", value: 1000 }
          ]} />
          <FilterDropdown label="Stok Durumu" value={stockFilter} onSelect={(v) => setStockFilter(String(v))} options={[
            { label: "Tümü", value: "" },
            { label: "Stokta var", value: "in" },
            { label: "Az stok", value: "low" }
          ]} />
          <Pressable onPress={() => setOnlyVerified((v) => !v)} style={{ alignItems: "center", flexDirection: "row", gap: 7, paddingHorizontal: 8 }}>
            <View style={{ alignItems: onlyVerified ? "flex-end" : "flex-start", backgroundColor: onlyVerified ? colors.primary : colors.line, borderRadius: 999, height: 22, justifyContent: "center", paddingHorizontal: 2, width: 38 }}>
              <View style={{ backgroundColor: "#FFFFFF", borderRadius: 999, height: 18, width: 18 }} />
            </View>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{translateCopy("Sadece onaylı satıcılar", language)}</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => setSortMode(sortOrder[(sortOrder.indexOf(sortMode) + 1) % sortOrder.length])}
            style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>{translateCopy("Sırala:", language)}</Text>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{translateCopy(SORT_LABELS[sortMode], language)}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color={colors.muted} />
          </Pressable>
        </View>

        {/* Main + sidebar */}
        <View style={{ flexDirection: "row", gap: 24, alignItems: "flex-start", position: "relative", zIndex: 1 }}>
          <View style={{ flex: 1, gap: 14, minWidth: 0 }}>
            {renderCatFilter()}
            <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{translateCopy("Öne çıkan ilanlar", language)}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{translateCopy("Sizin için seçilmiş en iyi ortaklık fırsatları", language)}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{productListings.length} {translateCopy("ilan bulundu", language)}</Text>
            </View>

            {/* Kayıtlı aramalar + arama kaydet */}
            {(queryText || hasSaveableFilter || savedSearches.length > 0) ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                {(queryText || hasSaveableFilter) && !isCurrentSaved ? (
                  <Pressable onPress={() => addSaved(queryText, currentFilters())} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 13, paddingVertical: 8 }}>
                    <MaterialCommunityIcons name="bell-plus-outline" size={15} color={colors.primaryDark} />
                    <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "900" }}>{queryText ? `“${queryText}” ${translateCopy("aramasını kaydet", language)}` : translateCopy("Bu filtreyi kaydet", language)}</Text>
                  </Pressable>
                ) : null}
                {savedSearches.map((s) => {
                  const tokens = searchKey(s.q).split(" ").filter(Boolean);
                  const newCount = tokens.length > 0 ? listings.filter((l) => l.status === "active" && Date.parse(l.createdAt ?? "") > s.ts && tokens.every((tk) => searchKey(`${l.title} ${l.category} ${l.location}`).includes(tk))).length : 0;
                  const hasF = s.f && Object.keys(s.f).length > 0;
                  const label = s.q || translateCopy("Filtreli arama", language);
                  return (
                    <View key={s.id} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingLeft: 12, paddingRight: 6, paddingVertical: 5 }}>
                      <MaterialCommunityIcons name={hasF ? "filter-check-outline" : "bookmark-outline"} size={14} color={colors.muted} />
                      <Pressable onPress={() => applySaved(s)}><Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>{label}</Text></Pressable>
                      {newCount > 0 ? <View style={{ backgroundColor: colors.accent, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 }}><Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{newCount} {translateCopy("yeni", language)}</Text></View> : null}
                      <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Kayıtlı aramayı sil", language)} onPress={() => removeSaved(s.id)} hitSlop={6} style={{ alignItems: "center", height: 22, justifyContent: "center", width: 22 }}>
                        <MaterialCommunityIcons name="close" size={14} color={colors.subtle} />
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            ) : null}

            {visibleProducts.length === 0 && marketplaceLoadFailed && listings.length === 0 ? (
              // Katalog hiç yüklenemedi (ağ/sunucu) → "sonuç yok" yerine yeniden-dene.
              <MarketplaceRetry onRetry={retryMarketplace} />
            ) : visibleProducts.length === 0 ? (
              <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 40 }}>
                <MaterialCommunityIcons name="magnify-close" size={32} color={colors.primary} />
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{t("noResults")}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", textAlign: "center" }}>{t("retrySearchFilter")}</Text>
                <Link href="/create" asChild>
                  <Pressable style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, marginTop: 4, opacity: pressed ? 0.85 : 1, paddingHorizontal: 18, paddingVertical: 11 })}>
                    <MaterialCommunityIcons name="store-plus-outline" size={16} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("İlan ver", language)}</Text>
                  </Pressable>
                </Link>
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                {visibleProducts.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} owner={resolveOwner(listing.ownerId)} width={productGrid.cardWidth} />
                ))}
              </View>
            )}

            {visibleProducts.length < productListings.length ? (
              <Pressable onPress={() => { setProductVisible((c) => c + 20); if (productVisible + 20 >= productListings.length) { if (queryText && serverHasMore) loadMoreServer(); else if (!queryText && marketplaceHasMore) loadMoreMarketplace(); } }} style={{ alignItems: "center", alignSelf: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 28, paddingVertical: 12 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>{translateCopy("Daha fazla göster", language)}</Text>
              </Pressable>
            ) : (queryText && clientOnlyActive && serverHasMore) ? (
              <Text style={{ color: colors.subtle, fontSize: 12.5, fontWeight: "700", textAlign: "center" }}>{translateCopy("Bu filtreler sonuçları daraltıyor. Daha fazlası için filtreleri gevşet.", language)}</Text>
            ) : (queryText ? serverHasMore : marketplaceHasMore) ? (
              <Pressable onPress={() => (queryText ? loadMoreServer() : loadMoreMarketplace())} disabled={queryText ? serverLoading : marketplaceLoadingMore} style={{ alignItems: "center", alignSelf: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 12, borderWidth: 1.5, opacity: (queryText ? serverLoading : marketplaceLoadingMore) ? 0.6 : 1, paddingHorizontal: 28, paddingVertical: 12 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>{(queryText ? serverLoading : marketplaceLoadingMore) ? translateCopy("Yükleniyor…", language) : translateCopy("Daha fazla ilan yükle", language)}</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Sidebar */}
          <View style={{ gap: 16, width: sidebarWidth }}>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>{translateCopy("Yeni eklenen ilanlar", language)}</Text>
              </View>
              {dealListings.map((listing) => (
                <SidebarListing key={listing.id} listing={listing} owner={findUser(listing.ownerId)} />
              ))}
              <Link href="/" asChild>
                <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                  <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Tüm ilanları gör", language)}</Text>
                  <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primaryDark} />
                </Pressable>
              </Link>
            </View>

            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Yüksek komisyonlu ilanlar", language)}</Text>
              {topCommissionListings.map((listing) => (
                <SidebarListing key={listing.id} listing={listing} owner={findUser(listing.ownerId)} />
              ))}
              <Pressable onPress={() => setFilter("commission")} style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Tümünü gör", language)}</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primaryDark} />
              </Pressable>
            </View>

            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 16 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Neden Ortaksat?", language)}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {[
                  { icon: "cash-remove" as const, value: "0 ₺", label: "İlan vermek ücretsiz" },
                  { icon: "hand-coin" as const, value: "Komisyonla", label: "Satışta öde, önden değil" },
                  { icon: "rocket-launch-outline" as const, value: "Sermayesiz", label: "Ortak olmak risksiz" },
                  { icon: "shield-check" as const, value: "Güvenli", label: "Uygulama içi iletişim" }
                ].map((item) => (
                  <View key={item.label} style={{ alignItems: "center", flexBasis: 120, flexGrow: 1, gap: 4 }}>
                    <MaterialCommunityIcons name={item.icon} size={22} color={colors.primary} />
                    <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy(item.value, language)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", textAlign: "center" }}>{translateCopy(item.label, language)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      onScroll={loadMoreIfNeeded}
      scrollEventThrottle={16}
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{ backgroundColor: colors.surface, paddingBottom: Platform.OS === "web" ? 28 : 102 }}
      style={{ backgroundColor: colors.surface }}
    >
      <View style={isWideWeb ? { flexDirection: "row", gap: 20, paddingHorizontal: padding, paddingTop: 6, alignItems: "flex-start" } : undefined}>
      {isWideWeb || showMobileFilters ? (
        <FilterPanel
          cities={cities}
          city={city}
          onCity={setCity}
          minCommission={minCommission}
          onMinCommission={setMinCommission}
          priceRange={priceRange}
          onPriceRange={setPriceRange}
          statusOpen={statusOpen}
          onStatusOpen={setStatusOpen}
          onClear={() => { setCity(""); setMinCommission(0); setPriceRange(""); setStockFilter(""); setStatusOpen(false); setOnlyVerified(false); router.setParams({ province: undefined, district: undefined }); clearCatFilter(); }}
          width={isWideWeb ? panelWidth : Math.max(0, width - padding * 2)}
          mobile={!isWideWeb}
          provinceId={provinceId}
          districtId={districtId}
          onLocation={(v) => router.setParams({ province: v.provinceId != null ? getProvince(v.provinceId)?.slug : undefined, district: v.districtId != null ? getDistrict(v.districtId)?.slug : undefined })}
          stockFilter={stockFilter}
          onStockFilter={setStockFilter}
          onlyVerified={onlyVerified}
          onOnlyVerified={setOnlyVerified}
        />
      ) : null}
      <View style={isWideWeb ? { flex: 1, minWidth: 0 } : undefined}>
      <View style={{ gap: 7, paddingBottom: 8, paddingHorizontal: isWideWeb ? 0 : padding, paddingTop: isWideWeb ? 0 : 6 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Text selectable style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>
              {t("explore")}
            </Text>
            <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700", lineHeight: 19 }}>
              {t("visualExploreBody")}
            </Text>
          </View>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, minWidth: 74, paddingHorizontal: 10, paddingVertical: 6 }}>
            <Text selectable numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>
              {mediaItems.length} {t("content")}
            </Text>
          </View>
          {!isWideWeb ? (
            <>
              {/* Mobil sıralama (masaüstü toolbar'ın karşılığı): dokununca sıralamayı döndürür.
                  İkon-only (320px'de taşmasın); seçili sıralama aktif-filtre çipinde görünür. */}
              <Pressable onPress={() => setSortMode(SORT_ORDER[(SORT_ORDER.indexOf(sortMode) + 1) % SORT_ORDER.length])} accessibilityRole="button" accessibilityLabel={`${translateCopy("Sırala", language)}: ${translateCopy(SORT_LABELS[sortMode], language)}`} style={{ alignItems: "center", backgroundColor: sortMode !== "recommended" ? colors.primary : colors.surface, borderColor: sortMode !== "recommended" ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 4, justifyContent: "center", minWidth: 38, paddingHorizontal: 9, paddingVertical: 7 }}>
                <MaterialCommunityIcons name="sort" size={16} color={sortMode !== "recommended" ? "#FFFFFF" : colors.primaryDark} />
              </Pressable>
              {/* Mobilde şehir/komisyon/il-ilçe/stok/onaylı filtreleri. */}
              <Pressable onPress={() => setShowMobileFilters((v) => !v)} accessibilityRole="button" accessibilityLabel={translateCopy("Filtrele", language)} style={{ alignItems: "center", backgroundColor: showMobileFilters ? colors.primary : colors.surface, borderColor: hasPanelFilter ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 7 }}>
                <MaterialCommunityIcons name="tune-variant" size={15} color={showMobileFilters ? "#FFFFFF" : colors.primaryDark} />
                <Text style={{ color: showMobileFilters ? "#FFFFFF" : colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{translateCopy("Filtre", language)}</Text>
                {hasPanelFilter ? <View style={{ backgroundColor: showMobileFilters ? "#FFFFFF" : colors.accent, borderRadius: 999, height: 7, width: 7 }} /> : null}
              </Pressable>
            </>
          ) : null}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
          {feedFilters.map((item) => (
            <Pressable
              key={item.key}
              onPress={() => setFilter(item.key)}
              style={({ pressed }) => ({
                alignItems: "center",
                backgroundColor: filter === item.key ? colors.primary : colors.surface,
                borderColor: filter === item.key ? colors.primary : colors.line,
                borderRadius: 999,
                borderWidth: 1,
                flexDirection: "row",
                gap: 6,
                minHeight: 34,
                opacity: pressed ? 0.72 : 1,
                paddingHorizontal: 12
              })}
            >
              <MaterialCommunityIcons name={item.icon} size={14} color={filter === item.key ? "#FFFFFF" : colors.primary} />
              <Text selectable style={{ color: filter === item.key ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "900" }}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ flexDirection: "row", gap: 6 }}>
          <ExploreStat icon="image-multiple-outline" label="Görsel" value={`${mediaItems.length - videoCount}`} />
          <ExploreStat icon="play-box-multiple-outline" label="Video" value={`${videoCount}`} />
          <ExploreStat icon="flash" label="Anında" value={`${openCount}`} />
        </View>

        {/* Aktif filtre çipleri (tek-tek kaldırılabilir + tümünü temizle). */}
        {activeChips.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: "center", gap: 6, paddingVertical: 2 }}>
            {activeChips.map((c) => (
              <Pressable key={c.key} onPress={c.onRemove} accessibilityRole="button" accessibilityLabel={`${translateCopy(c.label, language)} — ${translateCopy("kaldır", language)}`} style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "800", maxWidth: 160 }}>{translateCopy(c.label, language)}</Text>
                <MaterialCommunityIcons name="close-circle" size={14} color={colors.primaryDark} />
              </Pressable>
            ))}
            {activeChips.length > 1 ? (
              <Pressable onPress={clearAllFilters} accessibilityRole="button" style={{ alignItems: "center", borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 }}>
                <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>{translateCopy("Tümünü temizle", language)}</Text>
              </Pressable>
            ) : null}
          </ScrollView>
        ) : null}
      </View>

      {renderCatFilter()}

      {mediaItems.length === 0 && marketplaceLoadFailed && listings.length === 0 ? (
        <MarketplaceRetry onRetry={retryMarketplace} />
      ) : mediaItems.length === 0 ? (
        <View style={{ alignItems: "center", gap: 8, padding: 28 }}>
          <MaterialCommunityIcons name="image-search-outline" size={32} color={colors.primary} />
          <Text selectable style={{ color: colors.ink, fontSize: 17, fontWeight: "900", textAlign: "center" }}>
            {t("noResults")}
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700", lineHeight: 19, textAlign: "center" }}>
            {t("retrySearchFilter")}
          </Text>
        </View>
      ) : (
        <>
          <View style={{ gap, paddingHorizontal: isWideWeb ? 0 : padding, paddingTop: 2 }}>
            {rows.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={{ flexDirection: "row", gap }}>
                {row.map((item, index) => (
                  <ExploreTile
                    key={`${item.id}-${seed}`}
                    height={tileHeight}
                    item={item}
                    language={language}
                    onPress={() => router.push({ pathname: "/(tabs)/explore-feed/[id]", params: { id: item.listing.id, media: item.id } })}
                    order={rowIndex * columns + index}
                    size={tileSize}
                    t={t}
                  />
                ))}
                {Array.from({ length: columns - row.length }).map((_, index) => (
                  <View key={`empty-${rowIndex}-${index}`} style={{ height: tileHeight, width: tileSize }} />
                ))}
              </View>
            ))}
          </View>
          {visibleMediaItems.length < mediaItems.length ? (
            <Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "800", paddingVertical: 8, textAlign: "center" }}>
              {visibleMediaItems.length} / {mediaItems.length} {t("content")}
            </Text>
          ) : null}
        </>
      )}
      </View>
      </View>
    </ScrollView>
  );
}

function FilterPanel({
  cities,
  city,
  onCity,
  minCommission,
  onMinCommission,
  priceRange,
  onPriceRange,
  statusOpen,
  onStatusOpen,
  onClear,
  width,
  mobile,
  provinceId,
  districtId,
  onLocation,
  stockFilter,
  onStockFilter,
  onlyVerified,
  onOnlyVerified
}: {
  cities: string[];
  city: string;
  onCity: (v: string) => void;
  minCommission: number;
  onMinCommission: (v: number) => void;
  priceRange: string;
  onPriceRange: (v: string) => void;
  statusOpen: boolean;
  onStatusOpen: (v: boolean) => void;
  onClear: () => void;
  width: number;
  // Mobil-özel: masaüstü bu filtreleri üst toolbar'da gösterdiğinden yalnız mobilde çizilir.
  mobile?: boolean;
  provinceId?: number;
  districtId?: number;
  onLocation?: (v: LocationValue) => void;
  stockFilter?: string;
  onStockFilter?: (v: string) => void;
  onlyVerified?: boolean;
  onOnlyVerified?: (v: boolean) => void;
}) {
  const { language } = useLanguage();
  const commissionPresets = [0, 100, 250, 500];
  const [pMinDraft, setPMinDraft] = useState("");
  const [pMaxDraft, setPMaxDraft] = useState("");
  useEffect(() => {
    const [mn, mx] = priceRange ? priceRange.split("-") : ["", ""];
    setPMinDraft(mn ?? "");
    setPMaxDraft(mx ?? "");
  }, [priceRange]);
  const applyPrice = () => {
    const mn = pMinDraft.replace(/[^0-9]/g, "");
    const mx = pMaxDraft.replace(/[^0-9]/g, "");
    if (!mn && !mx) { onPriceRange(""); return; }
    if (mn && mx && Number(mn) > Number(mx)) { onPriceRange(`${mx}-${mn}`); return; }
    onPriceRange(`${mn}-${mx}`);
  };
  const hasFilter = Boolean(city) || minCommission > 0 || Boolean(priceRange) || statusOpen || provinceId != null || districtId != null || Boolean(stockFilter) || Boolean(onlyVerified);
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 18, padding: 16, width }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="filter-variant" size={18} color={colors.primaryDark} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>{translateCopy("Filtrele", language)}</Text>
        {hasFilter ? (
          <Pressable onPress={onClear}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "900" }}>{translateCopy("Temizle", language)}</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{translateCopy("Durum", language)}</Text>
        <Pressable
          onPress={() => onStatusOpen(!statusOpen)}
          style={{ alignItems: "center", backgroundColor: statusOpen ? colors.primarySoft : colors.surfaceAlt, borderColor: statusOpen ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}
        >
          <MaterialCommunityIcons name={statusOpen ? "checkbox-marked" : "checkbox-blank-outline"} size={18} color={statusOpen ? colors.primary : colors.muted} />
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{translateCopy("Ortak satışa açık", language)}</Text>
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{translateCopy("Fiyat aralığı (₺)", language)}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {PRICE_PRESETS.map((p) => {
            const on = priceRange === p.value;
            return (
              <Pressable key={p.value} onPress={() => onPriceRange(on ? "" : p.value)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 11, paddingVertical: 7 }}>
                <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 11.5, fontWeight: "800" }}>{p.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <TextInput
            value={pMinDraft}
            onChangeText={(t) => setPMinDraft(t.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            placeholder={translateCopy("En az", language)}
            placeholderTextColor={colors.subtle}
            style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 14, height: 42, paddingHorizontal: 10 }}
          />
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>—</Text>
          <TextInput
            value={pMaxDraft}
            onChangeText={(t) => setPMaxDraft(t.replace(/[^0-9]/g, ""))}
            keyboardType="number-pad"
            placeholder={translateCopy("En çok", language)}
            placeholderTextColor={colors.subtle}
            onSubmitEditing={applyPrice}
            style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 14, height: 42, paddingHorizontal: 10 }}
          />
          <Pressable onPress={applyPrice} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, height: 42, justifyContent: "center", paddingHorizontal: 14 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Uygula", language)}</Text>
          </Pressable>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{translateCopy("Komisyon (en az)", language)}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          {commissionPresets.map((amount) => {
            const active = minCommission === amount;
            return (
              <Pressable
                key={amount}
                onPress={() => onMinCommission(amount)}
                style={{ backgroundColor: active ? colors.primary : colors.surfaceAlt, borderColor: active ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}
              >
                <Text style={{ color: active ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>
                  {amount === 0 ? translateCopy("Tümü", language) : `₺${amount}+`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Mobil: masaüstü toolbar'ındaki il/ilçe + stok + onaylı-satıcı filtreleri burada. */}
      {mobile && onLocation ? (
        <View style={{ gap: 8, zIndex: 20 }}>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{translateCopy("Konum (İl / İlçe)", language)}</Text>
          <LocationSelector value={{ provinceId, districtId }} onChange={onLocation} showNeighborhood={false} mode="filter" />
        </View>
      ) : null}

      {mobile && onStockFilter ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{translateCopy("Stok Durumu", language)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {([["", "Tümü"], ["in", "Stokta var"], ["low", "Az stok"]] as const).map(([val, lbl]) => {
              const on = (stockFilter ?? "") === val;
              return (
                <Pressable key={val || "all"} onPress={() => onStockFilter(on ? "" : val)} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
                  <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{translateCopy(lbl, language)}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}

      {mobile && onOnlyVerified ? (
        <Pressable onPress={() => onOnlyVerified(!onlyVerified)} style={{ alignItems: "center", backgroundColor: onlyVerified ? colors.primarySoft : colors.surfaceAlt, borderColor: onlyVerified ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}>
          <MaterialCommunityIcons name={onlyVerified ? "checkbox-marked" : "checkbox-blank-outline"} size={18} color={onlyVerified ? colors.primary : colors.muted} />
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{translateCopy("Sadece onaylı satıcılar", language)}</Text>
        </Pressable>
      ) : null}

      {/* Masaüstü sidebar'ında düz şehir listesi (mobilde yerini LocationSelector alır). */}
      {!mobile ? (
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{translateCopy("Şehir", language)}</Text>
          <View style={{ gap: 4 }}>
            <Pressable onPress={() => onCity("")} style={{ alignItems: "center", flexDirection: "row", gap: 8, paddingVertical: 6 }}>
              <MaterialCommunityIcons name={city === "" ? "radiobox-marked" : "radiobox-blank"} size={18} color={city === "" ? colors.primary : colors.muted} />
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{translateCopy("Tüm şehirler", language)}</Text>
            </Pressable>
            {cities.map((c) => {
              const active = city === c;
              return (
                <Pressable key={c} onPress={() => onCity(active ? "" : c)} style={{ alignItems: "center", flexDirection: "row", gap: 8, paddingVertical: 6 }}>
                  <MaterialCommunityIcons name={active ? "radiobox-marked" : "radiobox-blank"} size={18} color={active ? colors.primary : colors.muted} />
                  <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{c}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function FilterDropdown({ label, value, options, onSelect, searchable }: { label: string; value: string | number; options: Array<{ label: string; value: string | number }>; onSelect: (value: string | number) => void; searchable?: boolean }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);
  const active = value !== "" && value !== 0;
  const filtered = searchable && query.trim()
    ? options.filter((o) => searchKey(o.label).includes(searchKey(query)))
    : options;
  function close() {
    setOpen(false);
    setQuery("");
  }
  return (
    <View style={{ position: "relative", zIndex: open ? 1000 : 1 }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={{ alignItems: "center", backgroundColor: active ? colors.primarySoft : colors.surfaceAlt, borderColor: active ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}
      >
        <Text style={{ color: active ? colors.primaryDark : colors.ink, fontSize: 13, fontWeight: active ? "900" : "700" }}>
          {translateCopy(active && selected ? selected.label : label, language)}
        </Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={15} color={colors.muted} />
      </Pressable>
      {open ? (
        <>
          <Pressable onPress={close} style={{ bottom: -2000, left: -2000, position: "absolute", right: -2000, top: -2000, zIndex: 90 }} />
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, left: 0, maxHeight: 320, minWidth: 220, paddingVertical: 6, position: "absolute", shadowColor: "#101828", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.16, shadowRadius: 24, top: 44, zIndex: 100 }}>
            {searchable ? (
              <View style={{ paddingBottom: 6, paddingHorizontal: 10 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 10 }}>
                  <MaterialCommunityIcons name="magnify" size={15} color={colors.muted} />
                  <TextInput
                    value={query}
                    onChangeText={setQuery}
                    placeholder={translateCopy("Şehir ara", language)}
                    placeholderTextColor={colors.muted}
                    autoFocus
                    style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "600", height: 36, paddingVertical: 0 }}
                  />
                </View>
              </View>
            ) : null}
            <ScrollView style={{ maxHeight: searchable ? 260 : undefined }} keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", paddingHorizontal: 14, paddingVertical: 10 }}>{translateCopy("Sonuç yok", language)}</Text>
              ) : (
                filtered.map((opt) => {
                  const isSel = opt.value === value;
                  return (
                    <Pressable
                      key={`${opt.value}`}
                      onPress={() => { onSelect(opt.value); close(); }}
                      style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : "transparent", flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 10 })}
                    >
                      <MaterialCommunityIcons name={isSel ? "check-circle" : "circle-outline"} size={16} color={isSel ? colors.primary : colors.subtle} />
                      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: isSel ? "900" : "600" }}>{translateCopy(opt.label, language)}</Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </>
      ) : null}
    </View>
  );
}

// Fiyat aralığı filtresi: hazır aralıklar + serbest min/max girişi (value "min-max").
const PRICE_PRESETS: Array<{ label: string; value: string }> = [
  { label: "0 - ₺1.000", value: "0-1000" },
  { label: "₺1.000 - ₺5.000", value: "1000-5000" },
  { label: "₺5.000 - ₺20.000", value: "5000-20000" },
  { label: "₺20.000 - ₺100.000", value: "20000-100000" },
  { label: "₺100.000+", value: "100000-" }
];
function formatPriceLabel(value: string): string | null {
  if (!value) return null;
  const [mnRaw, mxRaw] = value.split("-");
  const mn = mnRaw ? Number(mnRaw) : 0;
  const mx = mxRaw ? Number(mxRaw) : 0;
  const fmt = (n: number) => `₺${new Intl.NumberFormat("tr-TR").format(n)}`;
  if (mn && mx) return `${fmt(mn)}–${fmt(mx)}`;
  if (mn && !mx) return `${fmt(mn)}+`;
  if (!mn && mx) return `≤ ${fmt(mx)}`;
  return null;
}
// Aranabilir çoklu-seçim marka filtresi (Sahibinden marka arama kutusu gibi).
function PriceRangeFilter({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [minVal, setMinVal] = useState("");
  const [maxVal, setMaxVal] = useState("");
  useEffect(() => {
    const [mn, mx] = value ? value.split("-") : ["", ""];
    setMinVal(mn ?? "");
    setMaxVal(mx ?? "");
  }, [value, open]);
  const active = Boolean(value);
  const label = formatPriceLabel(value) ?? translateCopy("Fiyat", language);
  function applyCustom() {
    const mn = minVal.replace(/[^0-9]/g, "");
    const mx = maxVal.replace(/[^0-9]/g, "");
    if (!mn && !mx) { onChange(""); setOpen(false); return; }
    if (mn && mx && Number(mn) > Number(mx)) { onChange(`${mx}-${mn}`); setOpen(false); return; }
    onChange(`${mn}-${mx}`);
    setOpen(false);
  }
  return (
    <View style={{ position: "relative", zIndex: open ? 1000 : 1 }}>
      <Pressable
        onPress={() => setOpen((o) => !o)}
        style={{ alignItems: "center", backgroundColor: active ? colors.primarySoft : colors.surfaceAlt, borderColor: active ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}
      >
        <MaterialCommunityIcons name="cash" size={14} color={active ? colors.primaryDark : colors.muted} />
        <Text style={{ color: active ? colors.primaryDark : colors.ink, fontSize: 13, fontWeight: active ? "900" : "700" }}>{label}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={15} color={colors.muted} />
      </Pressable>
      {open ? (
        <>
          <Pressable onPress={() => setOpen(false)} style={{ bottom: -2000, left: -2000, position: "absolute", right: -2000, top: -2000, zIndex: 90 }} />
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, gap: 10, left: 0, minWidth: 250, padding: 12, position: "absolute", shadowColor: "#101828", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.16, shadowRadius: 24, top: 44, zIndex: 100 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              {PRICE_PRESETS.map((p) => {
                const on = value === p.value;
                return (
                  <Pressable key={p.value} onPress={() => { onChange(p.value); setOpen(false); }} style={{ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 }}>
                    <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 11.5, fontWeight: "800" }}>{p.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={{ backgroundColor: colors.line, height: 1 }} />
            <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>{translateCopy("Kendi aralığın (₺)", language)}</Text>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
              <TextInput
                value={minVal}
                onChangeText={(t) => setMinVal(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder={translateCopy("En az", language)}
                placeholderTextColor={colors.subtle}
                style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 14, height: 40, paddingHorizontal: 10 }}
              />
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>—</Text>
              <TextInput
                value={maxVal}
                onChangeText={(t) => setMaxVal(t.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                placeholder={translateCopy("En çok", language)}
                placeholderTextColor={colors.subtle}
                onSubmitEditing={applyCustom}
                style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 14, height: 40, paddingHorizontal: 10 }}
              />
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {active ? (
                <Pressable onPress={() => { onChange(""); setOpen(false); }} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 9, borderWidth: 1, flex: 1, paddingVertical: 10 }}>
                  <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy("Temizle", language)}</Text>
                </Pressable>
              ) : null}
              <Pressable onPress={applyCustom} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 9, flex: 1, paddingVertical: 10 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Uygula", language)}</Text>
              </Pressable>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}


function SidebarListing({ listing, owner, showStock }: { listing: Listing; owner?: User; showStock?: boolean }) {
  void owner;
  const { language } = useLanguage();
  const commission = commissionAmount(listing);
  return (
    <Link href={`/listing/${listing.id}`} asChild>
      <Pressable style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 10, opacity: pressed ? 0.8 : 1 })}>
        <View style={{ backgroundColor: colors.line, borderRadius: 10, height: 56, overflow: "hidden", width: 56 }}>
          <SafeRemoteImage uri={listing.image} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={120} />
        </View>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{displayText(listing.title)}</Text>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{money(listing.price)}</Text>
            <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "900" }}>{translateCopy("Kazanç", language)} {money(commission)}</Text>
          </View>
          {showStock ? (
            <Text style={{ color: colors.accent, fontSize: 10, fontWeight: "900" }}>{translateCopy("Son", language)} {listing.stockCount} {translateCopy("stok!", language)}</Text>
          ) : (
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{displayText(listing.location)}</Text>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

function ExploreTileBase({ height, item, language, onPress, order, size, t }: { height: number; item: ExploreMedia; language: "tr" | "en"; onPress: () => void; order: number; size: number; t: (key: string) => string }) {
  const { listing } = item;
  const featured = item.index === 0 || order % 12 === 0;
  const conversionScore = listing.leadCount + listing.partnerCount * 2 + Math.round(listing.favoriteCount / 8);
  const status = getExploreStatus(item, listing, featured, conversionScore, t);
  const commission = commissionAmount(listing);
  // İlanın GERÇEK kategorisi (eski sezgisel inferListingSubcategory kamera→"Araç elektroniği" gibi yanlış eşliyordu).
  const subcategory = displayText(listing.category);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, height, opacity: pressed ? 0.92 : 1, overflow: "hidden", shadowColor: "#0B3A44", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.06, shadowRadius: 10, width: size })}>
      {/* Görsel (kare, temiz zemin — dama-tahtası yok) */}
      <View style={{ backgroundColor: colors.surfaceAlt, height: size, overflow: "hidden", width: "100%" }}>
        <SafeRemoteImage uri={item.type === "video" ? item.poster : item.uri} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={120} />
        <View style={{ left: 8, position: "absolute", right: 8, top: 8 }}>
          <StatusLabel icon={status.icon} label={status.label} tone={status.tone} />
        </View>
        {item.type === "video" ? (
          <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, bottom: 8, height: 30, justifyContent: "center", position: "absolute", right: 8, width: 30 }}>
            <MaterialCommunityIcons name="play" size={18} color={colors.primaryDark} />
          </View>
        ) : null}
      </View>
      {/* Okunur metin bölümü (beyaz, alt) */}
      <View style={{ flex: 1, gap: 3, paddingHorizontal: 9, paddingVertical: 8 }}>
        <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 13, fontWeight: "800", lineHeight: 16, minHeight: 32 }}>
          {displayText(listing.title)}
        </Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>
          {translateCopy(subcategory, language)}
        </Text>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "space-between" }}>
          <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14.5, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{money(listing.price)}</Text>
          <Text numberOfLines={1} style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "700" }}>{displayText(listing.location)}</Text>
        </View>
        {commission > 0 ? (
          <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 7, flexDirection: "row", gap: 4, paddingHorizontal: 7, paddingVertical: 3 }}>
            <MaterialCommunityIcons name="cash-multiple" size={12} color={colors.primaryDark} />
            <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{t("earning")} {money(commission)}</Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

// Medya-feed'de her karo; parent re-render'larında (arama/filtre dışı state
// değişimi) boşuna render olmasın. Yalnız içerik/boyut/dil değişince render et;
// onPress kimliği yok sayılır (davranışsal olarak sabit).
const ExploreTile = memo(ExploreTileBase, (a, b) =>
  a.item === b.item && a.height === b.height && a.size === b.size && a.order === b.order && a.language === b.language
);

function getExploreStatus(item: ExploreMedia, listing: Listing, featured: boolean, conversionScore: number, t: (key: string) => string): { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; tone: "primary" | "dark" | "warning" } {
  if (item.type === "video") return { icon: "play-circle", label: t("videoContent"), tone: "dark" };
  if (listing.partnershipMode === "open") return { icon: "flash", label: t("openForPartners"), tone: "primary" };
  if (conversionScore >= 18) return { icon: "trending-up", label: t("trendProduct"), tone: "warning" };
  if (featured) return { icon: "star-circle", label: t("showcaseProduct"), tone: "dark" };
  return { icon: "tag-outline", label: t("productImage"), tone: "dark" };
}

function ExploreStat({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  const { language } = useLanguage();

  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flex: 1, flexDirection: "row", gap: 6, minHeight: 34, paddingHorizontal: 8 }}>
      <MaterialCommunityIcons name={icon} size={16} color={colors.primary} />
      <Text numberOfLines={1} style={{ color: colors.muted, flex: 1, fontSize: 11, fontWeight: "900" }}>
        {translateCopy(label, language)}
      </Text>
      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
        {value}
      </Text>
    </View>
  );
}

function StatusLabel({ icon, label, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; tone: "primary" | "dark" | "warning" }) {
  const backgroundColor = tone === "primary" ? "rgba(14,165,183,0.96)" : tone === "warning" ? "rgba(245,158,11,0.97)" : "rgba(15,23,42,0.78)";

  return (
    <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor, borderRadius: 999, flexDirection: "row", gap: 4, justifyContent: "center", maxWidth: "100%", minHeight: 24, paddingHorizontal: 9 }}>
      <MaterialCommunityIcons name={icon} size={11} color="#FFFFFF" />
      <Text adjustsFontSizeToFit minimumFontScale={0.74} numberOfLines={1} style={{ color: "#FFFFFF", flexShrink: 1, fontSize: 10, fontWeight: "900" }}>
        {label}
      </Text>
    </View>
  );
}

function chunk<T>(items: T[], size: number) {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}

function exploreScore(listing: Listing, seed: number) {
  const recency = isNewListing(listing.createdAt) ? 120 : 0;
  const base = listing.favoriteCount * 3 + listing.leadCount * 7 + listing.partnerCount * 5;
  const rotation = ((listing.id.charCodeAt(listing.id.length - 1) || 0) * 17 + seed * 31) % 97;
  return base + recency + rotation;
}

function isNewListing(value: string) {
  const date = new Date(value);
  // Gerçek "şimdi" (REFERENCE_NOW dondurulmuştu → 30 Haziran sonrası ilanlar hiç "yeni"
  // sayılmıyor, zamanla kötüleşiyordu). Explore feed'i mount-gate'li → hidrasyon güvenli.
  const age = Date.now() - date.getTime();
  return Number.isFinite(age) && age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
}

function isVideoUri(uri: string) {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(uri);
}
