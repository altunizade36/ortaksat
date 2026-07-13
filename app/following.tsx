import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { AuthRequired } from "@/components/auth-gate";
import { colors } from "@/components/colors";
import { ListingCard } from "@/components/listing-card";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { EmptyState, PrimaryButton } from "@/components/ui";
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
      contentContainerStyle={{ paddingBottom: 40 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      <View style={{ gap: 4, paddingHorizontal: horizontalPadding, paddingTop: 14 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <MaterialCommunityIcons name="storefront-check-outline" size={22} color={colors.primaryDark} />
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{translateCopy("Takip ettiklerin", language)}</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>
          {followedSellerIds.length > 0
            ? `${followedSellerIds.length} ${translateCopy("satıcı takip ediyorsun", language)}`
            : translateCopy("Henüz satıcı takip etmiyorsun.", language)}
        </Text>
      </View>

      {loading ? (
        <View style={{ padding: 40 }}><Text style={{ color: colors.muted, fontSize: 13, textAlign: "center" }}>{translateCopy("Yükleniyor…", language)}</Text></View>
      ) : followedSellerIds.length === 0 ? (
        <View style={{ padding: 16 }}>
          <EmptyState
            title={translateCopy("Takip listen boş", language)}
            body={translateCopy("Beğendiğin satıcıların mağaza sayfasından 'Takip Et' ile takip et; yeni ilanları burada ve bildirimlerinde görünsün.", language)}
          />
          <View style={{ alignItems: "center", marginTop: 12 }}>
            <PrimaryButton tone="secondary" icon="compass-outline" onPress={() => router.push("/explore")}>{translateCopy("Satıcıları keşfet", language)}</PrimaryButton>
          </View>
        </View>
      ) : items.length === 0 ? (
        <View style={{ padding: 16 }}>
          <EmptyState
            title={translateCopy("Yeni ilan yok", language)}
            body={translateCopy("Takip ettiğin satıcıların şu an aktif ilanı yok. Yeni ilan yayınladıklarında bildirim alacaksın.", language)}
          />
        </View>
      ) : (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap, paddingHorizontal: horizontalPadding, paddingTop: 12 }}>
          {items.map((listing) => <ListingCard key={listing.id} listing={listing} owner={resolveOwner(listing.ownerId)} width={cardWidth} />)}
        </View>
      )}
      <WebFooter />
    </ScrollView>
  );
}
