import { listingCommissionDisplay, listingPhotos } from "@/lib/mobile-listing";
import { HorizontalScroll } from "@/components/horizontal-scroll";
import { displayListingTitle } from "@/lib/listing-title";
import { clearMobileFilters, mobileFilterCount, filterMobileListings as filtered, mobileFilterError, type MobileFilters as Filters } from "@/lib/mobile-filters";
import { CategoryArtwork } from "./categories";
import { categoryTile } from "@/lib/mobile-catalog";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BackHandler, Keyboard, Modal, PanResponder, Platform, Pressable, RefreshControl, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useBackNavigation } from "@/lib/use-back-navigation";
import { currentListingLocation, currentLocationError, deviceLocationAvailable } from "@/lib/current-location";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { MarketplaceRetry } from "@/components/marketplace-retry";
import { LocationSelector, type LocationValue } from "@/components/location-selector";
import { getFormSchema, modelsForSchema, resolveFormKey, type CategoryNode } from "@/lib/category-tree";
import { categoryTrail, inCategory } from "@/lib/mobile-catalog";
import { fetchMobileCatalogue } from "@/lib/mobile-catalogue-service";
import { isSupabaseConfigured } from "@/lib/supabase";
import { useFavoriteFlag } from "@/lib/favorites-cache";
import { useStore } from "@/lib/use-store";
import { groupThousands, moneyIn } from "@/lib/format";
import { searchKey } from "@/lib/locale";
import { provinces } from "@/lib/locations";
import { parseTrPrice } from "@/lib/validation";
import type { Listing } from "@/lib/types";
import { showToast } from "@/lib/toast";
import { useSavedSearches } from "@/lib/saved-searches";
import { restoreMobileSearch } from "@/lib/mobile-saved-search";
import { MobileCategorySelect } from "./category-select";
import { MobileBottomNav, MobileButton, MobileCard, MobileChip, MobileField, MobileScreen, MobileSelect, SectionLabel, IconButton, fitPillText, mobile, ms, useMobileLayout } from "./ui";

