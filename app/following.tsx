import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { AuthRequired } from "@/components/auth-gate";
import { colors } from "@/components/colors";
import { ListingCard } from "@/components/listing-card";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { PrimaryButton } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { responsiveGrid, useMounted } from "@/lib/layout";
import { fetchListingsBySellers } from "@/lib/supabase-data";
import type { Listing, User } from "@/lib/types";
import { useNativeRefresh } from "@/lib/use-native-refresh";
import { useStore } from "@/lib/use-store";

export default function FollowingScreen() {
  const { language } = useLanguage();
  const { isAuthenticated } = useStore();
  const mounted = useMounted();
  if (!mounted) return <ScreenSkeleton />;
  if (!isAuthenticated) {
    return (
      <AuthRequired
        title={translateCopy("Takip ettiklerin için giriş yap", language)}
        body={translateCopy("Takip ettiğin satıcıların yeni ilanları burada toplanır; görmek için giriş yapman gerekir.", language)}
      />
    );
  }
  return <FollowingInner />;
}

function FollowingInner() {
  const { language } = useLanguage();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { currentUser, followedSellerIds, findUser, listings, refreshUserData } = useStore();
  const { refreshing, onRefresh } = useNativeRefresh(refreshUserData);

  const gap = 8;
  const horizontalPadding = 12;
  const cardWidth = responsiveGrid({ available: width - horizontalPadding * 2, gap, minCardWidth: 168, minColumns: 3 }).cardWidth;

  // Takip edilen satıcıların aktif ilanlarını sunucudan getir (bellek penceresinde
  // olmayabilir → beslemesi eksik kalmasın). Yerel listelerle birleştirilir.
  const [feed, setFeed] = useState<Listing[]>([]);
  const [feedUsers, setFeedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    if (followedSellerIds.length === 0) { setFeed([]); setLoading(false); return; }
    void fetchListingsBySellers(followedSellerIds).then((res) => {
      if (!alive) return;
      if (res) { setFeed(res.listings); setFeedUsers(res.users); }
      setLoading(false);
    });
    return () => { alive = false; };
  }, [followedSellerIds]);

  // Sunucu + bellek birleşimi (tekilleştir), yalnız aktif, en yeni önce.
  const byId = new Map<string, Listing>();
  for (const l of listings) if (followedSellerIds.includes(l.ownerId) && l.status === "active") byId.set(l.id, l);
  for (const l of feed) byId.set(l.id, l);
  const items = Array.from(byId.values()).sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));
  const resolveOwner = (ownerId: string) => findUser(ownerId) ?? feedUsers.find((u) => u.id === ownerId);

  return (
    <ScrollView
      style={{ backgroundColor: colors.background, flex: 1 }}
      contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {/* İçerik 1280 ortalı (layout standardı); footer full-bleed + dibe sabit. */}
      <View style={{ alignSelf: "center", gap: 14, maxWidth: 1280, paddingHorizontal: horizontalPadding, paddingTop: 16, width: "100%" }}>
        <View style={{ gap: 4 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
            <MaterialCommunityIcons name="storefront-check-outline" size={24} color={colors.primaryDark} />
            <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>{translateCopy("Takip Ettiklerin", language)}</Text>
          </View>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>
            {followedSellerIds.length > 0
              ? `${followedSellerIds.length} ${translateCopy("satıcı takip ediyorsun · yeni ilanları burada", language)}`
              : translateCopy("Takip ettiğin satıcıların yeni ilanları burada toplanır.", language)}
          </Text>
        </View>

        {loading ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
            {[0, 1, 2, 3].map((i) => <View key={i} style={{ backgroundColor: colors.surfaceAlt, borderRadius: 14, height: 210, width: cardWidth }} />)}
          </View>
        ) : followedSellerIds.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, gap: 14, paddingHorizontal: 20, paddingVertical: 30 }}>
            <View style={{ alignItems: "center", alignSelf: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 62, justifyContent: "center", width: 62 }}>
              <MaterialCommunityIcons name="storefront-plus-outline" size={30} color={colors.primaryDark} />
            </View>
            <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900", textAlign: "center" }}>{translateCopy("Takip listen boş", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20, maxWidth: 460, alignSelf: "center", textAlign: "center" }}>{translateCopy("Beğendiğin satıcıların mağaza sayfasından 'Takip Et' ile takip et; yeni ilanları burada ve bildirimlerinde görünsün.", language)}</Text>
            <View style={{ alignItems: "center", marginTop: 2 }}>
              <PrimaryButton tone="secondary" icon="compass-outline" onPress={() => router.push("/explore")}>{translateCopy("Satıcıları keşfet", language)}</PrimaryButton>
            </View>
          </View>
        ) : items.length === 0 ? (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, gap: 12, paddingHorizontal: 20, paddingVertical: 30 }}>
            <View style={{ alignItems: "center", alignSelf: "center", backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 56, justifyContent: "center", width: 56 }}>
              <MaterialCommunityIcons name="clock-outline" size={26} color={colors.muted} />
            </View>
            <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900", textAlign: "center" }}>{translateCopy("Yeni ilan yok", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20, maxWidth: 460, alignSelf: "center", textAlign: "center" }}>{translateCopy("Takip ettiğin satıcıların şu an aktif ilanı yok. Yeni ilan yayınladıklarında bildirim alacaksın.", language)}</Text>
          </View>
        ) : (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
            {items.map((listing) => <ListingCard key={listing.id} listing={listing} owner={resolveOwner(listing.ownerId)} width={cardWidth} />)}
          </View>
        )}
      </View>

      <WebFooter />
    </ScrollView>
  );
}
