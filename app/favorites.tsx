import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { AuthRequired } from "@/components/auth-gate";
import { ListingCard } from "@/components/listing-card";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { EmptyState, PrimaryButton } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { commissionAmount, money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { responsiveGrid, useIsWideWeb } from "@/lib/layout";
import { searchKey } from "@/lib/locale";
import { matchesQuery } from "@/lib/search";
import { displayText } from "@/lib/text";
import type { Listing } from "@/lib/types";
import { useStore } from "@/lib/use-store";

function FavoritesScreenInner() {
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const isWideWeb = useIsWideWeb();
  const { currentUser, favorites, findUser, listings } = useStore();
  const [query, setQuery] = useState("");
  const [favTab, setFavTab] = useState<"all" | "open" | "highcomm" | "near" | "recent">("all");
  const [alarms, setAlarms] = useState<Record<string, boolean>>({ a: true, b: true, c: false });
  const [newListOpen, setNewListOpen] = useState(false);
  const [newListName, setNewListName] = useState("");
  const [extraLists, setExtraLists] = useState<string[]>([]);
  const horizontalPadding = 12;
  const gap = 8;
  const cardWidth = responsiveGrid({ available: width - horizontalPadding * 2, gap, minCardWidth: 168, minColumns: 3 }).cardWidth;
  const tokens = searchKey(query).split(" ").filter(Boolean);
  const myFavs = favorites.filter((favorite) => favorite.userId === currentUser.id);
  const favoriteListings = myFavs
    .map((favorite) => listings.find((listing) => listing.id === favorite.listingId))
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
  const visibleListings = favoriteListings.filter((listing) => {
    if (!listing || tokens.length === 0) return true;
    return matchesQuery(listing, undefined, tokens);
  });

  if (isWideWeb) {
    const myFavs = favoriteListings.filter(Boolean) as Listing[];
    const base = myFavs; // yalnızca gerçek favoriler — sahte doldurma yok
    const savedCount = base.length;
    const highComm = base.filter((l) => l.commissionType === "rate" && l.commissionValue >= 15);
    const openCount = base.filter((l) => l.partnershipMode === "open").length;
    const recent = base.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const filtered = favTab === "open" ? base.filter((l) => l.partnershipMode === "open")
      : favTab === "highcomm" ? highComm
      : favTab === "recent" ? recent
      : base;
    const sidebarWidth = 300;
    const cardWidth = responsiveGrid({ available: Math.min(width, 1480) - 40 - sidebarWidth - 24, gap: 16, minCardWidth: 210, maxColumns: 4 }).cardWidth;
    const tabs: Array<{ key: typeof favTab; label: string; count: number }> = [
      { key: "all", label: "Tümü", count: savedCount },
      { key: "open", label: "Ortak satışa açık", count: openCount },
      { key: "highcomm", label: "Yüksek komisyon (%15+)", count: highComm.length },
      { key: "recent", label: "Son eklenenler", count: savedCount }
    ];
    // Favori kategorilerinden türetilen dinamik listeler (uydurma sayı yok).
    const catCounts = new Map<string, number>();
    base.forEach((l) => catCounts.set(l.category, (catCounts.get(l.category) ?? 0) + 1));
    const topCats = Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const lists: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; count: number; active: boolean }> = [
      { icon: "check-circle", label: "Tüm Favoriler", count: savedCount, active: true },
      { icon: "percent", label: "Yüksek Komisyon Fırsatları", count: highComm.length, active: false },
      ...topCats.map(([cat, n]) => ({ icon: "tag-outline" as const, label: cat, count: n, active: false }))
    ];

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        <View style={{ alignSelf: "center", gap: 16, maxWidth: 1280, paddingHorizontal: 20, paddingTop: 16, width: "100%" }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: colors.ink, fontSize: 26, fontWeight: "900" }}>Favorilerim</Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600" }}>Beğendiğin ürünleri burada bulabilir, fırsatları kaçırmadan kazanmaya başlayabilirsin.</Text>
        </View>

        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          <FavStat icon="heart" tint={colors.accentSoft} color={colors.accent} value={`${savedCount}`} title="Kaydedilen ilan" sub="Toplam favori" />
          <FavStat icon="percent" tint={colors.primarySoft} color={colors.primaryDark} value={`${highComm.length}`} title="Yüksek komisyon fırsatı" sub="%15 ve üzeri komisyon" />
          <FavStat icon="handshake-outline" tint={colors.goldSoft} color={colors.gold} value={`${openCount}`} title="Ortak satışa açık" sub="Hemen ortak olabileceğin ilan" />
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
              <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, paddingHorizontal: 12, paddingVertical: 7 }}>
                <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>Sıralama: En yeni</Text>
                <MaterialCommunityIcons name="chevron-down" size={14} color={colors.muted} />
              </View>
            </View>

            {filtered.length === 0 ? (
              <EmptyState title="Favori yok" body="Ürün detayında kalp simgesine basarak favorilerine ekleyebilirsin." />
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                {filtered.map((listing) => <ListingCard key={listing.id} listing={listing} owner={findUser(listing.ownerId)} width={cardWidth} priceNote={priceNoteFor(listing.id, listing.price)} />)}
              </View>
            )}
          </View>

          {/* Sidebar */}
          <View style={{ gap: 16, width: sidebarWidth }}>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 6, padding: 16 }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 4 }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Favori listeleri</Text>
                <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>Tüm listeler</Text>
              </View>
              {lists.map((l) => (
                <View key={l.label} style={{ alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 7 }}>
                  <MaterialCommunityIcons name={l.icon} size={18} color={l.active ? colors.primary : colors.muted} />
                  <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: l.active ? "900" : "700" }}>{l.label}</Text>
                  {l.active ? <MaterialCommunityIcons name="check-circle" size={16} color={colors.primary} /> : <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{l.count} ilan</Text>}
                </View>
              ))}
              {extraLists.map((name) => (
                <View key={name} style={{ alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 7 }}>
                  <MaterialCommunityIcons name="playlist-star" size={18} color={colors.muted} />
                  <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{name}</Text>
                  <Pressable accessibilityRole="button" accessibilityLabel="Listeyi kaldır" onPress={() => setExtraLists((s) => s.filter((x) => x !== name))} hitSlop={8}><MaterialCommunityIcons name="close" size={15} color={colors.subtle} /></Pressable>
                </View>
              ))}
              <Pressable onPress={() => setNewListOpen((v) => !v)} style={({ pressed }) => ({ alignItems: "center", borderColor: colors.primary, borderRadius: 10, borderStyle: "dashed", borderWidth: 1.5, flexDirection: "row", gap: 6, justifyContent: "center", marginTop: 6, opacity: pressed ? 0.7 : 1, paddingVertical: 10 })}>
                <MaterialCommunityIcons name={newListOpen ? "close" : "plus"} size={16} color={colors.primary} />
                <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{newListOpen ? "Vazgeç" : "Yeni liste oluştur"}</Text>
              </Pressable>
              {newListOpen ? (
                <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                  <TextInput value={newListName} onChangeText={setNewListName} placeholder="Liste adı" placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, flex: 1, fontSize: 13, paddingHorizontal: 12, paddingVertical: 9 }} />
                  <Pressable onPress={() => { if (newListName.trim()) { setExtraLists((s) => [...s, newListName.trim()]); setNewListName(""); setNewListOpen(false); } }} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, justifyContent: "center", paddingHorizontal: 14 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Ekle</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          </View>
        </View>
        </View>

        <WebFooter />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 12, padding: 12, paddingBottom: 96 }}>
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
          <Pressable accessibilityRole="button" accessibilityLabel="Aramayı temizle" onPress={() => setQuery("")} hitSlop={10}>
            <MaterialCommunityIcons name="close-circle" size={19} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 18, fontWeight: "900" }}>{translateCopy("Ürünler", language)}</Text>
        <Text selectable style={{ color: colors.accent, fontSize: 12, fontWeight: "900" }}>{visibleListings.length} {language === "en" ? "results" : "sonuç"}</Text>
      </View>

      {favoriteListings.length === 0 ? <EmptyState title={language === "en" ? "No favorites" : "Favori yok"} body={language === "en" ? "Tap the heart on product details to add products to favorites." : "Ürün detayında kalp simgesine basarak ürünleri favorilerine ekleyebilirsin."} /> : null}
      {favoriteListings.length > 0 && visibleListings.length === 0 ? <EmptyState title="Sonuç yok" body={language === "en" ? "Change your search term to list your favorites again." : "Arama kelimesini değiştirerek favorilerini tekrar listeleyebilirsin."} /> : null}

      {droppedCount > 0 ? (
        <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 12, flexDirection: "row", gap: 8, marginBottom: 4, paddingHorizontal: 14, paddingVertical: 10 }}>
          <MaterialCommunityIcons name="tag-heart" size={18} color={colors.success} />
          <Text style={{ color: colors.success, flex: 1, fontSize: 13, fontWeight: "800" }}>Favorilerinden {droppedCount} ilanın fiyatı düştü — kaçırma!</Text>
        </View>
      ) : null}

      <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap }}>
        {visibleListings.map((listing) =>
          listing ? <ListingCard key={listing.id} listing={listing} owner={findUser(listing.ownerId)} width={cardWidth} priceNote={priceNoteFor(listing.id, listing.price)} /> : null
        )}
      </View>
      <PrimaryButton href="/(tabs)/explore" tone="secondary">Keşfete dön</PrimaryButton>
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
  const auth = useStore();
  if (!auth.isAuthenticated) return <AuthRequired title="Favorilerin için giriş yapın" />;
  return <FavoritesScreenInner />;
}
