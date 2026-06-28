import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { NativeScrollEvent, NativeSyntheticEvent, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { inferListingSubcategory } from "@/lib/categories";
import { commissionAmount, money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { searchKey } from "@/lib/locale";
import { displayText } from "@/lib/text";
import type { Listing } from "@/lib/types";
import { useStore } from "@/lib/use-store";

type FeedFilter = "all" | "open" | "hot" | "new";
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
  const params = useLocalSearchParams<{ q?: string }>();
  const { findUser, listings } = useStore();
  const [refreshing, setRefreshing] = useState(false);
  const [seed, setSeed] = useState(1);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [visibleCount, setVisibleCount] = useState(INITIAL_EXPLORE_ITEMS);
  const feedFilters: Array<{ key: FeedFilter; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }> = [
    { key: "all", label: t("all"), icon: "grid" },
    { key: "open", label: t("instantPartner"), icon: "flash" },
    { key: "hot", label: t("trend"), icon: "fire" },
    { key: "new", label: t("newest"), icon: "clock-outline" }
  ];
  const tokens = searchKey(params.q ?? "").split(" ").filter(Boolean);
  const gap = 8;
  const padding = 12;
  const tileSize = Math.max(150, Math.floor((width - padding * 2 - gap) / 2));
  const tileHeight = Math.min(258, Math.round(tileSize * 1.22));

  const marketplaceListings = useMemo(() => {
    const visible = listings.filter((listing) => listing.status !== "draft" && listing.status !== "rejected" && listing.status !== "sold");
    return visible.length ? visible : listings;
  }, [listings]);

  const activeListings = useMemo(() => {
    const filtered = marketplaceListings
      .filter((listing) => {
        if (filter === "open" && listing.partnershipMode !== "open") return false;
        if (filter === "hot" && listing.leadCount + listing.favoriteCount < 50) return false;
        if (filter === "new" && !isNewListing(listing.createdAt)) return false;
        if (tokens.length === 0) return true;
        const owner = findUser(listing.ownerId);
        const haystack = searchKey([listing.title, listing.category, listing.location, listing.description, listing.tags.join(" "), owner?.name].filter(Boolean).join(" "));
        return tokens.every((token) => haystack.includes(token));
      })
      .sort((a, b) => exploreScore(b, seed) - exploreScore(a, seed));

    if (filtered.length || tokens.length > 0 || filter !== "all") return filtered;
    return marketplaceListings.sort((a, b) => exploreScore(b, seed) - exploreScore(a, seed));
  }, [filter, findUser, marketplaceListings, seed, tokens]);

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
  const rows = useMemo(() => chunk(visibleMediaItems, 2), [visibleMediaItems]);
  const videoCount = mediaItems.filter((item) => item.type === "video").length;
  const openCount = activeListings.filter((listing) => listing.partnershipMode === "open").length;

  useEffect(() => {
    setVisibleCount(INITIAL_EXPLORE_ITEMS);
  }, [filter, params.q]);

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
      <View style={{ gap: 7, paddingBottom: 8, paddingHorizontal: 12, paddingTop: 6 }}>
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
          <View style={{ gap, paddingHorizontal: padding, paddingTop: 2 }}>
            {rows.map((row, rowIndex) => (
              <View key={`row-${rowIndex}`} style={{ flexDirection: "row", gap }}>
                {row.map((item, index) => (
                  <ExploreTile
                    key={`${item.id}-${seed}`}
                    height={tileHeight}
                    item={item}
                    language={language}
                    onPress={() => router.push({ pathname: "/(tabs)/explore-feed/[id]", params: { id: item.listing.id, media: item.id } })}
                    order={rowIndex * 2 + index}
                    size={tileSize}
                    t={t}
                  />
                ))}
                {Array.from({ length: 2 - row.length }).map((_, index) => (
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
    </ScrollView>
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
  const age = Date.now() - date.getTime();
  return Number.isFinite(age) && age >= 0 && age < 7 * 24 * 60 * 60 * 1000;
}

function isVideoUri(uri: string) {
  return /\.(mp4|mov|m4v|webm)(\?|$)/i.test(uri);
}
