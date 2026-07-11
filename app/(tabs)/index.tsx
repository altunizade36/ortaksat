import { MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Link, useRouter, type Href } from "expo-router";
import { Mascot } from "@/components/brand/Mascot";
import { useLocalSearchParams } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { HomeDesktop } from "@/components/home-desktop";
import { HowItWorksStrip } from "@/components/how-it-works-strip";
import { ListingCard } from "@/components/listing-card";
import { MarketplaceRetry } from "@/components/marketplace-retry";
import { SkeletonGrid } from "@/components/skeleton";
import { getRecent } from "@/lib/recent";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { EmptyState } from "@/components/ui";
import type { CategoryNode } from "@/lib/category-tree";
import { WebFooter } from "@/components/web-landing";
import { getCategoryIcon, getCategoryShortLabel } from "@/lib/categories";
import { commissionAmount, money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { responsiveGrid, useIsWideWeb } from "@/lib/layout";
import { searchKey } from "@/lib/locale";
import type { Listing, User } from "@/lib/types";
import { useStore } from "@/lib/use-store";

type SortMode = "featured" | "commission" | "newest";
type FilterKey = "all" | "trending" | "open" | "highCommission" | "lowStock" | string;
type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
const INITIAL_HOME_ITEMS = 18;
const HOME_PAGE_SIZE = 12;

export default function HomeScreen() {
  const { language, t } = useLanguage();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const { categoryTree, currentUser, findUser, listings, loadMoreMarketplace, marketplaceHasMore, marketplaceInitialLoading, marketplaceLoadFailed, refreshMarketplace, retryMarketplace } = useStore();
  const query = params.q ?? "";
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortMode, setSortMode] = useState<SortMode>("featured");
  const [refreshing, setRefreshing] = useState(false);
  const [gridWidth, setGridWidth] = useState(0);
  const [visibleCount, setVisibleCount] = useState(INITIAL_HOME_ITEMS);
  // Vitrin çeşitliliği: her girişte/yenilemede ürünler farklı sırada gelsin
  // (ama gezerken sabit — anlık karışma yok). SSG uyumu için seed mount SONRASI verilir
  // (seed=0 iken deterministik momentum sırası → hydration mismatch yok).
  const [shuffleSeed, setShuffleSeed] = useState(0);
  useEffect(() => { setShuffleSeed(Math.floor(Math.random() * 1e9) + 1); }, []);
  const [mountedGate, setMountedGate] = useState(false);
  useEffect(() => { setMountedGate(true); }, []);
  // Son gezilen ilanlar (localStorage, istemci-only — SSG hydration güvenli).
  const [recentIds, setRecentIds] = useState<string[]>([]);
  useEffect(() => { setRecentIds(getRecent()); }, []);
  const quickFilters: Array<{ key: FilterKey; label: string; icon: IconName }> = useMemo(() => [
    { key: "all", label: t("all"), icon: "view-grid" },
    { key: "trending", label: t("trend"), icon: "fire" },
    { key: "open", label: t("instantPartner"), icon: "flash" },
    { key: "highCommission", label: t("profitable"), icon: "cash-plus" },
    { key: "lowStock", label: t("lowStock"), icon: "package-variant-closed" }
  ], [t]);
  const sortLabels: Record<SortMode, string> = {
    featured: t("featured"),
    commission: t("earning"),
    newest: t("newest")
  };
  const isWideWeb = useIsWideWeb();
  const isWeb = Platform.OS === "web";
  const horizontalPadding = isWideWeb ? 20 : 12;
  const columnGap = isWideWeb ? 14 : 10;
  const measuredGridWidth = gridWidth || width - horizontalPadding * 2;
  const { cardWidth } = responsiveGrid({ available: measuredGridWidth, gap: columnGap, minCardWidth: isWideWeb ? 176 : 168 });
  const activeListings = useMemo(() => listings.filter((listing) => listing.status === "active"), [listings]);
  const categories = useMemo(() => Array.from(new Set(activeListings.map((listing) => listing.category))), [activeListings]);
  const filters = useMemo(() => [...quickFilters, ...categories.map((item) => ({ key: `cat:${item}`, label: translateCopy(getCategoryShortLabel(item), language), icon: getCategoryIcon(item) }))], [categories, language, quickFilters]);
  const maxCommission = useMemo(() => activeListings.reduce((max, listing) => Math.max(max, commissionAmount(listing)), 0), [activeListings]);
  const maxMomentum = useMemo(() => activeListings.reduce((max, listing) => Math.max(max, momentumScore(listing)), 0), [activeListings]);
  const topEarn = useMemo(() => activeListings.filter((l) => commissionAmount(l) > 0).slice().sort((a, b) => commissionAmount(b) - commissionAmount(a)).slice(0, 10), [activeListings]);
  const recentListings = useMemo(() => recentIds.map((id) => listings.find((l) => l.id === id)).filter((l): l is Listing => Boolean(l) && l!.status === "active").slice(0, 10), [recentIds, listings]);
  const newestListings = useMemo(() => [...activeListings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 10), [activeListings]);

  function refresh() {
    setRefreshing(true);
    // Yenilemede vitrini de tazele: yeni seed → ürünler farklı sırada dizilir.
    setShuffleSeed(Math.floor(Math.random() * 1e9) + 1);
    // Gerçek yeniden yükleme: katalog snapshot'ını Supabase'den tekrar çek.
    Promise.resolve(refreshMarketplace()).finally(() => setRefreshing(false));
  }

  const filteredListings = useMemo(() => {
    const tokens = searchKey(query).split(" ").filter(Boolean);

    return activeListings
      .filter((listing) => {
        if (filter.startsWith("cat:")) return listing.category === filter.replace("cat:", "");
        if (filter === "trending") return momentumScore(listing) >= Math.max(18, maxMomentum * 0.55);
        if (filter === "open") return listing.partnershipMode === "open";
        if (filter === "highCommission") return commissionAmount(listing) >= Math.max(250, maxCommission * 0.6);
        if (filter === "lowStock") return listing.stockCount <= 5;
        return true;
      })
      .map((listing) => {
        const owner = findUser(listing.ownerId);
        return { listing, score: searchScore(listing, owner, tokens) };
      })
      .filter((item) => tokens.length === 0 || item.score > 0)
      .sort((a, b) => {
        if (tokens.length > 0 && b.score !== a.score) return b.score - a.score;
        const feat = Number(Boolean(b.listing.featured)) - Number(Boolean(a.listing.featured));
        if (feat !== 0) return feat;
        if (sortMode === "commission") return commissionAmount(b.listing) - commissionAmount(a.listing);
        if (sortMode === "newest") return b.listing.createdAt.localeCompare(a.listing.createdAt);
        // Öne çıkan (varsayılan): arama yokken oturum-seed'li deterministik karışım —
        // her girişte farklı, oturum içinde sabit. seed=0 iken momentum sırası (SSG güvenli).
        if (tokens.length === 0 && shuffleSeed) return shuffleRank(a.listing.id, shuffleSeed) - shuffleRank(b.listing.id, shuffleSeed);
        return momentumScore(b.listing) - momentumScore(a.listing);
      })
      .map((item) => item.listing);
  }, [activeListings, filter, findUser, maxCommission, maxMomentum, query, shuffleSeed, sortMode]);
  const visibleListings = filteredListings.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(INITIAL_HOME_ITEMS);
  }, [filter, query, sortMode]);

  function showMore() {
    if (visibleCount < filteredListings.length) {
      setVisibleCount((current) => Math.min(filteredListings.length, current + HOME_PAGE_SIZE));
    } else if (marketplaceHasMore) {
      loadMoreMarketplace();
      setVisibleCount((current) => current + HOME_PAGE_SIZE);
    }
  }

  // KENAR-tetiklemeli daha-fazla-yükle: her scroll karesinde değil, dibe her
  // yaklaşımda BİR KEZ tetiklenir (setState fırtınası + takılma önlenir).
  const loadMoreArmed = useRef(true);
  function loadMoreIfNeeded(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceToBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceToBottom > 900) loadMoreArmed.current = true; // dibe uzakken yeniden kur
    if (distanceToBottom < 600 && loadMoreArmed.current && hasMoreToShow) {
      loadMoreArmed.current = false;
      showMore();
    }
  }

  const hasMoreToShow = visibleListings.length < filteredListings.length || marketplaceHasMore;

  // SSG hidrasyon uyuşmazlığını (#418) önler: sunucu + ilk istemci render'ı bu
  // DETERMİNİSTİK SEO iskeletini gösterir (birebir eşleşir → temiz hidrasyon),
  // mount sonrası gerçek ana sayfa (masaüstü/mobil düzen) render edilir.
  if (isWeb && !mountedGate) {
    return <HomeSeoSkeleton />;
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      onScroll={loadMoreIfNeeded}
      scrollEventThrottle={16}
      contentContainerStyle={{ gap: 10, padding: horizontalPadding, paddingBottom: isWideWeb ? 0 : isWeb ? 28 : 100 }}
    >
      <Head>
        <title>OrtakSat — Komisyonla Ortak Satış Platformu | İlan Ver, Ortak Ol Kazan</title>
        <meta name="description" content="OrtakSat: ürününü ücretsiz listele, komisyonunu belirle; ortaklar referans linkiyle paylaşıp senin için satsın. Sıfır sermaye ile ortak ol, satışta komisyon kazan. Emlak, telefon, bilgisayar, giyim, ev ve daha fazlası." />
        <link rel="canonical" href="https://www.ortaksat.com/" />
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="OrtakSat" />
        <meta property="og:locale" content="tr_TR" />
        <meta property="og:title" content="OrtakSat — Komisyonla Ortak Satış Platformu" />
        <meta property="og:description" content="Ürününü ücretsiz listele, komisyonunu belirle; ortaklar senin için satsın. Sıfır sermaye ile ortak ol, satışta komisyon kazan." />
        <meta property="og:url" content="https://www.ortaksat.com/" />
        <meta property="og:image" content="https://www.ortaksat.com/og-cover.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="OrtakSat — Komisyonla Ortak Satış Platformu" />
        <meta name="twitter:description" content="Ürününü ücretsiz listele; ortaklar senin için satsın. Sıfır sermaye ile ortak ol, kazan." />
        <meta name="twitter:image" content="https://www.ortaksat.com/og-cover.png" />
      </Head>
      {isWideWeb ? (
        <>
          <HomeDesktop />
          <WebFooter />
        </>
      ) : (
        <>
          {/* Kompakt turkuaz hero (mobil) — web ile tutarlı: tokalaşma + ürün kümesi */}
          <LinearGradient colors={["#14B8C4", "#0EA5B7", "#0891B2"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ alignItems: "center", borderRadius: 16, flexDirection: "row", gap: 10, overflow: "hidden", padding: 16 }}>
            <View style={{ flex: 1, gap: 10, minWidth: 0 }}>
              <Text accessibilityRole="header" {...({ role: "heading", "aria-level": 1 } as Record<string, unknown>)} style={{ color: "#FFFFFF", fontSize: 19, fontWeight: "900", lineHeight: 24 }}>{translateCopy("Ortak alın, ", language)}<Text style={{ color: colors.gold }}>{translateCopy("kazancınızı katlayın!", language)}</Text></Text>
              <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600", lineHeight: 16 }}>{translateCopy("Ürününü ortaklar paylaşsın, satışta komisyon kazan.", language)}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                <Link href="/create" asChild>
                  <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 9 }}>
                    <MaterialCommunityIcons name="store-plus-outline" size={16} color={colors.primaryDark} />
                    <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("İlan Ver", language)}</Text>
                  </Pressable>
                </Link>
                <Link href="/partner" asChild>
                  <Pressable style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.16)", borderColor: "rgba(255,255,255,0.5)", borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 8 }}>
                    <MaterialCommunityIcons name="handshake-outline" size={16} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Ortak Ol", language)}</Text>
                  </Pressable>
                </Link>
              </View>
            </View>
            <MobileHeroCluster />
          </LinearGradient>
          <CategoryShowcase categoryTree={categoryTree} isWideWeb={false} />

          {/* 3 Adımda OrtakSat — gerçek/görsel nasıl-çalışır + güven şeridi (mobil ilk-izlenim) */}
          <HowItWorksStrip />

          {/* En çok kazandıran fırsatlar (mobil şerit) */}
          {topEarn.length > 0 ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("En Çok Kazandıran Fırsatlar", language)}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 12 }}>
                {topEarn.map((l) => (
                  <Pressable key={l.id} onPress={() => router.push(`/listing/${l.id}`)} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, overflow: "hidden", width: 140 }}>
                    <View style={{ height: 90, width: "100%" }}>
                      <SafeRemoteImage uri={l.image} alt={l.title} accessibilityLabel={l.title} style={{ height: 90, width: "100%" }} contentFit="cover" />
                      <View style={{ backgroundColor: colors.gold, borderRadius: 6, left: 7, paddingHorizontal: 6, paddingVertical: 2, position: "absolute", top: 7 }}>
                        <Text style={{ color: "#1A1400", fontSize: 9, fontWeight: "900" }}>{translateCopy("Kazanç", language)} {money(commissionAmount(l))}</Text>
                      </View>
                    </View>
                    <View style={{ gap: 3, padding: 8 }}>
                      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{l.title}</Text>
                      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{money(l.price)}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {recentListings.length >= 3 ? (
            <View style={{ gap: 8 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Son Gezdiklerin", language)}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 12 }}>
                {recentListings.map((l) => (
                  <Pressable key={l.id} accessibilityRole="button" accessibilityLabel={l.title} onPress={() => router.push(`/listing/${l.id}`)} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, overflow: "hidden", width: 140 }}>
                    <SafeRemoteImage uri={l.image} alt={l.title} accessibilityLabel={l.title} style={{ height: 90, width: "100%" }} contentFit="cover" />
                    <View style={{ gap: 3, padding: 8 }}>
                      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{l.title}</Text>
                      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{money(l.price)}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          {newestListings.length >= 4 ? (
            <View style={{ gap: 8 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                <MaterialCommunityIcons name="new-box" size={17} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("En Yeni İlanlar", language)}</Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 12 }}>
                {newestListings.map((l) => (
                  <Pressable key={l.id} accessibilityRole="button" accessibilityLabel={l.title} onPress={() => router.push(`/listing/${l.id}`)} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, overflow: "hidden", width: 140 }}>
                    <View style={{ height: 90, width: "100%" }}>
                      <SafeRemoteImage uri={l.image} alt={l.title} accessibilityLabel={l.title} style={{ height: 90, width: "100%" }} contentFit="cover" />
                      <View style={{ backgroundColor: colors.primary, borderRadius: 6, left: 7, paddingHorizontal: 6, paddingVertical: 2, position: "absolute", top: 7 }}>
                        <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "900" }}>{translateCopy("YENİ", language)}</Text>
                      </View>
                    </View>
                    <View style={{ gap: 3, padding: 8 }}>
                      <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{l.title}</Text>
                      <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "900" }}>{money(l.price)}</Text>
                    </View>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          ) : null}

          <HomeQuickActions currentUserId={currentUser.id} />

          <View style={{ gap: 7 }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingRight: 12 }}>
              {filters.map((item) => (
                <FilterChip key={item.key} label={item.label} icon={item.icon} active={item.key === filter} onPress={() => setFilter(item.key)} />
              ))}
            </ScrollView>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 12 }}>
              {(Object.keys(sortLabels) as SortMode[]).map((item) => (
                <SortChip key={item} active={sortMode === item} label={sortLabels[item]} onPress={() => setSortMode(item)} />
              ))}
            </ScrollView>
          </View>

          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 19, fontWeight: "900" }}>{t("marketListings")}</Text>
            <Text selectable style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>
              {filteredListings.length} {t("results")}
            </Text>
          </View>

          {filteredListings.length === 0 ? (
            activeListings.length === 0 && !query ? (
              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 18, borderWidth: 1, gap: 12, paddingHorizontal: 20, paddingVertical: 28 }}>
                <View style={{ alignItems: "center", backgroundColor: colors.surface, borderRadius: 999, height: 60, justifyContent: "center", width: 60 }}>
                  <MaterialCommunityIcons name="rocket-launch-outline" size={30} color={colors.primary} />
                </View>
                <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900", textAlign: "center" }}>{translateCopy("İlk ilanı sen ver", language)}</Text>
                <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20, maxWidth: 420, textAlign: "center" }}>{translateCopy("OrtakSat yeni büyüyor. Ürününü ekle, ortak satıcılarla eşleş ve ilk kazananlardan ol. Yayınlaman ücretsiz.", language)}</Text>
                <Link href="/create" asChild>
                  <Pressable style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, opacity: pressed ? 0.85 : 1, paddingHorizontal: 22, paddingVertical: 13 })}>
                    <MaterialCommunityIcons name="store-plus-outline" size={18} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{translateCopy("Hemen ilan ver", language)}</Text>
                  </Pressable>
                </Link>
              </View>
            ) : (
              <EmptyState title={t("noResults")} body={t("noResultsBody")} mascot="thinking" />
            )
          ) : null}

          <View
            onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
            style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: columnGap, width: "100%" }}
          >
            {visibleListings.length === 0 && marketplaceInitialLoading ? (
              <SkeletonGrid count={6} cardWidth={cardWidth} gap={columnGap} />
            ) : visibleListings.length === 0 && marketplaceLoadFailed ? (
              <MarketplaceRetry onRetry={retryMarketplace} />
            ) : (
              visibleListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} owner={findUser(listing.ownerId)} width={cardWidth} />
              ))
            )}
          </View>

          {hasMoreToShow ? (
            <Pressable onPress={showMore} style={({ pressed }) => ({ alignItems: "center", alignSelf: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 8, marginTop: 4, opacity: pressed ? 0.85 : 1, paddingHorizontal: 26, paddingVertical: 13 })}>
              <MaterialCommunityIcons name="chevron-down" size={18} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Daha fazla ürün göster", language)}</Text>
            </Pressable>
          ) : filteredListings.length > 0 ? (
            <Text selectable style={{ color: colors.subtle, fontSize: 12, fontWeight: "700", textAlign: "center" }}>{translateCopy("Tüm ürünleri gördün", language)} · {filteredListings.length} {translateCopy("ürün", language)}</Text>
          ) : null}

          {isWeb ? <WebFooter /> : null}
        </>
      )}
    </ScrollView>
  );
}

