import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useMemo, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { ListingCard } from "@/components/listing-card";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { inferListingSubcategory, listingCategories } from "@/lib/categories";
import { commissionAmount, money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { responsiveGrid, useIsWideWeb } from "@/lib/layout";
import { REFERENCE_NOW, searchKey } from "@/lib/locale";
import { LocationSelector } from "@/components/location-selector";
import { districtsOfProvince, getDistrict, getProvince, locKey, provinces } from "@/lib/locations";
import { displayText } from "@/lib/text";
import type { Listing, User } from "@/lib/types";
import { useStore } from "@/lib/use-store";

type FeedFilter = "all" | "open" | "hot" | "new" | "commission";
type SortMode = "recommended" | "priceAsc" | "priceDesc" | "commission" | "new";
const SORT_LABELS: Record<SortMode, string> = {
  recommended: "Önerilen",
  priceAsc: "En düşük fiyat",
  priceDesc: "En yüksek fiyat",
  commission: "En yüksek komisyon",
  new: "En yeni"
};
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
  const params = useLocalSearchParams<{ q?: string; province?: string; district?: string }>();
  const { findUser, listings } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [seed, setSeed] = useState(1);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const provinceId = useMemo(() => provinces.find((p) => p.slug === params.province)?.id, [params.province]);
  const districtId = useMemo(() => districtsOfProvince(provinceId).find((d) => d.slug === params.district)?.id, [provinceId, params.district]);
  const [city, setCity] = useState(""); // mobile-only exact city filter
  const [minCommission, setMinCommission] = useState(0);
  const [priceRange, setPriceRange] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [statusOpen, setStatusOpen] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("recommended");
  const [onlyVerified, setOnlyVerified] = useState(false);
  const [productVisible, setProductVisible] = useState(20);
  const [visibleCount, setVisibleCount] = useState(INITIAL_EXPLORE_ITEMS);
  const feedFilters: Array<{ key: FeedFilter; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
    { key: "all", label: t("all"), icon: "grid" },
    { key: "commission", label: "Yüksek komisyon", icon: "cash-plus" },
    { key: "open", label: t("instantPartner"), icon: "flash" },
    { key: "hot", label: t("trend"), icon: "fire" },
    { key: "new", label: t("newest"), icon: "clock-outline" }
  ];
  const isWideWeb = useIsWideWeb();
  const tokens = searchKey(params.q ?? "").split(" ").filter(Boolean);
  const gap = isWideWeb ? 14 : 8;
  const padding = isWideWeb ? 20 : 12;
  const panelWidth = 260;
  const gridArea = isWideWeb ? width - padding * 2 - panelWidth - 20 : width - padding * 2;
  const grid = responsiveGrid({ available: gridArea, gap, minCardWidth: isWideWeb ? 190 : 160 });
  const columns = grid.columns;
  const tileSize = grid.cardWidth;
  const tileHeight = Math.min(isWideWeb ? 320 : 258, Math.round(tileSize * 1.22));

  const marketplaceListings = useMemo(() => {
    const visible = listings.filter((listing) => listing.status !== "draft" && listing.status !== "rejected" && listing.status !== "sold");
    return visible.length ? visible : listings;
  }, [listings]);

  const cities = useMemo(() => Array.from(new Set(marketplaceListings.map((l) => l.location))).sort((a, b) => a.localeCompare(b, "tr")), [marketplaceListings]);
  const provinceName = useMemo(() => (provinceId != null ? getProvince(provinceId)?.name : undefined), [provinceId]);
  const districtName = useMemo(() => (districtId != null ? getDistrict(districtId)?.name : undefined), [districtId]);
  const hasPanelFilter = provinceId != null || Boolean(city) || minCommission > 0 || statusOpen || Boolean(priceRange) || Boolean(stockFilter);

  const activeListings = useMemo(() => {
    const provKey = provinceName ? locKey(provinceName) : "";
    const distKey = districtName ? locKey(districtName) : "";
    const filtered = marketplaceListings
      .filter((listing) => {
        if (city && listing.location !== city) return false;
        if (provKey && !locKey(listing.location).includes(provKey)) return false;
        if (distKey && !locKey(listing.location).includes(distKey)) return false;
        if (minCommission > 0 && commissionAmount(listing) < minCommission) return false;
        if (priceRange) {
          const [mn, mx] = priceRange.split("-");
          const min = Number(mn) || 0;
          const max = mx ? Number(mx) : Infinity;
          if (listing.price < min || listing.price > max) return false;
        }
        if (stockFilter === "in" && listing.stockCount <= 0) return false;
        if (stockFilter === "low" && (listing.stockCount > 5 || listing.stockCount <= 0)) return false;
        if (statusOpen && listing.partnershipMode !== "open") return false;
        if (filter === "open" && listing.partnershipMode !== "open") return false;
        if (filter === "hot" && listing.leadCount + listing.favoriteCount < 50) return false;
        if (filter === "new" && !isNewListing(listing.createdAt)) return false;
        if (tokens.length === 0) return true;
        const owner = findUser(listing.ownerId);
        const haystack = searchKey([listing.title, listing.category, listing.location, listing.description, listing.tags.join(" "), owner?.name].filter(Boolean).join(" "));
        return tokens.every((token) => haystack.includes(token));
      })
      .sort((a, b) => (filter === "commission" ? commissionAmount(b) - commissionAmount(a) : exploreScore(b, seed) - exploreScore(a, seed)));

    if (filtered.length || tokens.length > 0 || filter !== "all" || hasPanelFilter) return filtered;
    return marketplaceListings.sort((a, b) => exploreScore(b, seed) - exploreScore(a, seed));
  }, [city, districtName, filter, findUser, hasPanelFilter, marketplaceListings, minCommission, priceRange, provinceName, seed, statusOpen, stockFilter, tokens]);

  const productListings = useMemo(() => {
    const arr = activeListings.filter((listing) => {
      if (!onlyVerified) return true;
      const owner = findUser(listing.ownerId);
      return Boolean(owner?.verifiedPhone || owner?.verifiedIdentity);
    });
    const sorted = arr.slice();
    if (sortMode === "priceAsc") sorted.sort((a, b) => a.price - b.price);
    else if (sortMode === "priceDesc") sorted.sort((a, b) => b.price - a.price);
    else if (sortMode === "commission") sorted.sort((a, b) => commissionAmount(b) - commissionAmount(a));
    else if (sortMode === "new") sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [activeListings, findUser, onlyVerified, sortMode]);
  const dealListings = useMemo(() => activeListings.slice().sort((a, b) => a.stockCount - b.stockCount).slice(0, 3), [activeListings]);
  const topCommissionListings = useMemo(() => activeListings.slice().sort((a, b) => commissionAmount(b) - commissionAmount(a)).slice(0, 3), [activeListings]);
  const sidebarWidth = 320;
  const productArea = width - padding * 2 - sidebarWidth - 24;
  const productGrid = responsiveGrid({ available: productArea, gap: 16, minCardWidth: 200, maxColumns: 5 });

  const mediaItems = useMemo(() => {
    return activeListings.flatMap((listing) => {
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
  }, [activeListings]);

  const visibleMediaItems = mediaItems.slice(0, visibleCount);
  const rows = useMemo(() => chunk(visibleMediaItems, columns), [visibleMediaItems, columns]);
  const videoCount = mediaItems.filter((item) => item.type === "video").length;
  const openCount = activeListings.filter((listing) => listing.partnershipMode === "open").length;

  useEffect(() => {
    setVisibleCount(INITIAL_EXPLORE_ITEMS);
    setProductVisible(20);
  }, [filter, params.q, city, minCommission, statusOpen, sortMode, onlyVerified, priceRange, stockFilter]);

  function refresh() {
    setRefreshing(true);
    setSeed((value) => value + 1);
    setVisibleCount(INITIAL_EXPLORE_ITEMS);
    setTimeout(() => setRefreshing(false), 420);
  }

  function loadMoreIfNeeded(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceToBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceToBottom < 520) {
      setVisibleCount((current) => Math.min(mediaItems.length, current + EXPLORE_PAGE_SIZE));
    }
  }

  if (isWideWeb) {
    const pills: Array<{ key: FeedFilter | "near"; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
      { key: "all", label: "Tümü", icon: "grid" },
      { key: "hot", label: "Trend", icon: "fire" },
      { key: "new", label: "Yeni", icon: "clock-outline" },
      { key: "commission", label: "En Yüksek Komisyon", icon: "cash-plus" },
      { key: "open", label: "Anında ortak", icon: "flash" }
    ];
    const trust = [
      { icon: "shield-check" as const, label: "Komisyon şartı kayıt altında" },
      { icon: "swap-horizontal" as const, label: "Şeffaf & güvenilir süreç" },
      { icon: "message-text-outline" as const, label: "Satıcıyla güvenli iletişim" },
      { icon: "account-check" as const, label: "Doğrulanmış satıcılar" }
    ];
    const sortOrder: SortMode[] = ["recommended", "priceAsc", "priceDesc", "commission", "new"];
    const visibleProducts = productListings.slice(0, productVisible);

    const seoParts = [params.q, provinceName, districtName].filter(Boolean);
    const seoTitle = seoParts.length ? `${seoParts.join(" ")} ilanları — OrtakSat` : "İlanları Keşfet — OrtakSat";
    const seoDesc = seoParts.length
      ? `${seoParts.join(" ")} için ortak satış ilanları. Ürününü paylaş, satış yapabilecek ortaklarla eşleş.`
      : "Binlerce ortak satış ilanını keşfet. Ürününü paylaş, komisyonu birlikte belirle.";

    return (
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ backgroundColor: colors.background, gap: 16, paddingBottom: 60, paddingHorizontal: padding, paddingTop: 16 }}
        style={{ backgroundColor: colors.background }}
      >
        <Head>
          <title>{seoTitle}</title>
          <meta name="description" content={seoDesc} />
        </Head>
        {/* Banner */}
        <View style={{ backgroundColor: colors.primarySoft, borderRadius: 20, flexDirection: "row", gap: 24, overflow: "hidden", paddingHorizontal: 28, paddingVertical: 26 }}>
          <View style={{ flex: 1.3, gap: 10, justifyContent: "center", minWidth: 0 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>Keşfet, kazanmaya başla</Text>
            <Text style={{ color: colors.ink, fontSize: 28, fontWeight: "900", lineHeight: 34 }}>Binlerce ürün arasından size en uygun fırsatlar burada</Text>
            <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600", lineHeight: 22, maxWidth: 460 }}>Kategorilere göz at, filtreleyin ve komisyonlu ilanlarla kolayca ortak olun.</Text>
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
          {listingCategories.slice(0, 6).map((category) => (
            <Pressable
              key={category.key}
              onPress={() => router.setParams({ q: category.label })}
              style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 4, paddingHorizontal: 14, paddingVertical: 9 }}
            >
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{category.shortLabel}</Text>
              <MaterialCommunityIcons name="chevron-down" size={15} color={colors.muted} />
            </Pressable>
          ))}
        </View>

        {/* Location filter */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 8, padding: 12, position: "relative", zIndex: 60 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
            <MaterialCommunityIcons name="map-marker-radius" size={17} color={colors.primary} />
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>Konum</Text>
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
            onPress={() => { setPriceRange(""); setMinCommission(0); router.setParams({ province: undefined, district: undefined }); setStockFilter(""); setStatusOpen(false); setOnlyVerified(false); setFilter("all"); }}
            style={{ alignItems: "center", backgroundColor: hasPanelFilter ? colors.primarySoft : colors.surfaceAlt, borderColor: hasPanelFilter ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <MaterialCommunityIcons name="filter-variant" size={15} color={colors.primaryDark} />
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{hasPanelFilter ? "Filtreleri temizle" : "Tüm Filtreler"}</Text>
          </Pressable>
          <FilterDropdown label="Fiyat Aralığı" value={priceRange} onSelect={(v) => setPriceRange(String(v))} options={[
            { label: "Tümü", value: "" },
            { label: "0 - ₺1.000", value: "0-1000" },
            { label: "₺1.000 - ₺5.000", value: "1000-5000" },
            { label: "₺5.000 - ₺20.000", value: "5000-20000" },
            { label: "₺20.000+", value: "20000-" }
          ]} />
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
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>Sadece onaylı satıcılar</Text>
          </Pressable>
          <View style={{ flex: 1 }} />
          <Pressable
            onPress={() => setSortMode(sortOrder[(sortOrder.indexOf(sortMode) + 1) % sortOrder.length])}
            style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 8 }}
          >
            <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>Sırala:</Text>
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{SORT_LABELS[sortMode]}</Text>
            <MaterialCommunityIcons name="chevron-down" size={16} color={colors.muted} />
          </Pressable>
        </View>

        {/* Main + sidebar */}
        <View style={{ flexDirection: "row", gap: 24, alignItems: "flex-start", position: "relative", zIndex: 1 }}>
          <View style={{ flex: 1, gap: 14, minWidth: 0 }}>
            <View style={{ alignItems: "flex-end", flexDirection: "row", gap: 10, justifyContent: "space-between" }}>
              <View style={{ gap: 2 }}>
                <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>Öne çıkan ilanlar</Text>
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>Sizin için seçilmiş en iyi ortaklık fırsatları</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{productListings.length} ilan bulundu</Text>
            </View>

            {visibleProducts.length === 0 ? (
              <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 8, padding: 40 }}>
                <MaterialCommunityIcons name="magnify-close" size={32} color={colors.primary} />
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{t("noResults")}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{t("retrySearchFilter")}</Text>
              </View>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                {visibleProducts.map((listing) => (
                  <ListingCard key={listing.id} listing={listing} owner={findUser(listing.ownerId)} width={productGrid.cardWidth} />
                ))}
              </View>
            )}

            {visibleProducts.length < productListings.length ? (
              <Pressable onPress={() => setProductVisible((c) => c + 20)} style={{ alignItems: "center", alignSelf: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 28, paddingVertical: 12 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>Daha fazla göster</Text>
              </Pressable>
            ) : null}
          </View>

          {/* Sidebar */}
          <View style={{ gap: 16, width: sidebarWidth }}>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>Bugünün fırsatları</Text>
                <CountdownBadge />
              </View>
              {dealListings.map((listing) => (
                <SidebarListing key={listing.id} listing={listing} owner={findUser(listing.ownerId)} showStock />
              ))}
              <Link href="/explore" asChild>
                <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                  <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>Tüm fırsatları gör</Text>
                  <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primaryDark} />
                </Pressable>
              </Link>
            </View>

            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Yüksek komisyonlu ilanlar</Text>
              {topCommissionListings.map((listing) => (
                <SidebarListing key={listing.id} listing={listing} owner={findUser(listing.ownerId)} />
              ))}
              <Pressable onPress={() => setFilter("commission")} style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>Tümünü gör</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primaryDark} />
              </Pressable>
            </View>

            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: 16 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Neden Ortaksat?</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
                {[
                  { icon: "shield-check" as const, value: "%100", label: "Güvenli İletişim" },
                  { icon: "headset" as const, value: "7/24", label: "Canlı Destek" },
                  { icon: "account-group" as const, value: "10.000+", label: "Aktif Satıcı" },
                  { icon: "handshake" as const, value: "200.000+", label: "Başarılı Ortaklık" }
                ].map((item) => (
                  <View key={item.label} style={{ alignItems: "center", flexBasis: 120, flexGrow: 1, gap: 4 }}>
                    <MaterialCommunityIcons name={item.icon} size={22} color={colors.primary} />
                    <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{item.value}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", textAlign: "center" }}>{item.label}</Text>
                  </View>
                ))}
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
      contentContainerStyle={{ backgroundColor: colors.surface, paddingBottom: 102 }}
      style={{ backgroundColor: colors.surface }}
    >
      <View style={isWideWeb ? { flexDirection: "row", gap: 20, paddingHorizontal: padding, paddingTop: 6, alignItems: "flex-start" } : undefined}>
      {isWideWeb ? (
        <FilterPanel
          cities={cities}
          city={city}
          onCity={setCity}
          minCommission={minCommission}
          onMinCommission={setMinCommission}
          statusOpen={statusOpen}
          onStatusOpen={setStatusOpen}
          onClear={() => { setCity(""); setMinCommission(0); setStatusOpen(false); }}
          width={panelWidth}
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
      </View>

      {mediaItems.length === 0 ? (
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
  statusOpen,
  onStatusOpen,
  onClear,
  width
}: {
  cities: string[];
  city: string;
  onCity: (v: string) => void;
  minCommission: number;
  onMinCommission: (v: number) => void;
  statusOpen: boolean;
  onStatusOpen: (v: boolean) => void;
  onClear: () => void;
  width: number;
}) {
  const commissionPresets = [0, 100, 250, 500];
  const hasFilter = Boolean(city) || minCommission > 0 || statusOpen;
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 18, padding: 16, width }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="filter-variant" size={18} color={colors.primaryDark} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>Filtrele</Text>
        {hasFilter ? (
          <Pressable onPress={onClear}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: "900" }}>Temizle</Text>
          </Pressable>
        ) : null}
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>Durum</Text>
        <Pressable
          onPress={() => onStatusOpen(!statusOpen)}
          style={{ alignItems: "center", backgroundColor: statusOpen ? colors.primarySoft : colors.surfaceAlt, borderColor: statusOpen ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12, paddingVertical: 10 }}
        >
          <MaterialCommunityIcons name={statusOpen ? "checkbox-marked" : "checkbox-blank-outline"} size={18} color={statusOpen ? colors.primary : colors.muted} />
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>Ortak satışa açık</Text>
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>Komisyon (en az)</Text>
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
                  {amount === 0 ? "Tümü" : `₺${amount}+`}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>Şehir</Text>
        <View style={{ gap: 4 }}>
          <Pressable onPress={() => onCity("")} style={{ alignItems: "center", flexDirection: "row", gap: 8, paddingVertical: 6 }}>
            <MaterialCommunityIcons name={city === "" ? "radiobox-marked" : "radiobox-blank"} size={18} color={city === "" ? colors.primary : colors.muted} />
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>Tüm şehirler</Text>
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
    </View>
  );
}