const sorting = ["Önerilen", "En yeni", "Fiyat: düşükten yükseğe", "Fiyat: yüksekten düşüğe", "En yüksek komisyon"];
export function MobileCatalogue({ slug, tabbed = false }: { slug?: string; tabbed?: boolean }) {
  const params = useLocalSearchParams<{ q?: string; filters?: string; saved?:string; from?: string }>();
  const saved=useSavedSearches();
  const [searchDraft, setSearchDraft] = useState(typeof params.q === "string" ? params.q : "");
  useEffect(() => { setSearchDraft(typeof params.q === "string" ? params.q : ""); }, [params.q]);
  const restored=restoreMobileSearch(params.saved);
  const router = useRouter();
  const { listings, categoryTree, marketplaceInitialLoading, marketplaceLoadFailed, retryMarketplace } = useStore();
  const { wide, maxWidth } = useMobileLayout();
  const [remote, setRemote] = useState<Listing[]>([]);
  const [total, setTotal] = useState(0);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [f, setF] = useState<Filters>(()=>restored.filters);
  const [filterOpen, setFilterOpen] = useState(params.filters === "1");
  // `filters=1` (Ana Sayfa / Keşfet filtre düğmesi) paneli bir kez açar; panel kapanınca parametre
  // temizlenir. Eskiden parametre rotada kalıyor + liste her ölçüt değişiminde yeniden mount oluyordu →
  // "ilanları göster" sonrası ve her çip dokunuşunda panel yeniden açılıyordu.
  useEffect(() => { if (params.filters === "1") setFilterOpen(true); }, [params.filters]);
  const [sort, setSort] = useState(sorting[["recommended","newest","priceAsc","priceDesc","commission"].indexOf(restored.sort)]||sorting[0]);
  // Web routes can remount on Back. Restore criteria from this history entry,
  // rather than relying exclusively on component state retained by native stacks.
  useEffect(() => {
    const restoredEntry = restoreMobileSearch(params.saved);
    setF(restoredEntry.filters);
    setSort(sorting[["recommended", "newest", "priceAsc", "priceDesc", "commission"].indexOf(restoredEntry.sort)] || sorting[0]);
  }, [slug, params.saved]);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [limit, setLimit] = useState(24);
  const savedCategory=restored.category;
  const trail = useMemo(() => (slug||savedCategory ? categoryTrail(categoryTree, slug||savedCategory) : []), [categoryTree, slug,savedCategory]);
  const node = trail[trail.length - 1];
  const query = typeof params.q === "string" ? params.q : "";
  const label = node?.label || (query ? `“${query}” için ilanlar` : "İlanları Keşfet");
  const labelsKey = node?.slug ?? "";
  const activeFilters = mobileFilterCount(f);
  const back = useBackNavigation((trail.length > 1 ? `/kategori/${trail[trail.length - 2].slug}` : slug ? "/kategoriler" : "/explore") as Href);
  // Keşfet mozaiğinden açılan liste AYNI sekmenin içinde gezinir; sekme geçmişinde ayrı kayıt oluşmadığı
  // için router.back() önceki SEKMEYE (çoğunlukla Ana Sayfa) dönüyordu. Mozaikten gelindiyse Geri (başlık
  // düğmesi + Android donanım tuşu) mozaiğe döner; diğer girişlerde (Ana Sayfa araması vb.) geçmiş korunur.
  const backToDiscovery = tabbed && params.from === "explore";
  const goBack = useCallback(() => { if (backToDiscovery) router.navigate("/explore"); else back(); }, [backToDiscovery, router, back]);
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== "android" || !backToDiscovery) return;
    const subscription = BackHandler.addEventListener("hardwareBackPress", () => { router.navigate("/explore"); return true; });
    return () => subscription.remove();
  }, [backToDiscovery, router]));
  const requestKey = JSON.stringify({ trail: trail.map(n => n.key), f, query, sort });
  const sortKey = ["recommended", "newest", "priceAsc", "priceDesc", "commission"][sorting.indexOf(sort)] || "recommended";
  const [loadedKey, setLoadedKey] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextOffset, setNextOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const moreLock = useRef<number | null>(null);
  const requestRevision = useRef(0);
  useEffect(() => {
    const revision = ++requestRevision.current;
    setLimit(24); setRemote([]); setTotal(0); setRemoteError(false); setLoadedKey(""); setLoadingMore(false); setNextOffset(0); setHasMore(false); moreLock.current = null;
    if (!isSupabaseConfigured) return;
    setRemoteLoading(true);
    fetchMobileCatalogue({ trail, filters: f, query, sort: sortKey }).then(data => {
      if (revision !== requestRevision.current) return;
      setRemote(Array.from(new Map(data.listings.map(l => [l.id, l])).values())); setTotal(data.total); setNextOffset(data.listings.length); setHasMore(data.listings.length > 0 && data.listings.length < data.total); setLoadedKey(requestKey);
    }).catch(() => { if (revision === requestRevision.current) setRemoteError(true); })
      .finally(() => { if (revision === requestRevision.current) setRemoteLoading(false); });
    return () => { requestRevision.current++; };
    // Serialized criteria include every filter and category ancestor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey, retry]);
  const source = useMemo(() => listings.filter(l => l.status === "active" && inCategory(l, trail)), [listings, trail]);
  const localResult = useMemo(() => filtered(source, f, query).sort((a, b) => sort === sorting[1] ? b.createdAt.localeCompare(a.createdAt) : sort === sorting[2] ? a.price - b.price : sort === sorting[3] ? b.price - a.price : sort === sorting[4] ? commission(b) - commission(a) : Number(Boolean(b.featured)) - Number(Boolean(a.featured))), [source, f, query, sort]);
  const result = isSupabaseConfigured ? loadedKey === requestKey ? remote : [] : localResult;
  const resultTotal = isSupabaseConfigured ? total : localResult.length;
  // Aşağı çekerek yenile: mevcut ölçütlerle ilk sayfayı yeniden çeker; liste yanıt gelene kadar ekranda kalır.
  // Yenileme sürerken "daha fazla" isteği başlamaz: eski ofsetle gelen sayfa yeni ilk sayfaya eklenip arada boşluk bırakırdı.
  const [refreshing, setRefreshing] = useState(false);
  const refreshLock = useRef(false);
  async function refresh() {
    if (refreshLock.current) return;
    if (!isSupabaseConfigured) { setRefreshing(true); try { await retryMarketplace(); } catch { /* yerel mod: hata kartı zaten gösterilir */ } finally { setRefreshing(false); } return; }
    refreshLock.current = true;
    const revision = ++requestRevision.current;
    moreLock.current = null;
    setRefreshing(true); setRemoteError(false); setLoadingMore(false);
    try {
      const data = await fetchMobileCatalogue({ trail, filters: f, query, sort: sortKey });
      if (revision === requestRevision.current) { setRemote(Array.from(new Map(data.listings.map(l => [l.id, l])).values())); setTotal(data.total); setNextOffset(data.listings.length); setHasMore(data.listings.length > 0 && data.listings.length < data.total); setLoadedKey(requestKey); }
    } catch { if (revision === requestRevision.current) setRemoteError(true); }
    finally { refreshLock.current = false; if (revision === requestRevision.current) setRemoteLoading(false); setRefreshing(false); }
  }
  async function more() {
    if (!isSupabaseConfigured) { setLimit(v => v + 24); return; }
    if (loadingMore || remoteLoading || loadedKey !== requestKey || !hasMore || moreLock.current !== null || refreshLock.current) return;
    const revision = requestRevision.current;
    moreLock.current = revision;
    setLoadingMore(true); setRemoteError(false);
    try {
      const data = await fetchMobileCatalogue({ trail, filters: f, query, sort: sortKey, offset: nextOffset });
      if (revision === requestRevision.current) { setRemote(old => Array.from(new Map([...old, ...data.listings].map(l => [l.id,l])).values())); setTotal(data.total); setNextOffset(nextOffset + data.listings.length); setHasMore(data.listings.length > 0 && nextOffset + data.listings.length < data.total); }
    } catch { if (revision === requestRevision.current) setRemoteError(true); }
    finally { if (moreLock.current === revision) moreLock.current = null; if (revision === requestRevision.current) setLoadingMore(false); }
  }
  const reachEnd = () => { if (isSupabaseConfigured ? hasMore && !remoteError : result.length > limit) void more(); };
  // Panel kapanınca `filters=1` silinir. Sekmeli listede `view=list` de yazılır: yalnız `filters=1` ile
  // gelinmişse parametre silinince liste Keşfet mozaiğine düşmesin.
  const filterParamReset = (): { filters?: undefined; view?: string } => params.filters === "1" ? (tabbed ? { filters: undefined, view: "list" } : { filters: undefined }) : {};
  function closeFilter() {
    setFilterOpen(false);
    if (params.filters === "1") router.setParams(filterParamReset());
  }
  function saveCriteria(filters: Filters, nextSort = sort) {
    setF(filters); setSort(nextSort);
    router.setParams({ ...filterParamReset(), saved: JSON.stringify({ mobile: filters, cat: node?.slug, sort: ["recommended", "newest", "priceAsc", "priceDesc", "commission"][sorting.indexOf(nextSort)] || "recommended" }) });
  }
  function search(value = searchDraft) {
    Keyboard.dismiss();
    const q = value.trim().replace(/\s+/g, " ");
    setSearchDraft(q);
    // Sekmeli listede `view=list` korunur: arama temizlenince liste Keşfet mozaiğine düşmesin.
    router.setParams(tabbed ? { q, view: "list" } : { q });
  }
  // Category transitions are real navigation entries, so Back restores the previous
  // category and filters rather than skipping to the home tab.
  function chooseCategory(path: CategoryNode[], filters?: Filters) {
    setCategoryOpen(false); setFilterOpen(false);
    const target = path[path.length - 1];
    const sameCategory = (target?.slug || "") === (node?.slug || "");
    const nextFilters = filters ?? (sameCategory ? f : { ...f, attrs: {}, ranges: {}, texts: {} });
    if (sameCategory) { saveCriteria(nextFilters); return; }
    if (params.filters === "1") router.setParams(filterParamReset());
    const routeParams = { q: query, saved: JSON.stringify({ mobile: nextFilters, sort: sortKey }) };
    router.push(target
      ? { pathname: "/kategori/[slug]", params: { ...routeParams, slug: target.slug } } as Href
      : { pathname: "/explore", params: { ...routeParams, view: "list", ...(tabbed && params.from ? { from: params.from } : {}) } } as Href);
  }
  const update = (patch: Partial<Filters>) => saveCriteria({ ...f, ...patch });
  const isBusy = isSupabaseConfigured ? remoteLoading || !remoteError && loadedKey !== requestKey : marketplaceInitialLoading;
  const filterSchema = getFormSchema(resolveFormKey(trail));
  const fieldLabel = (key: string) => filterSchema?.fields.find(d => d.key === key)?.label || key;
  const valueLabel = (value: string | string[]) => Array.isArray(value) ? value.join(", ") : value === "true" ? "Evet" : value === "false" ? "Hayır" : value;
  // Telefon 1, küçük tablet (600 dp+) 2, geniş tablet 3 sütun.
  const columns = maxWidth >= 1000 ? 3 : wide ? 2 : 1;
  const rowWidth = Math.floor((maxWidth - 24 - (columns - 1) * 9) / columns);
  return <>
    <MobileScreen onBack={goBack} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={mobile.teal} colors={[mobile.teal]} />} onEndReached={reachEnd} title={label} right={<IconButton name="heart-outline" label="Favoriler" onPress={() => router.push("/favorites")} />} bottom={tabbed ? undefined : <MobileBottomNav />} contentStyle={{ paddingHorizontal: 12 }}>
      {trail.length > 1 && <Text testID="category-breadcrumb" numberOfLines={1} accessibilityLabel={trail.map(n => n.label).join(" / ")} style={[ms.muted, { fontSize: 11, marginBottom: 6 }]}>{trail.map(n => n.label).join(" / ")}</Text>}
      <View style={[ms.row, { borderWidth: 1, borderColor: mobile.line, borderRadius: 12, backgroundColor: "white", paddingLeft: 10, marginBottom: 12 }]}>
        <Icon name="magnify" size={21} color={mobile.muted} />
        <TextInput accessibilityLabel="İlanlarda ara" placeholder={node ? `${node.label} içinde ara...` : "Ürün, marka veya ilan ara..."} value={searchDraft} onChangeText={setSearchDraft} maxLength={120} returnKeyType="search" onSubmitEditing={event => search(event.nativeEvent.text)} style={{ flex: 1, minWidth: 0, height: 44, color: mobile.ink, fontSize: 13 }} />
        {!!(searchDraft || query) && <IconButton name="close-circle-outline" label="Aramayı temizle" onPress={() => search("")} />}
        <Pressable accessibilityRole="button" accessibilityLabel="İlan ara" onPress={() => search()} style={{ backgroundColor: mobile.teal, borderRadius: 9, paddingHorizontal: 12, minHeight: 38, justifyContent: "center", marginRight: 3 }}><Text style={{ color: "white", fontWeight: "700" }}>Ara</Text></Pressable>
      </View>
      <Text style={{ textAlign: "center", color: mobile.muted, marginTop: -3, marginBottom: 12, fontSize: 12 }}>{isBusy ? "İlanlar yükleniyor…" : remoteError && !result.length ? "İlanlar yüklenemedi" : `${groupThousands(resultTotal)} ilan`}</Text>
      <View style={s.toolbar}><MobileChip label="Tümü" selected={activeFilters === 0} onPress={() => saveCriteria(clearMobileFilters({ ...f, currency: undefined }))} /><MobileChip label="Sahibinden" selected={f.owner} onPress={() => update({ owner: !f.owner })} /><MobileChip label="Ortaklığa Açık" selected={f.open} onPress={() => update({ open: !f.open })} /><View style={{ flex: 1, minWidth: wide ? 160 : 85 }}><MobileSelect value={sort === sorting[0] ? "Sırala" : sort} options={sorting} onChange={(value) => saveCriteria(f, value)} /></View></View>
      <View style={[s.toolbar, { marginTop: 9, marginBottom: 12 }]}>
        {!!f.currency && <MobileChip label={`Para birimi: ${f.currency} ×`} onPress={() => update({ currency: undefined })} />}
        {f.loc.provinceId && <MobileChip label={`${provinces.find((p) => p.id === f.loc.provinceId)?.name} ×`} icon="map-marker" onPress={() => update({ loc: {} })} />}
        {(f.min || f.max) && <MobileChip label={`${f.min || "0"} – ${f.max || "∞"}${f.currency ? ` ${f.currency === "TRY" ? "TL" : f.currency}` : ""} ×`} onPress={() => update({ min: "", max: "" })} />}
        {Object.entries(f.attrs).filter(([, v]) => Array.isArray(v) ? v.length : v).map(([key, v]) => <MobileChip key={key} label={`${fieldLabel(key)}: ${valueLabel(v)} ×`} onPress={() => update({ attrs: { ...f.attrs, [key]: "" } })} />)}
        {Object.entries(f.ranges).filter(([,v]) => v.min || v.max).map(([key,v]) => <MobileChip key={key} label={`${fieldLabel(key)}: ${v.min || "0"} – ${v.max || "∞"} ×`} onPress={() => update({ ranges: { ...f.ranges, [key]: { min: "", max: "" } } })} />)}
        {Object.entries(f.texts).filter(([,v]) => v).map(([key,v]) => <MobileChip key={key} label={`${fieldLabel(key)}: ${v} ×`} onPress={() => update({ texts: { ...f.texts, [key]: "" } })} />)}
        <MobileChip label="Kategori" icon="view-grid-outline" onPress={() => setCategoryOpen(true)} /><View style={{ flex: 1 }} /><MobileChip label="Aramayı Kaydet" icon="bookmark-outline" onPress={()=>{saved.add(query,{mobile:f,cat:node?.slug,sort:sortKey});showToast("Arama bu cihazda kaydedildi.");}}/><MobileChip label={activeFilters ? `Filtrele (${activeFilters})` : "Filtrele"} icon="tune-variant" selected={activeFilters > 0} onPress={() => setFilterOpen(true)} />
      </View>
      {activeFilters > 0 && <View style={{ marginBottom: 10, gap: 7 }}><Text style={ms.muted}>{activeFilters} filtre uygulandı</Text><HorizontalScroll showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
        {([['photos', 'Fotoğraflı'], ['urgent', 'Acil'], ['warranty', 'Garantili'], ['exchange', 'Takaslı']] as const).filter(([key]) => f[key]).map(([key, label]) => <MobileChip key={key} label={`${label} ×`} onPress={() => update({ [key]: false })} />)}
        <MobileChip label="Tüm filtreleri temizle" icon="filter-remove-outline" onPress={() => saveCriteria(clearMobileFilters({ ...f, currency: undefined }))} />
      </HorizontalScroll></View>}
      {node?.children?.length ? <HorizontalScroll  showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }} contentContainerStyle={{ gap: 7 }}>{node.children.map((n) => <MobileChip key={n.key} label={n.label} onPress={() => chooseCategory([...trail, n])} />)}</HorizontalScroll> : null}
      {(isSupabaseConfigured ? remoteError : marketplaceLoadFailed) && !result.length ? <MarketplaceRetry onRetry={() => { setRetry((v) => v + 1); return retryMarketplace(); }} /> : !result.length ? <MobileCard><Text style={ms.section}>{isBusy ? "İlanlar yükleniyor…" : "Bu kriterlerde ilan bulunamadı"}</Text><Text style={ms.muted}>{isBusy ? "Güncel ilanlar hazırlanıyor." : query ? "Arama kelimelerini değiştirebilir veya filtrelerini genişletebilirsin." : "Filtreleri değiştirebilir veya diğer kategorilere göz atabilirsin."}</Text>{!isBusy && <>{!!query && <MobileButton secondary onPress={() => search("")}>Aramayı temizle</MobileButton>}{activeFilters > 0 ? <MobileButton secondary onPress={() => saveCriteria(clearMobileFilters({ ...f, currency: undefined }))}>Filtreleri temizle</MobileButton> : !query && <MobileButton secondary onPress={() => router.push("/kategoriler")}>Diğer kategorilere göz at</MobileButton>}</>}</MobileCard> : <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 9 }}>{(isSupabaseConfigured ? result : result.slice(0, limit)).map((l) => <MobileRowListing key={l.id} listing={l} width={rowWidth} />)}</View>}
      {remoteError && result.length > 0 && <Text accessibilityRole="alert" style={ms.error}>Diğer ilanlar yüklenemedi. Yeniden deneyebilirsin.</Text>}
      {!isBusy && (isSupabaseConfigured ? hasMore : result.length > limit) && <MobileButton secondary disabled={loadingMore} onPress={() => void more()}>{loadingMore ? "Yükleniyor…" : remoteError ? "Tekrar dene" : "Daha fazla ilan göster"}</MobileButton>}
    </MobileScreen>
    <Modal statusBarTranslucent navigationBarTranslucent visible={filterOpen} animationType="slide" onRequestClose={closeFilter}>{filterOpen && <MobileFilter initial={f} trail={trail} source={source} query={query} onClose={closeFilter} onApply={(v, path) => chooseCategory(path, v)} />}</Modal>
    <MobileCategorySelect key={categoryOpen ? labelsKey : "closed"} visible={categoryOpen} initial={trail} onSelect={(p) => chooseCategory(p)} onClose={() => setCategoryOpen(false)} />
  </>;
}
function commission(l: Listing) { return l.commissionType === "rate" ? l.price * l.commissionValue / 100 : l.commissionValue; }
export const MobileRowListing = memo(function MobileRowListing({ listing: l, width }: { listing: Listing; width?: number }) {
  const router = useRouter();
  const { isFav, toggle } = useFavoriteFlag(l.id);
  const a = l.attributes ?? {};
  const photoCount = listingPhotos(l).length;
  // Komisyon hapı görselin içinde tek satırdır (genişliğin %95'i). Dar ekranda TUTAR "…" ile kırpılıyordu;
  // sığmıyorsa "Komisyon" sözcüğü düşer (ikon anlamı taşır), yazı 10 px'in altına inmez.
  const [imageWidth, setImageWidth] = useState(width ? Math.round((width - 10) * 0.43) : 0);
  const amount = listingCommissionDisplay(l);
  const commissionLabel = fitPillText(amount ? [`Komisyon ${amount}`, amount] : ["Komisyonu satıcıya sor", "Satıcıya sor"], imageWidth * 0.95 - 30);
  const details = [["calendar", a.year], ["speedometer", a.km ? `${groupThousands(Number(a.km))} km` : a.rooms], ["gas-station", a.fuel], ["car-shift-pattern", a.gear ?? a.transmission]] as const;
  return <View testID="catalogue-listing" style={[s.listing, { width }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={displayListingTitle(l.title)} onPress={() => router.push(`/listing/${l.id}` as never)} style={{ flexDirection: "row", alignItems: "flex-start", gap: 10 }}>
      <View style={s.listingImage} onLayout={(event) => setImageWidth(Math.round(event.nativeEvent.layout.width))}><SafeRemoteImage uri={l.imageUrl || l.image} fallbackUri={l.fallbackCategoryImage} accessibilityLabel={displayListingTitle(l.title)} style={{ width: "100%", height: "100%" }} />{l.partnershipMode !== "none" && <View style={s.commission}><Icon name="account-group" size={13} color="white" /><Text numberOfLines={1} style={s.commissionText}>{commissionLabel}</Text></View>}<View style={s.imageCount}><Icon name="image" size={9} color="white" /><Text style={{ color: "white", fontSize: 10 }}>{photoCount ? `1/${photoCount}` : "Fotoğraf yok"}</Text></View></View>
      <View style={{ flex: 1, paddingVertical: 5, gap: 5 }}><Text numberOfLines={2} style={s.listingTitle}>{displayListingTitle(l.title)}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={s.price}>{moneyIn(l.price, l.currency)}</Text><View style={ms.row}><Icon name="map-marker" size={13} color={mobile.muted} /><Text numberOfLines={1} style={[ms.muted, { fontSize: 10, flex: 1 }]}>{l.location}</Text></View><View style={[ms.wrap, { gap: 7 }]}>{details.filter(([, v]) => v != null && v !== "").map(([icon, value]) => <View key={icon} style={{ flexDirection: "row", gap: 4, alignItems: "center" }}><Icon name={icon} size={11} color={mobile.muted} /><Text style={{ fontSize: 10, color: mobile.muted }}>{String(value)}</Text></View>)}</View><Text style={[s.status, l.partnershipMode === "none" && { backgroundColor: "#F2F4F7", color: "#475569" }]}>{l.partnershipMode === "none" ? "Ortaklığa Kapalı" : l.partnershipMode === "invite" ? "Davetle Ortaklık" : "Ortaklığa Açık"}</Text></View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={isFav ? "Favorilerden çıkar" : "Favorilere ekle"} accessibilityState={{ selected: isFav }} aria-pressed={isFav} onPress={toggle} hitSlop={6} style={s.heart}><Icon name={isFav ? "heart" : "heart-outline"} size={24} color={isFav ? "#FF657C" : "white"} /></Pressable>
  </View>;
});

export function MobileFilter({ initial, trail: initialTrail, source, query, onApply, onClose, lockOpen = false }: { initial: Filters; trail: CategoryNode[]; source: Listing[]; query: string; lockOpen?: boolean; onApply: (f: Filters, path: CategoryNode[]) => void; onClose: () => void }) {
  const [trail, setTrail] = useState(initialTrail);
  const [f, setF] = useState<Filters>(() => ({ ...initial, attrs: { ...initial.attrs }, loc: { ...initial.loc }, ranges: { ...initial.ranges }, texts: { ...initial.texts } }));
  const [advanced, setAdvanced] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [locating, setLocating] = useState(false);
  const locationRequest = useRef(0), locatingLock = useRef(false), locationAlive = useRef(true);
  useEffect(() => { locationAlive.current = true; return () => { locationAlive.current = false; locationRequest.current++; }; }, []);
  useEffect(() => { locationRequest.current++; }, [f.loc.provinceId, f.loc.districtId, f.loc.neighborhoodId]);
  const { tablet, insets } = useMobileLayout();
  const rawSchemaKey = resolveFormKey(trail);
  const schemaKey = rawSchemaKey;
  const schema = trail.length ? getFormSchema(schemaKey) : undefined;
  const priceField = schema?.fields.find(def => def.key === "price" || def.key.toLowerCase().includes("price") && def.type === "number");
  const modelOptions = modelsForSchema(schemaKey, String(f.attrs.brand || ""));
  const field = (key: string) => schema?.fields.find((f) => f.key === key);
  const attr = (key: string, value: string) => setF((s) => ({ ...s, attrs: { ...s.attrs, [key]: value === "Tümü" ? "" : value, ...(key === "brand" ? { model: "" } : {}) }, texts: key === "brand" ? { ...s.texts, model: "" } : s.texts }));
  const update = (patch: Partial<Filters>) => setF((v) => ({ ...v, ...patch }));
  // Kaydırıcı tavanı kategorinin kendi en yüksek fiyatından türetilir (yuvarlanmış). Eskiden en az
  // 5.000.000 idi → ~300 dp'lik izde 1 dp ≈ 16.700 TL: 100 bin TL altı kategorilerde kaydırıcı kullanılamıyordu.
  const maxPrice = priceCeiling(source.filter(l => !f.currency || l.currency === f.currency).map((l) => l.price));
  const priceSymbol = f.currency === "TRY" ? "₺ " : f.currency === "USD" ? "$ " : f.currency === "EUR" ? "€ " : "";
  const [count, setCount] = useState<number | null>(null);
  const [countError, setCountError] = useState(false);
  const filterError = mobileFilterError(f);
  const countLabel = filterError ? "Filtre aralıklarını kontrol et" : countError ? "Sonuç sayısı alınamadı" : count === null ? "Sonuçlar hesaplanıyor…" : `${groupThousands(count)} ilan`;
  const countKey = JSON.stringify({ trail: trail.map(n => n.key), f, query });
  useEffect(() => {
    let active = true;
    setCount(null); setCountError(false);
    if (mobileFilterError(f)) return;
    if (!isSupabaseConfigured) { setCount(filtered(source.filter(l => inCategory(l, trail)), f, query).length); return; }
    const timer = setTimeout(() => {
      fetchMobileCatalogue({ trail, filters: f, query, limit: 1 }).then(data => { if (active) setCount(data.total); }).catch(() => { if (active) setCountError(true); });
    }, 350);
    return () => { active = false; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countKey]);
  async function locate() {
    if (locatingLock.current) return;
    locatingLock.current = true;
    const generation = ++locationRequest.current;
    setLocating(true);
    try {
      const loc = await currentListingLocation();
      if (!locationAlive.current || generation !== locationRequest.current) return;
      update({ loc });
      showToast(loc.districtId ? "İl ve ilçe konumuna göre seçildi." : "İl seçildi. İlçeyi listeden tamamlayabilirsin.");
    } catch (e) { if (locationAlive.current && generation === locationRequest.current) showToast(currentLocationError(e)); }
    finally { locatingLock.current = false; if (locationAlive.current) setLocating(false); }
  }
  return <>
    <MobileScreen onBack={onClose} title="Filtrele" footer={<></>} right={<Pressable accessibilityRole="button" accessibilityLabel="Filtreleri sıfırla" style={{minWidth:44,minHeight:44,alignItems:"center",justifyContent:"center",paddingHorizontal:6}} onPress={() => setF(clearMobileFilters({ ...initial, currency: undefined }, lockOpen))}><Text style={{ color: mobile.teal, fontSize: 13, fontWeight: "700" }}>Temizle</Text></Pressable>} contentStyle={tablet ? { maxWidth: FILTER_MAX_WIDTH } : undefined} bottom={<View style={{ padding: 12, paddingBottom: Math.max(20, insets.bottom + 12), backgroundColor: "white" }}><View style={tablet ? { width: "100%", maxWidth: FILTER_MAX_WIDTH, alignSelf: "center" } : undefined}><MobileButton icon="magnify" disabled={!!filterError} onPress={() => onApply(f, trail)}>{countError ? "Filtreleri uygula" : count === null ? "Sonuçlar hesaplanıyor…" : `${groupThousands(count)} ilan göster`}</MobileButton><Pressable accessibilityRole="button" onPress={onClose} style={{ alignItems: "center", justifyContent: "center", minHeight: 44, paddingTop: 5 }}><Text style={ms.muted}>Vazgeç</Text></Pressable></View></View>}>
      <MobileCard style={{ flexDirection: "row", alignItems: "center" }}><CategoryArtwork tile={categoryTile(trail)} size={48} /><View style={{ flex: 1 }}><Text style={ms.section}>{trail.map((n) => n.label).slice(0, 2).join(" / ") || "Tüm kategoriler"}</Text><Text style={ms.muted}>{countLabel}</Text></View><MobileChip label="Kategori Değiştir" onPress={() => setCategoryOpen(true)} /></MobileCard>
      <View style={s.filterSection}><MobileSelect label="Para Birimi" value={f.currency || "Tümü"} options={["Tümü", "TRY", "USD", "EUR"]} onChange={v => update({ currency: v === "Tümü" ? undefined : v as Filters["currency"] })} /></View>
      <View style={s.filterSection}><SectionLabel icon="map-marker">Konum</SectionLabel><LocationSelector value={f.loc} onChange={(loc) => { locationRequest.current++; update({ loc }); }} mode="filter" showNeighborhood={false} />{deviceLocationAvailable && <Pressable accessibilityRole="button" accessibilityLabel="Konumumu kullan" accessibilityState={{ disabled: locating, busy: locating }} disabled={locating} onPress={locate} style={{ alignSelf: "flex-end", minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 9 }}><Icon name="crosshairs-gps" size={19} color={mobile.teal} /><Text style={{ color: mobile.teal, fontSize: 12 }}>{locating ? "Konum alınıyor…" : "Konumum"}</Text></Pressable>}</View>
      <View style={s.filterSection}><SectionLabel icon="database">Fiyat Aralığı</SectionLabel><PriceRange currency={f.currency} min={f.min} max={f.max} ceiling={maxPrice} onChange={(min, max) => update({ min, max })} /><View style={ms.row}><MobileField label="Min. Fiyat" placeholder={`${priceSymbol}0`} value={f.min} onChange={(min) => update({ min })} numeric /><MobileField label="Maks. Fiyat" placeholder={`${priceSymbol}${groupThousands(maxPrice)}+`} value={f.max} onChange={(max) => update({ max })} numeric /></View></View>
      {field("brand") && <View style={s.filterSection}><SectionLabel icon="tag">Marka</SectionLabel>{field("brand")?.options?.length ? <MobileSelect placeholder="Marka seçin" value={String(f.attrs.brand || "")} options={["Tümü", ...(field("brand")?.options ?? [...new Set(source.map((l) => String(l.attributes?.brand ?? "")).filter(Boolean))])]} onChange={(v) => attr("brand", v)} /> : <MobileField placeholder="Marka ara" value={f.texts.brand || ""} onChange={brand => update({ texts: { ...f.texts, brand, model: "" } })} />}</View>}
      {field("model") && <View style={s.filterSection}><SectionLabel icon="car">Model</SectionLabel>{modelOptions.length || field("model")?.options?.length ? <MobileSelect placeholder="Model seçin" value={String(f.attrs.model || "")} options={["Tümü", ...(modelOptions.length ? modelOptions : field("model")?.options ?? [])]} onChange={(v) => attr("model", v)} disabled={!!field("brand")?.options?.length && !f.attrs.brand} /> : <MobileField placeholder="Model ara" value={f.texts.model || ""} onChange={model => update({ texts: { ...f.texts, model } })} />}</View>}
      {(schema?.fields ?? []).filter(def => !["title", "description", "brand", "model", "price"].includes(def.key) && def.key !== priceField?.key && def.type !== "textarea").map(def => {
        const primary = ["year", "km", "gear", "fuel", "rooms", "grossM2", "netM2", "condition"].includes(def.key);
        if (!primary && !advanced) return null;
        const value = f.attrs[def.key];
        return <View key={def.key} style={s.filterSection}><SectionLabel icon={def.key === "fuel" ? "gas-station" : def.key === "year" ? "calendar" : def.type === "number" ? "ruler" : "tune-variant"}>{def.label}</SectionLabel>
          {(def.type === "number" || def.key === "year" || def.key === "km") ? <View style={ms.row}><MobileField label={`${def.label} min.`} placeholder="Min." numeric value={f.ranges[def.key]?.min || ""} onChange={min => update({ ranges: { ...f.ranges, [def.key]: { min, max: f.ranges[def.key]?.max || "" } } })} /><MobileField label={`${def.label} maks.`} placeholder="Maks." numeric value={f.ranges[def.key]?.max || ""} onChange={max => update({ ranges: { ...f.ranges, [def.key]: { min: f.ranges[def.key]?.min || "", max } } })} /></View>
          : def.type === "bool" ? <View style={ms.wrap}>{[["", "Tümü"], ["true", "Evet"], ["false", "Hayır"]].map(([key,label]) => <MobileChip key={key} label={label} selected={(value || "") === key} onPress={() => attr(def.key,key)} />)}</View>
          : def.type === "multiselect" ? <View style={ms.wrap}>{(def.options ?? []).map(option => <MobileChip key={option} label={option} selected={Array.isArray(value) && value.includes(option)} onPress={() => { const old = Array.isArray(value) ? value : []; update({ attrs: { ...f.attrs, [def.key]: old.includes(option) ? old.filter(v => v !== option) : [...old, option] } }); }} />)}</View>
          : def.options?.length ? <MobileSelect placeholder={`${def.label} seçin`} value={String(value || "")} options={["Tümü", ...def.options]} onChange={v => attr(def.key,v)} />
          : <MobileField placeholder={`${def.label} ara`} value={f.texts[def.key] || ""} onChange={v => update({ texts: { ...f.texts, [def.key]: v } })} />}
        </View>;
      })}
      <MobileChip icon={advanced ? "chevron-up" : "tune-variant"} label={advanced ? "Diğer kategori özelliklerini gizle" : "Tüm kategori özelliklerini göster"} onPress={() => setAdvanced(v => !v)} />
      {filterError && <Text accessibilityRole="alert" style={ms.error}>{filterError}</Text>}
      {countError && !filterError && <Text accessibilityRole="alert" style={ms.muted}>Sonuç sayısı şu anda alınamıyor. Filtreleri uygulayarak yeniden deneyebilirsin.</Text>}
      <View style={[s.filterSection, { borderTopWidth: 1, borderColor: mobile.line, paddingTop: 13 }]}><SectionLabel icon="tune-variant">Diğer Filtreler</SectionLabel><View style={{ flexDirection: "row", gap: 12 }}><View style={{ flex: 1 }}>{([['open', 'Sadece ortaklığa açık ilanlar'], ['photos', 'Sadece fotoğraflı ilanlar'], ['urgent', 'Sadece acil ilanlar']] as const).map(([key, label]) => <FilterSwitch key={key} label={label} value={f[key]} onChange={(v) => update({ [key]: key === "open" && lockOpen ? true : v })} />)}</View><View style={{ flex: 1 }}>{([['warranty', 'Sadece garantili ilanlar'], ['owner', 'Sadece sahibinden'], ['exchange', 'Takaslı ilanlar']] as const).map(([key, label]) => <FilterSwitch key={key} label={label} value={f[key]} onChange={(v) => update({ [key]: v })} />)}</View></View></View>
    </MobileScreen>
    <MobileCategorySelect visible={categoryOpen} initial={trail} onClose={() => setCategoryOpen(false)} onSelect={(path) => { setTrail(path); setF(v => ({ ...v, attrs: {}, ranges: {}, texts: {}, open: lockOpen || v.open })); }} />
  </>;
}
// Filtre formu tablette kenardan kenara uzamasın (kategori seçici ile aynı ölçek).
const FILTER_MAX_WIDTH = 720;
/** Kaydırıcı tavanı: kategorinin en yüksek fiyatı, 1-2-5 basamağına yukarı yuvarlanır (taban 10.000). */
function priceCeiling(prices: number[]): number {
  const highest = prices.reduce((max, price) => Number.isFinite(price) && price > max ? price : max, 0);
  if (highest <= 0) return 5_000_000;
  const target = Math.max(10_000, highest);
  const magnitude = 10 ** Math.floor(Math.log10(target));
  return ([1, 2, 5, 10].find((step) => step * magnitude >= target) ?? 10) * magnitude;
}
function FilterSwitch({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) { return <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, minHeight: 48, marginVertical: 4 }}><Text style={{ flex: 1, color: mobile.ink, fontSize: 13, lineHeight: 18 }}>{label}</Text><Switch {...({ activeThumbColor: "#FFFFFF" } as object)} accessibilityLabel={label} value={value} onValueChange={onChange} trackColor={{ false: "#DDE3EA", true: mobile.teal }} thumbColor="white" /></View>; }
function PriceRange({ min, max, ceiling, currency, onChange }: { min: string; max: string; ceiling: number; currency?: Filters["currency"]; onChange: (min: string, max: string) => void }) {
  const [width, setWidth] = useState(300);
  const values = useRef({ min, max, width, ceiling, onChange }); values.current = { min, max, width, ceiling, onChange };
  const origin = useRef(0);
  const responders = useMemo(() => (["min", "max"] as const).map((side) => PanResponder.create({ onStartShouldSetPanResponder: () => true, onMoveShouldSetPanResponder: () => true, onPanResponderGrant: () => { const v = values.current; origin.current = side === "min" ? parseTrPrice(v.min) : v.max ? parseTrPrice(v.max) : v.ceiling; }, onPanResponderMove: (_, g) => { const v = values.current; const raw = Math.round((origin.current + g.dx / v.width * v.ceiling) / 1000) * 1000; const value = Math.max(0, Math.min(v.ceiling, raw)); const low = parseTrPrice(v.min); const high = v.max ? parseTrPrice(v.max) : v.ceiling; v.onChange(side === "min" ? String(Math.min(value, high)) : v.min, side === "max" ? String(Math.max(value, low)) : v.max); } })), []);
  const low = Math.max(0, Math.min(1, parseTrPrice(min) / ceiling)); const high = Math.max(low, Math.min(1, max ? parseTrPrice(max) / ceiling : 1));
  const adjust = (i: number, delta: number) => {
    const value = Math.max(0, Math.min(ceiling, Math.round((i ? high : low) * ceiling) + delta));
    onChange(i ? min : String(Math.min(value, max ? parseTrPrice(max) : ceiling)), i ? String(Math.max(value, parseTrPrice(min))) : max);
  };
  return <View style={{ marginVertical: 12 }}><View onLayout={(e) => setWidth(e.nativeEvent.layout.width)} style={{ height: 44, justifyContent: "center", marginHorizontal: 22 }}><View style={{ height: 4, borderRadius: 2, backgroundColor: "#E4EAF0" }} /><View style={{ height: 4, backgroundColor: mobile.teal, position: "absolute", left: `${low * 100}%`, right: `${(1 - high) * 100}%` }} />{[low, high].map((v, i) => <View key={i} {...responders[i].panHandlers} accessibilityRole="adjustable" accessibilityLabel={i ? "Maksimum fiyat" : "Minimum fiyat"}
    accessibilityValue={{ min: i ? parseTrPrice(min) : 0, max: i ? ceiling : max ? parseTrPrice(max) : ceiling, now: Math.round(v * ceiling), text: currency ? moneyIn(Math.round(v * ceiling), currency) : groupThousands(Math.round(v * ceiling)) }}
    {...(Platform.OS === "web" ? { tabIndex: 0 as const, role: "slider" as const, "aria-valuemin": i ? parseTrPrice(min) : 0, "aria-valuemax": i ? ceiling : max ? parseTrPrice(max) : ceiling, "aria-valuenow": Math.round(v * ceiling), "aria-valuetext": currency ? moneyIn(Math.round(v * ceiling), currency) : groupThousands(Math.round(v * ceiling)), onKeyDown: (event: { key: string; preventDefault: () => void }) => { const delta = ["ArrowRight", "ArrowUp"].includes(event.key) ? 1000 : ["ArrowLeft", "ArrowDown"].includes(event.key) ? -1000 : 0; if (delta) { event.preventDefault(); adjust(i, delta); } } } : {})}
    accessibilityActions={[{ name: "increment", label: "Fiyatı artır" }, { name: "decrement", label: "Fiyatı azalt" }]}
    onAccessibilityAction={event => { const delta = event.nativeEvent.actionName === "increment" ? 1000 : event.nativeEvent.actionName === "decrement" ? -1000 : 0; if (delta) adjust(i, delta); }}
    style={{ position: "absolute", left: v * width - 22, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><View pointerEvents="none" style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: mobile.teal, borderWidth: 2, borderColor: "#0043C5" }} /></View>)}</View><View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 5 }}><Text style={ms.muted}>{currency ? moneyIn(0, currency) : "0"}</Text><Text style={ms.muted}>{currency ? moneyIn(ceiling, currency) : groupThousands(ceiling)}+</Text></View></View>;
}
const s = StyleSheet.create({ toolbar: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }, listing: { borderRadius: 12, borderWidth: 1, borderColor: mobile.line, padding: 4, backgroundColor: "#FFFFFF", marginBottom: 2, minHeight: 118 }, listingImage: { width: "43%", height: 112, borderRadius: 9, overflow: "hidden", backgroundColor: "#EDF3F5" }, listingTitle: { color: mobile.ink, fontSize: 12, lineHeight: 16, fontWeight: "700" }, price: { color: mobile.teal, fontSize: 19, fontWeight: "800" }, commission: { position: "absolute", left: 4, bottom: 5, maxWidth: "95%", flexDirection: "row", alignItems: "center", gap: 3, backgroundColor: "#0645C9EB", borderRadius: 999, paddingHorizontal: 7, paddingVertical: 4 }, commissionText: { color: "white", fontSize: 10, fontWeight: "800", flexShrink: 1 }, imageCount: { position: "absolute", right: 3, bottom: 31, borderRadius: 9, backgroundColor: "#20242BAA", flexDirection: "row", gap: 3, paddingHorizontal: 5, paddingVertical: 3 }, status: { fontSize: 10, fontWeight: "800", alignSelf: "flex-start", color: "#0645C9", backgroundColor: "#E5F0FF", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: "hidden" }, heart: { position: "absolute", left: 6, top: 6, width: 32, height: 32, alignItems: "center", justifyContent: "center", backgroundColor: "#00000038", borderRadius: 16 }, filterSection: { marginVertical: 12 }, twoColumns: { flexDirection: "row", gap: 14, marginVertical: 12 } });