// Sunucu + ilk istemci paint'inde gösterilen DETERMİNİSTİK SEO iskeleti.
// Store/rastgele/tarih/ikon-font İÇERMEZ → server===client → #418 yok. Gerçek h1,
// açıklama, CTA ve kategori iç-bağlantıları taşır (SEO). Mount sonrası gizlenir.
const SKELETON_CATS: Array<{ slug: string; label: string }> = [
  { slug: "emlak", label: "Emlak" },
  { slug: "vasita", label: "Vasıta" },
  { slug: "elektronik", label: "Elektronik" },
  { slug: "ev-yasam", label: "Ev & Yaşam" },
  { slug: "moda", label: "Moda" },
  { slug: "anne-bebek", label: "Anne & Bebek" },
  { slug: "spor-outdoor", label: "Spor & Outdoor" },
  { slug: "hobi-oyun", label: "Hobi & Oyun" }
];

function HomeSeoSkeleton() {
  const { language } = useLanguage();
  return (
    <View style={{ backgroundColor: colors.background, flex: 1, paddingHorizontal: 20, paddingTop: 22 }}>
      <Head>
        <title>OrtakSat — Komisyonla Ortak Satış Platformu | İlan Ver, Ortak Ol Kazan</title>
        <meta name="description" content="OrtakSat: ürününü ücretsiz listele, komisyonunu belirle; ortaklar referans linkiyle paylaşıp senin için satsın. Sıfır sermaye ile ortak ol, satışta komisyon kazan." />
        <link rel="canonical" href="https://www.ortaksat.com/" />
      </Head>
      <View style={{ alignSelf: "center", gap: 16, maxWidth: 900, width: "100%" }}>
        <Text accessibilityRole="header" {...({ role: "heading", "aria-level": 1 } as Record<string, unknown>)} style={{ color: colors.ink, fontSize: 34, fontWeight: "900", lineHeight: 40 }}>
          {translateCopy("Ürününü ortak satışa aç, ", language)}<Text style={{ color: colors.primary }}>{translateCopy("satışta komisyon kazan.", language)}</Text>
        </Text>
        <Text style={{ color: colors.muted, fontSize: 16, fontWeight: "600", lineHeight: 24, maxWidth: 640 }}>
          {translateCopy("Ürününü ücretsiz listele, komisyonunu belirle; ortaklar referans linkiyle paylaşıp senin için satsın. Sıfır sermaye ile ortak ol, satışta komisyon kazan. Emlak, vasıta, elektronik, ev & yaşam, moda ve daha fazlası tek platformda.", language)}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <Link href="/create" asChild>
            <Pressable style={{ backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 14 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{translateCopy("İlan Ver", language)}</Text>
            </Pressable>
          </Link>
          <Link href="/partner" asChild>
            <Pressable style={{ backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 24, paddingVertical: 14 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>{translateCopy("Ortak Satıcı Ol", language)}</Text>
            </Pressable>
          </Link>
        </View>
        <Text accessibilityRole="header" {...({ role: "heading", "aria-level": 2 } as Record<string, unknown>)} style={{ color: colors.ink, fontSize: 18, fontWeight: "900", marginTop: 6 }}>
          {translateCopy("Kategoriler", language)}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {SKELETON_CATS.map((c) => (
            <Link key={c.slug} href={`/kategori/${c.slug}`} asChild>
              <Pressable style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10 }}>
                <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy(c.label, language)}</Text>
              </Pressable>
            </Link>
          ))}
        </View>
      </View>
    </View>
  );
}

function momentumScore(listing: Listing) {
  return listing.leadCount * 2 + listing.partnerCount + listing.favoriteCount / 10;
}

// (id, seed) -> deterministik pseudo-random sıra anahtarı (FNV-1a benzeri).
// Aynı seed'de sabit sıra; seed değişince (yeni giriş/yenileme) sıra tamamen değişir.
function shuffleRank(id: string, seed: number) {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619) >>> 0;
  return h >>> 0;
}

