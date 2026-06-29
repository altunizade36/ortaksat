import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, type Href } from "expo-router";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Platform, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { ListingCard } from "@/components/listing-card";
import { EmptyState } from "@/components/ui";
import { Marketplace3DHero } from "@/components/three-d-showcase";
import { WebHero } from "@/components/web-hero";
import { WebCategories, WebFooter, WebHowItWorks, WebTrustStrip, WebWhy } from "@/components/web-landing";
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
const INITIAL_HOME_ITEMS = 20;
const HOME_PAGE_SIZE = 16;

export default function HomeScreen() {
  const { language, t } = useLanguage();
  const { width } = useWindowDimensions();
  const params = useLocalSearchParams<{ q?: string }>();
  const { currentUser, findUser, listings } = useStore();
  const query = params.q ?? "";
  const [filter, setFilter] = useState<FilterKey>("all");
  const [sortMode, setSortMode] = useState<SortMode>("featured");
  const [refreshing, setRefreshing] = useState(false);
  const [seed, setSeed] = useState(1);
  const [gridWidth, setGridWidth] = useState(0);
  const [visibleCount, setVisibleCount] = useState(INITIAL_HOME_ITEMS);
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
  const activeListings = listings.filter((listing) => listing.status === "active");
  const categories = useMemo(() => Array.from(new Set(activeListings.map((listing) => listing.category))), [activeListings]);
  const filters = useMemo(() => [...quickFilters, ...categories.map((item) => ({ key: `cat:${item}`, label: translateCopy(getCategoryShortLabel(item), language), icon: getCategoryIcon(item) }))], [categories, language, quickFilters]);
  const maxCommission = activeListings.reduce((max, listing) => Math.max(max, commissionAmount(listing)), 0);
  const maxMomentum = activeListings.reduce((max, listing) => Math.max(max, momentumScore(listing)), 0);
  const topListings = activeListings.slice().sort((a, b) => momentumScore(b) + refreshBoost(b, seed) - (momentumScore(a) + refreshBoost(a, seed))).slice(0, 5);
  const myActiveListings = activeListings.filter((listing) => listing.ownerId === currentUser.id).length;
  const openPartnerListings = activeListings.filter((listing) => listing.partnershipMode === "open").length;
  const cityCount = new Set(activeListings.map((listing) => listing.location)).size;
  const averageCommission = activeListings.length ? Math.round(activeListings.reduce((sum, listing) => sum + commissionAmount(listing), 0) / activeListings.length) : 0;

  function refresh() {
    setRefreshing(true);
    setSeed((value) => value + 1);
    setTimeout(() => setRefreshing(false), 420);
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
        if (sortMode === "commission") return commissionAmount(b.listing) - commissionAmount(a.listing);
        if (sortMode === "newest") return b.listing.createdAt.localeCompare(a.listing.createdAt);
        return momentumScore(b.listing) + refreshBoost(b.listing, seed) - (momentumScore(a.listing) + refreshBoost(a.listing, seed));
      })
      .map((item) => item.listing);
  }, [activeListings, filter, findUser, maxCommission, maxMomentum, query, seed, sortMode]);
  const visibleListings = filteredListings.slice(0, visibleCount);

  useEffect(() => {
    setVisibleCount(INITIAL_HOME_ITEMS);
  }, [filter, query, sortMode]);

  function loadMoreIfNeeded(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    const distanceToBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height);
    if (distanceToBottom < 420) {
      setVisibleCount((current) => Math.min(filteredListings.length, current + HOME_PAGE_SIZE));
    }
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      onScroll={loadMoreIfNeeded}
      scrollEventThrottle={16}
      contentContainerStyle={{ gap: 10, padding: horizontalPadding, paddingBottom: 100 }}
    >
      {isWideWeb ? (
        <>
          <WebHero totalListings={activeListings.length} averageCommission={averageCommission} cityCount={cityCount} />
          <WebTrustStrip />
          <WebCategories />
        </>
      ) : (
        <Marketplace3DHero listings={topListings} />
      )}

      <HomeQuickActions currentUserId={currentUser.id} />

      <MarketplacePulse
        averageCommission={averageCommission}
        cityCount={cityCount}
        myActiveListings={myActiveListings}
        openPartnerListings={openPartnerListings}
        totalListings={activeListings.length}
      />

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
        <Text selectable style={{ color: colors.ink, flex: 1, fontSize: isWideWeb ? 24 : 19, fontWeight: "900" }}>{isWideWeb ? "Öne çıkan ilanlar" : t("marketListings")}</Text>
        {isWideWeb ? (
          <Link href="/explore" asChild>
            <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>Tüm ilanları gör</Text>
              <MaterialCommunityIcons name="arrow-right" size={18} color={colors.primaryDark} />
            </Pressable>
          </Link>
        ) : (
          <Text selectable style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>
            {filteredListings.length} {t("results")}
          </Text>
        )}
      </View>

      {filteredListings.length === 0 ? <EmptyState title={t("noResults")} body={t("noResultsBody")} /> : null}

      <View
        onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
        style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: columnGap, width: "100%" }}
      >
        {visibleListings.map((listing) => (
          <ListingCard key={listing.id} listing={listing} owner={findUser(listing.ownerId)} width={cardWidth} />
        ))}
      </View>

      {visibleListings.length < filteredListings.length ? (
        <Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "800", textAlign: "center" }}>
          {visibleListings.length} / {filteredListings.length} {t("results")}
        </Text>
      ) : null}

      {isWideWeb ? <WebHowItWorks /> : null}
      {isWideWeb ? <WebWhy /> : null}
      {isWeb ? <WebFooter /> : null}
    </ScrollView>
  );
}

