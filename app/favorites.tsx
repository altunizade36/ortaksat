import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { AuthRequired } from "@/components/auth-gate";
import { ListingCard } from "@/components/listing-card";
import { EmptyState, PrimaryButton } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { commissionAmount } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useNativeRefresh } from "@/lib/use-native-refresh";
import { responsiveGrid, useIsWideWeb, useMounted } from "@/lib/layout";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { searchKey } from "@/lib/locale";
import { matchesQuery } from "@/lib/search";
import { isSupabaseConfigured } from "@/lib/supabase";
import { fetchListingsByIds } from "@/lib/supabase-data";
import type { Listing, User } from "@/lib/types";
import { useStore } from "@/lib/use-store";

function FavoritesScreenInner() {
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const isWideWeb = useIsWideWeb();
  const { currentUser, favorites, findUser, listings, refreshUserData } = useStore();
  const { refreshing, onRefresh } = useNativeRefresh(refreshUserData);
  const [query, setQuery] = useState("");
  const [favTab, setFavTab] = useState<"all" | "open" | "highcomm" | "near" | "recent">("all");
  const [sortMode, setSortMode] = useState<"new" | "priceAsc" | "priceDesc" | "commission">("new");
  const [catFilter, setCatFilter] = useState<string | null>(null); // kenar çubuğundaki kategori listesinden
  // Sanallaştırma penceresi: uzun favori listelerinde ilk PAGE kadar render edilir; native'de
  // tüm kartların birden basılmasını önler (web'de data-vcard zaten off-screen paint'i atlar).
  const PAGE = 24;
  const [visibleCount, setVisibleCount] = useState(PAGE);
  useEffect(() => { setVisibleCount(PAGE); }, [favTab, catFilter, sortMode, query]);
  const horizontalPadding = 12;
  const gap = 8;
  const cardWidth = responsiveGrid({ available: width - horizontalPadding * 2, gap, minCardWidth: 168, minColumns: 3 }).cardWidth;
  const tokens = searchKey(query).split(" ").filter(Boolean);
  const myFavs = favorites.filter((favorite) => favorite.userId === currentUser.id);

  // Bellek penceresi (MP_MAX=600) dışında kalan favori ilanları sunucudan getir → favori
  // sessizce kaybolmaz. Yüklü listelerde bulunanlar için sunucuya gidilmez.
  const [extraListings, setExtraListings] = useState<Map<string, Listing>>(new Map());
  const [extraUsers, setExtraUsers] = useState<Map<string, User>>(new Map());
  const fetchedRef = useRef<Set<string>>(new Set());
  const favIdsKey = myFavs.map((f) => f.listingId).sort().join(",");
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const inMemory = new Set(listings.map((l) => l.id));
    const missing = myFavs.map((f) => f.listingId).filter((id) => !inMemory.has(id) && !fetchedRef.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => fetchedRef.current.add(id));
    let alive = true;
    fetchListingsByIds(missing).then((res) => {
      if (!alive || !res) return;
      if (res.listings.length) setExtraListings((m) => { const n = new Map(m); res.listings.forEach((l) => n.set(l.id, l)); return n; });
      if (res.users.length) setExtraUsers((m) => { const n = new Map(m); res.users.forEach((u) => n.set(u.id, u)); return n; });
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favIdsKey, listings.length]);

  const resolveListing = (id: string): Listing | undefined => listings.find((l) => l.id === id) ?? extraListings.get(id);
  const resolveOwner = (ownerId: string): User | undefined => findUser(ownerId) ?? extraUsers.get(ownerId);
  const favoriteListings = myFavs
    .map((favorite) => resolveListing(favorite.listingId))
    .filter(Boolean);
  // Fiyat düşüşü/artışı göstergesi (spec 75): favoriye eklenen fiyat ile şu anki fiyat.
  const savedPriceById = new Map(myFavs.map((f) => [f.listingId, f.savedPrice]));
  const priceNoteFor = (listingId: string, currentPrice: number) => {
    const saved = savedPriceById.get(listingId);
    if (saved == null || saved <= 0 || saved === currentPrice) return undefined;
    const pct = Math.round((Math.abs(currentPrice - saved) / saved) * 100);
    if (pct < 1) return undefined;
    return { text: `%${pct}`, down: currentPrice < saved };
  };
  const droppedCount = favoriteListings.filter((l) => l && (savedPriceById.get(l.id) ?? 0) > l.price).length;
  // Mobil liste: arama + sekme (favTab) + kategori + sıralama uygulanır (masaüstü
  // paritesi — önceden mobilde yalnız arama vardı).
  const visibleListings = (() => {
    let base = favoriteListings.filter((l): l is Listing => Boolean(l));
    if (tokens.length) base = base.filter((l) => matchesQuery(l, undefined, tokens));
    if (favTab === "open") base = base.filter((l) => l.partnershipMode === "open");
    else if (favTab === "highcomm") base = base.filter((l) => l.commissionType === "rate" && l.commissionValue >= 15);
    if (catFilter) base = base.filter((l) => l.category === catFilter);
    return base.slice().sort((a, b) =>
      sortMode === "priceAsc" ? a.price - b.price
        : sortMode === "priceDesc" ? b.price - a.price
          : sortMode === "commission" ? commissionAmount(b) - commissionAmount(a)
            : b.createdAt.localeCompare(a.createdAt)
    );
  })();

  if (isWideWeb) {
    const myFavs = favoriteListings.filter(Boolean) as Listing[];
    const base = myFavs; // yalnızca gerçek favoriler — sahte doldurma yok
    const savedCount = base.length;
    const highComm = base.filter((l) => l.commissionType === "rate" && l.commissionValue >= 15);
    const openCount = base.filter((l) => l.partnershipMode === "open").length;
    const recent = base.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    let filtered = favTab === "open" ? base.filter((l) => l.partnershipMode === "open")
      : favTab === "highcomm" ? highComm
      : favTab === "recent" ? recent
      : base;
    if (catFilter) filtered = filtered.filter((l) => l.category === catFilter);
    // Sıralama (çalışır — eskiden statik etiketti).
    filtered = filtered.slice().sort((a, b) =>
      sortMode === "priceAsc" ? a.price - b.price
      : sortMode === "priceDesc" ? b.price - a.price
      : sortMode === "commission" ? commissionAmount(b) - commissionAmount(a)
      : b.createdAt.localeCompare(a.createdAt));
    const SORT_LABELS: Record<typeof sortMode, string> = { new: "En yeni", priceAsc: "Fiyat: artan", priceDesc: "Fiyat: azalan", commission: "En yüksek komisyon" };
    const SORT_ORDER: Array<typeof sortMode> = ["new", "priceAsc", "priceDesc", "commission"];
    const sidebarWidth = 300;
    const cardWidth = responsiveGrid({ available: Math.min(width, 1480) - 40 - sidebarWidth - 24, gap: 16, minCardWidth: 210, maxColumns: 4 }).cardWidth;
    const tabs: Array<{ key: typeof favTab; label: string; count: number }> = [
      { key: "all", label: translateCopy("Tümü", language), count: savedCount },
      { key: "open", label: translateCopy("Ortak satışa açık", language), count: openCount },
      { key: "highcomm", label: translateCopy("Yüksek komisyon (%15+)", language), count: highComm.length },
      { key: "recent", label: translateCopy("Son eklenenler", language), count: savedCount }
    ];
    // Favori kategorilerinden türetilen dinamik listeler (uydurma sayı yok).
    const catCounts = new Map<string, number>();
    base.forEach((l) => catCounts.set(l.category, (catCounts.get(l.category) ?? 0) + 1));
    const topCats = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
    // Tıklanır listeler: filtreyi/sekmeyi değiştirir (eskiden ölü dekorasyondu).
    const lists: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; count: number; active: boolean; onPress: () => void }> = [
      { icon: "check-circle", label: translateCopy("Tüm Favoriler", language), count: savedCount, active: favTab === "all" && !catFilter, onPress: () => { setFavTab("all"); setCatFilter(null); } },
      { icon: "percent", label: translateCopy("Yüksek Komisyon Fırsatları", language), count: highComm.length, active: favTab === "highcomm" && !catFilter, onPress: () => { setFavTab("highcomm"); setCatFilter(null); } },
      ...topCats.map(([cat, n]) => ({ icon: "tag-outline" as const, label: cat, count: n, active: catFilter === cat, onPress: () => { setCatFilter(catFilter === cat ? null : cat); setFavTab("all"); } }))
    ];

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        <View style={{ alignSelf: "center", gap: 16, maxWidth: 1280, paddingHorizontal: 20, paddingTop: 16, width: "100%" }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>{translateCopy("Favorilerim", language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>{translateCopy("Beğendiğin ürünleri burada bulabilir, fırsatları kaçırmadan kazanmaya başlayabilirsin.", language)}</Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          <FavStat icon="heart" tint={colors.accentSoft} color={colors.accent} value={`${savedCount}`} title={translateCopy("Kaydedilen ilan", language)} sub={translateCopy("Toplam favori", language)} />
          <FavStat icon="percent" tint={colors.primarySoft} color={colors.primaryDark} value={`${highComm.length}`} title={translateCopy("Yüksek komisyon fırsatı", language)} sub={translateCopy("%15 ve üzeri komisyon", language)} />
          <FavStat icon="handshake-outline" tint={colors.goldSoft} color={colors.gold} value={`${openCount}`} title={translateCopy("Ortak satışa açık", language)} sub={translateCopy("Hemen ortak olabileceğin ilan", language)} />
        </View>

        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 20 }}>
          <View style={{ flex: 1, gap: 14, minWidth: 0 }}>
            <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {tabs.map((t) => {
                const on = favTab === t.key;
                return (
                  <Pressable key={t.key} onPress={() => setFavTab(t.key)} style={{ alignItems: "center", backgroundColor: on ? colors.primary : colors.surface, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 13, paddingVertical: 8 }}>
                    <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12.5, fontWeight: "800" }}>{t.label}</Text>
                    <Text style={{ color: on ? "rgba(255,255,255,0.85)" : colors.muted, fontSize: 11, fontWeight: "800" }}>({t.count})</Text>
                  </Pressable>
                );
              })}
              <View style={{ flex: 1 }} />
              <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Sıralamayı değiştir", language)} onPress={() => setSortMode(SORT_ORDER[(SORT_ORDER.indexOf(sortMode) + 1) % SORT_ORDER.length])} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, opacity: pressed ? 0.7 : 1, paddingHorizontal: 12, paddingVertical: 7 })}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{translateCopy("Sıralama", language)}: <Text style={{ color: colors.ink, fontWeight: "900" }}>{translateCopy(SORT_LABELS[sortMode], language)}</Text></Text>
                <MaterialCommunityIcons name="swap-vertical" size={14} color={colors.muted} />
              </Pressable>
            </View>

            {filtered.length === 0 ? (
              <EmptyState title={translateCopy("Favori yok", language)} body={translateCopy("Ürün detayında kalp simgesine basarak favorilerine ekleyebilirsin.", language)} action={{ label: "Ürünleri keşfet", href: "/explore", icon: "compass-outline" }} mascot="heart" />
            ) : (
              <>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                  {filtered.slice(0, visibleCount).map((listing) => <ListingCard key={listing.id} listing={listing} owner={resolveOwner(listing.ownerId)} width={cardWidth} priceNote={priceNoteFor(listing.id, listing.price)} />)}
                </View>
                {filtered.length > visibleCount ? (
                  <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Daha fazla göster", language)} onPress={() => setVisibleCount((c) => c + PAGE * 2)} style={({ pressed }) => ({ alignItems: "center", alignSelf: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.7 : 1, paddingHorizontal: 18, paddingVertical: 10 })}>
                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy("Daha fazla göster", language)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>({filtered.length - visibleCount})</Text>
                  </Pressable>
                ) : null}
              </>
            )}
          </View>

          {/* Sidebar */}
          <View style={{ gap: 16, width: sidebarWidth }}>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 6, padding: 16 }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Hızlı filtreler", language)}</Text>
                {catFilter ? <Pressable onPress={() => { setCatFilter(null); setFavTab("all"); }} hitSlop={6}><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy("Temizle", language)}</Text></Pressable> : null}
              </View>
              {lists.map((l) => (
                <Pressable key={l.label} onPress={l.onPress} style={({ pressed }) => ({ alignItems: "center", backgroundColor: l.active ? colors.primarySoft : "transparent", borderRadius: 9, flexDirection: "row", gap: 10, opacity: pressed ? 0.7 : 1, paddingHorizontal: 8, paddingVertical: 8 })}>
                  <MaterialCommunityIcons name={l.icon} size={18} color={l.active ? colors.primary : colors.muted} />
                  <Text numberOfLines={1} style={{ color: l.active ? colors.primaryDark : colors.ink, flex: 1, fontSize: 13, fontWeight: l.active ? "900" : "700" }}>{l.label}</Text>
                  {l.active ? <MaterialCommunityIcons name="check-circle" size={16} color={colors.primary} /> : <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{l.count} {translateCopy("ilan", language)}</Text>}
                </Pressable>
              ))}
            </View>
          </View>
        </View>
        </View>

        <WebFooter />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" keyboardShouldPersistTaps="handled" contentContainerStyle={{ gap: 12, padding: 12, paddingBottom: 96 }} refreshControl={Platform.OS === "web" ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 8, height: 46, justifyContent: "center", width: 46 }}>
          <MaterialCommunityIcons name="heart" size={22} color={colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <Text selectable style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{translateCopy("Favoriler", language)}</Text>
          <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>{translateCopy("Kaydettiğin ürünleri buradan takip et.", language)}</Text>
        </View>
      </View>

      <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 50, paddingHorizontal: 12 }}>
        <MaterialCommunityIcons name="magnify" size={21} color={colors.accent} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={language === "en" ? "Search saved products, city, or category" : "Favorilerde ürün, şehir veya kategori ara"}
          placeholderTextColor={colors.muted}
          style={{ color: colors.ink, flex: 1, fontSize: 15, minHeight: 48, paddingVertical: 8 }}
        />
        {query ? (
          <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Aramayı temizle", language)} onPress={() => setQuery("")} hitSlop={10}>
            <MaterialCommunityIcons name="close-circle" size={19} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      {/* Filtre çipleri + sıralama (masaüstü paritesi) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 7, paddingRight: 12 }}>
        {([["all", "Tümü"], ["open", "Ortak satışa açık"], ["highcomm", "Yüksek komisyon"]] as const).map(([k, lbl]) => {
          const on = favTab === k && !catFilter;
          return (
            <Pressable key={k} onPress={() => { setFavTab(k); setCatFilter(null); }} style={{ backgroundColor: on ? colors.accent : colors.surface, borderColor: on ? colors.accent : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 }}>
              <Text style={{ color: on ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800" }}>{translateCopy(lbl, language)}</Text>
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setSortMode((["new", "priceAsc", "priceDesc", "commission"] as const)[((["new", "priceAsc", "priceDesc", "commission"] as const).indexOf(sortMode) + 1) % 4])}
          style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 7 }}
        >
          <MaterialCommunityIcons name="sort" size={14} color={colors.muted} />
          <Text style={{ color: colors.ink, fontSize: 12, fontWeight: "800" }}>{translateCopy({ new: "En yeni", priceAsc: "Fiyat: artan", priceDesc: "Fiyat: azalan", commission: "En yüksek komisyon" }[sortMode], language)}</Text>
        </Pressable>
      </ScrollView>

      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 18, fontWeight: "900" }}>{translateCopy("Ürünler", language)}</Text>
        <Text selectable style={{ color: colors.accent, fontSize: 12, fontWeight: "900" }}>{visibleListings.length} {language === "en" ? "results" : "sonuç"}</Text>
      </View>

      {favoriteListings.length === 0 ? <EmptyState title={language === "en" ? "No favorites" : "Favori yok"} body={language === "en" ? "Tap the heart on product details to add products to favorites." : "Ürün detayında kalp simgesine basarak ürünleri favorilerine ekleyebilirsin."} action={{ label: "Ürünleri keşfet", href: "/explore", icon: "compass-outline" }} mascot="heart" /> : null}
      {favoriteListings.length > 0 && visibleListings.length === 0 ? <EmptyState title={translateCopy("Sonuç yok", language)} body={language === "en" ? "Change your search term to list your favorites again." : "Arama kelimesini değiştirerek favorilerini tekrar listeleyebilirsin."} mascot="thinking" /> : null}

      {droppedCount > 0 ? (
        <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 12, flexDirection: "row", gap: 8, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 10 }}>
          <MaterialCommunityIcons name="tag-heart" size={18} color={colors.success} />
          <Text style={{ color: colors.success, flex: 1, fontSize: 13, fontWeight: "800" }}>{translateCopy("Favorilerinden", language)} {droppedCount} {translateCopy("ilanın fiyatı düştü — kaçırma!", language)}</Text>
        </View>
      ) : null}

      <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap }}>
        {visibleListings.slice(0, visibleCount).map((listing) =>
          listing ? <ListingCard key={listing.id} listing={listing} owner={resolveOwner(listing.ownerId)} width={cardWidth} priceNote={priceNoteFor(listing.id, listing.price)} /> : null
        )}
      </View>
      {visibleListings.length > visibleCount ? (
        <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Daha fazla göster", language)} onPress={() => setVisibleCount((c) => c + PAGE * 2)} style={({ pressed }) => ({ alignItems: "center", alignSelf: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 6, opacity: pressed ? 0.7 : 1, paddingHorizontal: 18, paddingVertical: 11 })}>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy("Daha fazla göster", language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>({visibleListings.length - visibleCount})</Text>
        </Pressable>
      ) : null}
      <PrimaryButton href="/(tabs)/explore" tone="secondary">{translateCopy("Keşfete dön", language)}</PrimaryButton>
    </ScrollView>
  );
}

function FavStat({ icon, tint, color, value, title, sub }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; color: string; value: string; title: string; sub: string }) {
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 280, flexDirection: "row", flexGrow: 1, gap: 14, maxWidth: 460, paddingHorizontal: 18, paddingVertical: 16 }}>
      <View style={{ alignItems: "center", backgroundColor: tint, borderRadius: 12, height: 48, justifyContent: "center", width: 48 }}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
        <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{value}</Text>
        <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{title}</Text>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{sub}</Text>
      </View>
    </View>
  );
}


export default function FavoritesScreen() {
  const { language } = useLanguage();
  const auth = useStore();
  const mounted = useMounted();
  if (!mounted) return <ScreenSkeleton />; // hidrasyon-gate: SSG↔istemci-ilk render eşitlenir (#418)
  if (!auth.isAuthenticated) return <AuthRequired title={translateCopy("Favorilerin için giriş yapın", language)} />;
  return <FavoritesScreenInner />;
}