function searchScore(listing: Listing, owner: User | undefined, tokens: string[]) {
  if (tokens.length === 0) return 1;

  const fields = [
    { value: listing.title, weight: 9 },
    { value: listing.category, weight: 7 },
    { value: listing.location, weight: 6 },
    { value: listing.tags.join(" "), weight: 5 },
    { value: owner?.name ?? "", weight: 4 },
    { value: listing.description, weight: 2 },
    { value: listing.salesPitch.join(" "), weight: 2 }
  ];

  let score = 0;
  for (const token of tokens) {
    let tokenScore = 0;
    for (const field of fields) {
      const key = searchKey(field.value);
      if (key === token) tokenScore = Math.max(tokenScore, field.weight + 4);
      else if (key.startsWith(token)) tokenScore = Math.max(tokenScore, field.weight + 2);
      else if (key.includes(token)) tokenScore = Math.max(tokenScore, field.weight);
    }
    if (tokenScore === 0) return 0;
    score += tokenScore;
  }

  return score;
}

function HomeQuickActions({ currentUserId }: { currentUserId: string }) {
  const { language } = useLanguage();
  const actions: Array<{ href: Href; icon: IconName; label: string; tone: "primary" | "soft" | "plain" }> = [
    { href: "/create", icon: "store-plus-outline", label: "İlan ver", tone: "primary" },
    { href: "/(tabs)/partner", icon: "handshake-outline", label: "Ortak ol", tone: "soft" },
    { href: { pathname: "/store/[id]", params: { id: currentUserId } }, icon: "store-search-outline", label: "Mağazam", tone: "plain" }
  ];

  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {actions.map((action) => (
        <Link key={action.label} href={action.href} asChild>
          <Pressable
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: action.tone === "primary" ? colors.primary : action.tone === "soft" ? colors.primarySoft : colors.surface,
              borderColor: action.tone === "plain" ? colors.line : action.tone === "soft" ? colors.primarySoft : colors.primary,
              borderRadius: 10,
              borderWidth: 1,
              flex: 1,
              flexDirection: "row",
              gap: 7,
              justifyContent: "center",
              minHeight: 44,
              opacity: pressed ? 0.76 : 1,
              paddingHorizontal: 8
            })}
          >
            <MaterialCommunityIcons name={action.icon} size={18} color={action.tone === "primary" ? "#FFFFFF" : colors.primaryDark} />
            <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={{ color: action.tone === "primary" ? "#FFFFFF" : colors.ink, flexShrink: 1, fontSize: 12, fontWeight: "900" }}>
              {translateCopy(action.label, language)}
            </Text>
          </Pressable>
        </Link>
      ))}
    </View>
  );
}