function FilterDropdown({ label, value, options, onSelect, searchable }: { label: string; value: string | number; options: Array<{ label: string; value: string | number }>; onSelect: (value: string | number) => void; searchable?: boolean }) {
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
          {active && selected ? selected.label : label}
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
                    placeholder="Şehir ara"
                    placeholderTextColor={colors.muted}
                    autoFocus
                    style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "600", height: 36, paddingVertical: 0 }}
                  />
                </View>
              </View>
            ) : null}
            <ScrollView style={{ maxHeight: searchable ? 260 : undefined }} keyboardShouldPersistTaps="handled">
              {filtered.length === 0 ? (
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", paddingHorizontal: 14, paddingVertical: 10 }}>Sonuç yok</Text>
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
                      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: isSel ? "900" : "600" }}>{opt.label}</Text>
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

function CountdownBadge() {
  const [remaining, setRemaining] = useState("");
  useEffect(() => {
    function tick() {
      const now = new Date();
      const end = new Date(now);
      end.setHours(23, 59, 59, 999);
      const diff = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
      const h = String(Math.floor(diff / 3600)).padStart(2, "0");
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, "0");
      const s = String(diff % 60).padStart(2, "0");
      setRemaining(`${h}:${m}:${s}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 8, paddingVertical: 3 }}>
      <MaterialCommunityIcons name="clock-outline" size={12} color={colors.accent} />
      <Text style={{ color: colors.accent, fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{remaining}</Text>
    </View>
  );
}

function SidebarListing({ listing, owner, showStock }: { listing: Listing; owner?: User; showStock?: boolean }) {
  void owner;
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
            <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "900" }}>Kazanç {money(commission)}</Text>
          </View>
          {showStock ? (
            <Text style={{ color: colors.accent, fontSize: 10, fontWeight: "900" }}>Son {listing.stockCount} stok!</Text>
          ) : (
            <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{displayText(listing.location)}</Text>
          )}
        </View>
      </Pressable>
    </Link>
  );
}

function ExploreTile({ height, item, language, onPress, order, size, t }: { height: number; item: ExploreMedia; language: "tr" | "en"; onPress: () => void; order: number; size: number; t: (key: string) => string }) {
  const { listing } = item;
  const featured = item.index === 0 || order % 12 === 0;
  const conversionScore = listing.leadCount + listing.partnerCount * 2 + Math.round(listing.favoriteCount / 8);
  const status = getExploreStatus(item, listing, featured, conversionScore, t);
  const commission = commissionAmount(listing);
  const subcategory = inferListingSubcategory(listing);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ backgroundColor: colors.line, borderColor: "rgba(16,24,40,0.08)", borderRadius: 8, borderWidth: 1, height, opacity: pressed ? 0.82 : 1, overflow: "hidden", width: size })}>
      <SafeRemoteImage uri={item.type === "video" ? item.poster : item.uri} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={120} />
      <View style={{ backgroundColor: item.type === "video" ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.14)", bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }} />
      {item.type === "video" ? (
        <View style={{ alignItems: "center", justifyContent: "center", left: 0, position: "absolute", right: 0, top: height * 0.34 }}>
          <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 999, height: 30, justifyContent: "center", width: 30 }}>
            <MaterialCommunityIcons name="play" size={19} color={colors.primaryDark} />
          </View>
        </View>
      ) : null}

      <View style={{ left: 8, position: "absolute", right: 8, top: 8 }}>
        <StatusLabel icon={status.icon} label={status.label} tone={status.tone} />
      </View>

      <View style={{ backgroundColor: "rgba(0,0,0,0.58)", borderRadius: 8, bottom: 7, gap: 4, left: 7, paddingHorizontal: 8, paddingVertical: 7, position: "absolute", right: 7 }}>
        <Text numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900", lineHeight: 16, minHeight: 32 }}>
          {displayText(listing.title)}
        </Text>
        <Text numberOfLines={1} style={{ color: "#D8FFF6", fontSize: 10, fontWeight: "900" }}>
          {translateCopy(subcategory, language)}
        </Text>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
          <Text adjustsFontSizeToFit minimumFontScale={0.76} numberOfLines={1} style={{ color: "#FFFFFF", flex: 1, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
            {money(listing.price)}
          </Text>
          <Text adjustsFontSizeToFit minimumFontScale={0.76} numberOfLines={1} style={{ color: "#BFF3E7", flex: 1.2, fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "900", textAlign: "right" }}>
            {t("earning")}: {money(commission)}
          </Text>
        </View>
        <View style={{ gap: 2 }}>
          <InfoRow icon="map-marker" label={`${displayText(listing.location)} / ${listing.stockCount} ${t("stock")}`} />
        </View>
      </View>
    </Pressable>
  );
}

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
  const backgroundColor = tone === "primary" ? "rgba(0,135,111,0.96)" : tone === "warning" ? "rgba(183,121,31,0.96)" : "rgba(17,24,39,0.78)";

  return (
    <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor, borderRadius: 999, flexDirection: "row", gap: 4, justifyContent: "center", maxWidth: "100%", minHeight: 24, paddingHorizontal: 9 }}>
      <MaterialCommunityIcons name={icon} size={11} color="#FFFFFF" />
      <Text adjustsFontSizeToFit minimumFontScale={0.74} numberOfLines={1} style={{ color: "#FFFFFF", flexShrink: 1, fontSize: 10, fontWeight: "900" }}>
        {label}
      </Text>
    </View>
  );
}

function InfoRow({ icon, label, strong }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; strong?: boolean }) {
  return (
    <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: strong ? "rgba(0,135,111,0.92)" : "rgba(255,255,255,0.18)", borderRadius: 999, flexDirection: "row", gap: 4, maxWidth: "100%", minHeight: 20, paddingHorizontal: 7 }}>
      <MaterialCommunityIcons name={icon} size={10} color="#FFFFFF" />
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={{ color: "#FFFFFF", flexShrink: 1, fontSize: 10, fontWeight: "900" }}>
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
  const age = REFERENCE_NOW - date.getTime();
  return Number.isFinite(age) && age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
}

function isVideoUri(uri: string) {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(uri);
}