function momentumScore(listing: Listing) {
  return listing.leadCount * 2 + listing.partnerCount + listing.favoriteCount / 10;
}

function refreshBoost(listing: Listing, seed: number) {
  return ((listing.id.charCodeAt(listing.id.length - 1) || 0) * 13 + seed * 19) % 37;
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

function MarketplacePulse({
  averageCommission,
  cityCount,
  myActiveListings,
  openPartnerListings,
  totalListings
}: {
  averageCommission: number;
  cityCount: number;
  myActiveListings: number;
  openPartnerListings: number;
  totalListings: number;
}) {
  const { language } = useLanguage();
  const isWideWeb = useIsWideWeb();
  const items = [
    { icon: "tag-multiple-outline" as const, label: "Aktif ürün", value: `${totalListings}` },
    { icon: "flash" as const, label: "Anında ortak", value: `${openPartnerListings}` },
    { icon: "cash-plus" as const, label: "Ort. kazanç", value: money(averageCommission) },
    { icon: "map-marker-outline" as const, label: "Şehir", value: `${cityCount}` }
  ];

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: isWideWeb ? 16 : 10, borderWidth: 1, gap: isWideWeb ? 10 : 8, padding: isWideWeb ? 14 : 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text selectable numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: isWideWeb ? 16 : 14, fontWeight: "900" }}>
          {translateCopy("Canlı pazar özeti", language)}
        </Text>
        <Text selectable numberOfLines={1} style={{ color: colors.primaryDark, fontSize: isWideWeb ? 13 : 11, fontWeight: "900" }}>
          {myActiveListings > 0 ? `${myActiveListings} ${translateCopy("ilanın yayında", language)}` : translateCopy("Ürünler otomatik yenilenir", language)}
        </Text>
      </View>
      <View style={{ flexDirection: "row", gap: isWideWeb ? 12 : 6 }}>
        {items.map((item) =>
          isWideWeb ? (
            <View key={item.label} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 12, flex: 1, flexDirection: "row", gap: 12, minHeight: 72, paddingHorizontal: 16 }}>
              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, height: 40, justifyContent: "center", width: 40 }}>
                <MaterialCommunityIcons name={item.icon} size={20} color={colors.primary} />
              </View>
              <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 22, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
                  {item.value}
                </Text>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
                  {translateCopy(item.label, language)}
                </Text>
              </View>
            </View>
          ) : (
            <View key={item.label} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 8, flex: 1, gap: 4, minHeight: 58, padding: 7 }}>
              <MaterialCommunityIcons name={item.icon} size={15} color={colors.primary} />
              <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
                {item.value}
              </Text>
              <Text adjustsFontSizeToFit minimumFontScale={0.68} numberOfLines={1} style={{ color: colors.muted, fontSize: 9, fontWeight: "800" }}>
                {translateCopy(item.label, language)}
              </Text>
            </View>
          )
        )}
      </View>
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