function CategoryShowcase({ categoryTree, isWideWeb }: { categoryTree: CategoryNode[]; isWideWeb: boolean }) {
  const { language } = useLanguage();
  const cats = categoryTree.slice(0, isWideWeb ? 12 : 10);
  if (cats.length === 0) return null;

  const Tile = ({ node }: { node: CategoryNode }) => (
    <Link href={{ pathname: "/kategori/[slug]", params: { slug: node.slug ?? node.key } }} asChild>
      <Pressable style={({ pressed }) => ({ alignItems: "center", gap: 7, opacity: pressed ? 0.75 : 1, width: isWideWeb ? undefined : 78 })}>
        <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, height: isWideWeb ? 72 : 64, justifyContent: "center", overflow: "hidden", width: isWideWeb ? 72 : 64 }}>
          {node.image ? (
            <SafeRemoteImage uri={node.image} alt={`${node.label} kategorisi`} accessibilityLabel={`${node.label} kategorisi`} style={{ height: "100%", width: "100%" }} contentFit="cover" />
          ) : (
            <MaterialCommunityIcons name={getCategoryIcon(node.label)} size={28} color={colors.primary} />
          )}
        </View>
        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 11.5, fontWeight: "800", maxWidth: isWideWeb ? 88 : 78, textAlign: "center" }}>
          {translateCopy(getCategoryShortLabel(node.label), language)}
        </Text>
      </Pressable>
    </Link>
  );

  return (
    <View style={{ gap: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text style={{ color: colors.ink, flex: 1, fontSize: isWideWeb ? 20 : 17, fontWeight: "900" }}>{translateCopy("Kategorilere göz at", language)}</Text>
        <Link href="/kategoriler" asChild>
          <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 3 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "900" }}>{translateCopy("Tümü", language)}</Text>
            <MaterialCommunityIcons name="arrow-right" size={16} color={colors.primaryDark} />
          </Pressable>
        </Link>
      </View>
      {isWideWeb ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 18 }}>
          {cats.map((node) => <Tile key={node.key} node={node} />)}
        </View>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 12 }}>
          {cats.map((node) => <Tile key={node.key} node={node} />)}
        </ScrollView>
      )}
    </View>
  );
}

