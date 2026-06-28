import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { ListingCard } from "@/components/listing-card";
import { EmptyState, Metric, PrimaryButton, StatusPill } from "@/components/ui";
import { money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { responsiveGrid, SHELL_MAX_WIDTH } from "@/lib/layout";
import { calculateUserTrustScores } from "@/lib/trust-score";
import { useStore } from "@/lib/use-store";

type StoreFilter = "active" | "all" | "partner";

export default function StoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language, t } = useLanguage();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { currentUser, findUser, listings, partnerships, leads, reports, reviews, sales, startConversation } = useStore();
  const [filter, setFilter] = useState<StoreFilter>("active");
  const [refreshing, setRefreshing] = useState(false);
  const seller = id ? findUser(id) : undefined;
  const isOwnStore = seller?.id === currentUser.id;
  const trust = seller ? calculateUserTrustScores({ leads, listings, partnerships, reports, reviews, sales, user: seller }) : undefined;
  const sellerListings = useMemo(() => {
    return listings
      .filter((listing) => listing.ownerId === id && listing.status !== "rejected")
      .filter((listing) => {
        if (filter === "active") return listing.status === "active";
        if (filter === "partner") return listing.status === "active" && listing.partnershipMode !== "invite";
        return true;
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [filter, id, listings]);
  const activeListings = listings.filter((listing) => listing.ownerId === id && listing.status === "active");
  const totalCommission = activeListings.reduce((sum, listing) => {
    return sum + (listing.commissionType === "rate" ? Math.round((listing.price * listing.commissionValue) / 100) : listing.commissionValue);
  }, 0);
  const gridGap = 10;
  const cardWidth = responsiveGrid({ available: Math.min(width, SHELL_MAX_WIDTH) - 24, gap: gridGap, minCardWidth: 168 }).cardWidth;

  function refresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 420);
  }

  function messageSeller() {
    if (!seller || isOwnStore) return;
    const firstListing = activeListings[0];
    if (!firstListing) return;
    const conversation = startConversation(firstListing.id, seller.id, `${seller.name} mağazasındaki ürünler için bilgi almak istiyorum.`);
    if (conversation) router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
  }

  if (!seller) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 12 }}>
        <EmptyState title="Mağaza bulunamadı" body="Bu satıcı profili kaldırılmış veya bağlantı geçersiz olabilir." />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      contentContainerStyle={{ gap: 12, padding: 12, paddingBottom: 104 }}
    >
      <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, gap: 12, padding: 14 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
          {isImageAvatar(seller.avatar) ? (
            <Image source={{ uri: seller.avatar }} contentFit="cover" style={{ borderRadius: 14, height: 66, width: 66 }} />
          ) : (
            <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 14, height: 66, justifyContent: "center", width: 66 }}>
              <Text selectable numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "900" }}>
                {seller.avatar || seller.name.slice(0, 2)}
              </Text>
            </View>
          )}
          <View style={{ flex: 1, gap: 5, minWidth: 0 }}>
            <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 21, fontWeight: "900" }}>
              {seller.name}
            </Text>
            <Text selectable numberOfLines={2} style={{ color: colors.muted, fontSize: 13, fontWeight: "800", lineHeight: 18 }}>
              {seller.bio || translateCopy("Satıcı mağazası", language)}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <StatusPill label={`${seller.rating} ${t("points")}`} tone="info" />
              <StatusPill label={seller.verifiedIdentity ? t("identityVerified") : t("identityPending")} tone={seller.verifiedIdentity ? "success" : "warning"} />
            </View>
          </View>
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Metric label={t("activeListing")} value={`${activeListings.length}`} />
          <Metric label={t("sellerTrust")} value={`%${trust?.seller.score ?? 0}`} />
          <Metric label={t("earning")} value={money(totalCommission)} />
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          {isOwnStore ? (
            <View style={{ flex: 1 }}>
              <PrimaryButton href="/create" icon="store-plus-outline">Yeni ilan aç</PrimaryButton>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <PrimaryButton icon="message-text-outline" onPress={messageSeller}>Mağazaya mesaj gönder</PrimaryButton>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <PrimaryButton href={isOwnStore ? "/(tabs)/seller" : "/(tabs)/partner"} tone="secondary" icon={isOwnStore ? "storefront-outline" : "handshake-outline"}>
              {isOwnStore ? "Satıcı paneli" : "Ortaklık ürünleri"}
            </PrimaryButton>
          </View>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        <StoreFilterChip active={filter === "active"} icon="check-circle-outline" label="Aktif" onPress={() => setFilter("active")} />
        <StoreFilterChip active={filter === "partner"} icon="handshake-outline" label="Ortaklığa açık" onPress={() => setFilter("partner")} />
        <StoreFilterChip active={filter === "all"} icon="view-grid-outline" label="Tümü" onPress={() => setFilter("all")} />
      </View>

      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 19, fontWeight: "900" }}>
          {translateCopy("Mağaza ürünleri", language)}
        </Text>
        <Text selectable style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>
          {sellerListings.length} {t("results")}
        </Text>
      </View>

      {sellerListings.length === 0 ? (
        <EmptyState title="Ürün yok" body={isOwnStore ? "İlk ilanını açınca mağazana ve ana pazara otomatik düşer." : "Bu mağazada şu an görünür ürün yok."} />
      ) : (
        <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: gridGap }}>
          {sellerListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} owner={seller} width={cardWidth} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function StoreFilterChip({ active, icon, label, onPress }: { active?: boolean; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  const { language } = useLanguage();

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: active ? colors.primary : colors.surface,
        borderColor: active ? colors.primary : colors.line,
        borderRadius: 999,
        borderWidth: 1,
        flex: 1,
        flexDirection: "row",
        gap: 6,
        justifyContent: "center",
        minHeight: 40,
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: 8
      })}
    >
      <MaterialCommunityIcons name={icon} size={15} color={active ? "#FFFFFF" : colors.primary} />
      <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={{ color: active ? "#FFFFFF" : colors.ink, flexShrink: 1, fontSize: 12, fontWeight: "900" }}>
        {translateCopy(label, language)}
      </Text>
    </Pressable>
  );
}

function isImageAvatar(value: string) {
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("file:");
}