function SortChip({ active, label, onPress }: { active?: boolean; label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: active ? colors.ink : colors.surface,
        borderColor: active ? colors.ink : colors.line,
        borderRadius: 999,
        borderWidth: 1,
        justifyContent: "center",
        minHeight: 36,
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: 14
      })}
    >
      <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} selectable style={{ color: active ? "#FFFFFF" : colors.ink, fontSize: 13, fontWeight: "900" }}>
        {label}
      </Text>
    </Pressable>
  );
}

function FilterChip({ active, icon, label, onPress }: { active?: boolean; icon: IconName; label: string; onPress: () => void }) {
  const { language } = useLanguage();
  const translatedLabel = translateCopy(label, language);
  const chipWidth = Math.min(178, Math.max(104, translatedLabel.length * 8 + 48));

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: active ? colors.primary : colors.surface,
        borderColor: active ? colors.primary : colors.line,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: "row",
        gap: 6,
        minHeight: 38,
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: 12,
        width: chipWidth
      })}
    >
      <MaterialCommunityIcons name={icon} size={15} color={active ? "#FFFFFF" : colors.primary} style={{ flexShrink: 0 }} />
      <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} ellipsizeMode="tail" style={{ color: active ? "#FFFFFF" : colors.ink, flex: 1, fontSize: 13, fontWeight: "900" }}>
        {translatedLabel}
      </Text>
    </Pressable>
  );
}

// Mobil hero — OrtakSat maskotu (başparmak yukarı), açık daire arkalıkta.
function MobileHeroCluster() {
  return (
    <View style={{ alignItems: "center", height: 128, justifyContent: "center", width: 128 }}>
      <Mascot name="success" size={124} priority panel panelColor="#F0FDFF" />
    </View>
  );
}
