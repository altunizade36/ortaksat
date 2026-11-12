import { LISTING_GRID_PHOTO_RATIO, cardPriceFontSize } from "@/lib/card-layout";
import { listingCommissionDisplay } from "@/lib/mobile-listing";
import { CompactFooter } from "@/components/compact-footer";
import { displayListingTitle } from "@/lib/listing-title";
import { categoryByPrefix } from "@/lib/mobile-catalog";
import { useMemo, useState } from "react";
import { Keyboard, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { UserAvatar } from "@/components/user-avatar";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { MobileBrand } from "@/components/mobile-brand";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { MarketplaceRetry } from "@/components/marketplace-retry";
import { SkeletonGrid } from "@/components/skeleton";
import { useStore } from "@/lib/use-store";
import { moneyIn } from "@/lib/format";
import { useFavoriteFlag } from "@/lib/favorites-cache";
import { useLanguage, translateCopy } from "@/lib/i18n";
import { mobile, useMobileLayout } from "@/components/mobile/ui";
import type { Listing } from "@/lib/types";

const teal = "#0645C9";
const categories: { label: string; icon: keyof typeof Icon.glyphMap; color: string; match: string }[] = [
  { label: "Emlak", icon: "home", color: teal, match: "Emlak" },
  { label: "Vasıta", icon: "car", color: "#172334", match: "Vasıta" },
  { label: "Elektronik", icon: "cellphone", color: "#078DF0", match: "Elektronik" },
  { label: "Ev & Yaşam", icon: "sofa", color: "#F38A22", match: "Ev" },
  { label: "İkinci El & Sıfır\nAlışveriş", icon: "cart", color: "#7458C5", match: "İkinci El" },
  { label: "İş Makineleri\n& Sanayi", icon: "excavator", color: "#F5A800", match: "İş Makineleri" },
  { label: "Ustalar &\nHizmetler", icon: "tools", color: "#04308C", match: "Ustalar" },
  { label: "Özel Ders &\nEğitim", icon: "school", color: "#098DE3", match: "Özel Ders" },
  { label: "Hobi & Spor", icon: "paw", color: "#F38A22", match: "Hobi" },
  { label: "Tüm\nKategoriler", icon: "view-grid-outline", color: "#172334", match: "all" },
];
const slides = [
  { title: "İlan ver, ortak ol,\nkazanmaya başla!", copy: "Ürününü ortak satışa aç,\ndaha fazla kişiye ulaş.\nHerkes kazansın." },
  { title: "Ürününü paylaş,\nortaklarını bul!", copy: "Ücretsiz ilanını oluştur,\nkomisyonunu belirle.\nBirlikte daha çok sat." },
  { title: "Ortak satıcı ol,\nkomisyon kazan!", copy: "İlanları keşfet,\nsana uygun ürünü paylaş.\nSatıştan kazanç sağla." },
];

export function HomeMobile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { language } = useLanguage();
  const tr = (copy: string) => translateCopy(copy, language);
  const store = useStore();
  const [query, setQuery] = useState("");
  const [slide, setSlide] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [visible, setVisible] = useState(18);
  const listings = useMemo(() => store.listings.filter((l) => l.status === "active").slice().sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured))), [store.listings]);
  const { maxWidth, tablet } = useMobileLayout();
  const columns = tablet ? (width > 1000 ? 5 : 4) : 2;
  const cardWidth = Math.floor((maxWidth - 28 - (columns - 1) * 8) / columns);
  const hasUnread = store.notifications.some((n) => n.userId === store.currentUser?.id && !n.read);
  function search(value: string, filters = false) {
    const q = value.trim().replace(/\s+/g, " ").slice(0, 120);
    Keyboard.dismiss();
    router.push({ pathname: "/explore", params: { q, ...(filters ? { filters: "1" } : {}) } });
  }
  async function refresh() {
    setRefreshing(true);
    try { await store.refreshMarketplace(); } finally { setRefreshing(false); }
  }
  return (
    <ScrollView style={s.screen} contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 8, paddingBottom: 0, width: "100%", maxWidth, alignSelf: "center" }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={teal} />}>
      <View style={s.header}>
        <MobileBrand size={30} />
        <View style={s.headerActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={tr("Bildirimler")} onPress={() => router.push("/notifications")} style={s.iconButton}>
            <Icon name="bell-outline" size={27} color="#111B2B" />
            {hasUnread && <View style={s.unread} />}
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={tr("Profilim")} onPress={() => router.push(store.isAuthenticated ? "/profile" : "/auth")} style={s.avatar}>
            <UserAvatar uri={store.isAuthenticated ? store.currentUser?.avatar : null} size={38} />
          </Pressable>
        </View>
      </View>
      <View style={s.search}>
        <Icon name="magnify" size={23} color="#59616B" />
        <TextInput accessibilityLabel={tr("İlan ara")} placeholder={tr("OrtakSat’ta ara...")} placeholderTextColor="#7A7E87" value={query} onChangeText={setQuery} maxLength={120} autoCapitalize="none" autoCorrect={false} onSubmitEditing={event => search(event.nativeEvent.text)} returnKeyType="search" style={s.searchInput} />
        <Pressable accessibilityRole="button" accessibilityLabel={tr("Arama ve filtreler")} onPress={() => search(query, true)} style={s.iconButton}><Icon name="tune-variant" size={24} color="#182334" /></Pressable>
      </View>
      <LinearGradient colors={["#001C5F", "#0035A3", "#001E68"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}>
        <View style={s.heroGlow} />
        <View pointerEvents="none" style={s.mascot}><Image source={require("../public/assets/mascot/webp-512/success.webp")} style={{ width: Math.min(160, width * 0.4), height: Math.min(160, width * 0.4) }} contentFit="contain" priority="high" accessibilityLabel={tr("OrtakSat kedi maskotu")} /></View>
        <View style={s.heroCopy}>
          <Text style={[s.heroTitle, { fontSize: Math.min(19, width * 0.047), lineHeight: Math.min(23, width * 0.057) }]}>{tr(slides[slide].title)}</Text>
          <Text style={s.heroDescription}>{tr(slides[slide].copy)}</Text>
        </View>
        <View style={s.heroActions}>
          <Pressable accessibilityRole="button" onPress={() => router.push("/create")} style={[s.heroButton, { backgroundColor: "#FAFDFE" }]}>
            <View style={s.plus}><Icon name="plus" size={25} color="white" /></View>
            <View style={{ flexShrink: 1 }}><Text style={s.buttonTitle}>{tr("İlan Ver")}</Text><Text style={s.buttonCaption}>{tr("Ürününü paylaş")}</Text></View>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.push("/partner")} style={[s.heroButton, { backgroundColor: "#0040BD" }]}>
            <Icon name="account-group" size={29} color="white" />
            <View style={{ flexShrink: 1 }}><Text style={[s.buttonTitle, { color: "white" }]}>{tr("Ortak Satıcı Ol")}</Text><Text style={[s.buttonCaption, { color: "#D3E1FA" }]}>{tr("Komisyon kazan")}</Text></View>
          </Pressable>
        </View>
      </LinearGradient>
      <View style={s.dots}>{slides.map((_, i) => <Pressable key={i} accessibilityRole="button" accessibilityLabel={`Kampanya ${i + 1}`} accessibilityState={{ selected: i === slide }} hitSlop={10} onPress={() => setSlide(i)} style={[s.dot, i === slide && { backgroundColor: teal }]} />)}</View>
      <View style={s.categories}>
        {categories.map((category) => <Pressable key={category.match} accessibilityRole="button" accessibilityLabel={tr(category.label.replace(/\n/g, " "))} onPress={() => {
          if (category.match === "all") { router.push("/kategoriler"); return; }
          const node = categoryByPrefix(store.categoryTree, category.match);
          if (!node) { router.push({ pathname: "/explore", params: { q: category.match } }); return; }
          router.push(`/kategori/${node.slug}` as never);
        }} style={s.category}>
          <LinearGradient colors={["#F0F5F8", "#F8FBFD"]} style={s.categoryTile}><Icon name={category.icon} size={30} color={category.color} /></LinearGradient>
          <Text style={[s.categoryLabel, width < 360 && { fontSize: 9, lineHeight: 12 }]}>{tr(category.label)}</Text>
        </Pressable>)}
      </View>
      <View style={s.sectionHeading}><Text accessibilityRole="header" style={s.sectionTitle}>{tr("Öne çıkan ilanlar")}</Text><Pressable accessibilityRole="button" onPress={() => router.push("/explore")} style={s.seeAll}><Text style={s.seeAllText}>{tr("Tümünü Gör")}</Text><Icon name="chevron-right" size={17} color={teal} /></Pressable></View>
      {store.marketplaceInitialLoading && listings.length === 0 ? <SkeletonGrid count={6} cardWidth={cardWidth} gap={8} /> : store.marketplaceLoadFailed && listings.length === 0 ? <MarketplaceRetry onRetry={store.retryMarketplace} /> : listings.length === 0 ? <Text style={s.empty}>{tr("Henüz ilan bulunmuyor.")}</Text> : <View style={s.grid}>{listings.slice(0, visible).map((listing) => <MobileListingCard key={listing.id} listing={listing} width={cardWidth} />)}</View>}
      {(visible < listings.length || store.marketplaceHasMore) && <Pressable accessibilityRole="button" onPress={() => { setVisible((v) => v + 18); if (visible >= listings.length) store.loadMoreMarketplace(); }} style={s.loadMore}><Text style={s.seeAllText}>{tr("Daha fazla ilan göster")}</Text></Pressable>}
    <CompactFooter /></ScrollView>
  );
}

function MobileListingCard({ listing, width }: { listing: Listing; width: number }) {
  const router = useRouter();
  const { language } = useLanguage();
  const { isFav: favorite, toggle } = useFavoriteFlag(listing.id);
  const commission = listingCommissionDisplay(listing);
  return <View style={[s.card, { width }]}>
    <Pressable accessibilityRole="button" accessibilityLabel={displayListingTitle(listing.title)} onPress={() => router.push(`/listing/${listing.id}` as never)}>
      <View style={{ height: (width - 2) / LISTING_GRID_PHOTO_RATIO }}>
        <SafeRemoteImage uri={listing.imageUrl || listing.image} fallbackUri={listing.fallbackCategoryImage} style={{ width: "100%", height: "100%" }} accessibilityLabel={displayListingTitle(listing.title)} />
        {listing.demo && <View style={s.demo}><Text style={s.demoText}>{translateCopy("Örnek", language)}</Text></View>}
        {listing.partnershipMode !== "none" && <View style={s.commission}><Icon name="account-group" size={13} color="white" /><Text numberOfLines={1} style={s.commissionText}>{commission ? `${translateCopy("Komisyon", language)} ${commission}` : translateCopy("Komisyonu satıcıya sor", language)}</Text></View>}
      </View>
      <View style={s.cardBody}>
        <Text numberOfLines={2} style={s.cardTitle}>{displayListingTitle(listing.title)}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit style={[s.price,{fontSize:cardPriceFontSize(moneyIn(listing.price,listing.currency),width-18,20),height:24,lineHeight:24}]}>{moneyIn(listing.price, listing.currency)}</Text>
        <View style={s.location}><Icon name="map-marker" size={12} color="#8A9099" /><Text numberOfLines={1} style={s.locationText}>{listing.location}</Text></View>
      </View>
    </Pressable>
    <Pressable accessibilityRole="button" accessibilityLabel={translateCopy(favorite ? "Favorilerden çıkar" : "Favorilere ekle", language)} accessibilityState={{ selected: favorite }} aria-pressed={favorite} onPress={toggle} style={s.favorite}><Icon name={favorite ? "heart" : "heart-outline"} size={22} color={favorite ? "#FF647A" : "white"} /></Pressable>
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#FAFCFE" },
  header: { paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 14 },
  headerActions: { flexDirection: "row", gap: 13, alignItems: "center" }, iconButton: { width: 36, height: 40, alignItems: "center", justifyContent: "center" },
  unread: { position: "absolute", top: 5, right: 5, width: 8, height: 8, borderRadius: 4, backgroundColor: "#FF4050", borderWidth: 1.5, borderColor: "white" },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#E7E9F2", alignItems: "center", justifyContent: "center", overflow: "hidden" },
  search: { marginHorizontal: 20, marginBottom: 14, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 12, height: 43, borderRadius: 15, borderWidth: 1, borderColor: "#E3E8ED", backgroundColor: "#FAFCFF", boxShadow: "0px 3px 8px #1122330B" },
  searchInput: { flex: 1, fontSize: 15, color: "#182334", minWidth: 0, paddingVertical: 8 },
  hero: { marginHorizontal: 12, borderRadius: 13, overflow: "hidden", padding: 11, boxShadow: "0px 4px 8px #003E4624" },
  heroGlow: { position: "absolute", width: 200, height: 200, borderRadius: 100, backgroundColor: "#2CE6D330", right: -40, top: -100 },
  mascot: { position: "absolute", top: 0, right: 0 },
  heroCopy: { padding: 4, minHeight: 113, width: "60%" }, heroTitle: { color: "#EFF4FC", fontWeight: "800", fontStyle: "italic", fontSize: 19, lineHeight: 23 }, heroDescription: { color: "#DEE7F6", fontSize: 12, lineHeight: 16, marginTop: 6 },
  heroActions: { flexDirection: "row", gap: 9, marginTop: 8 }, heroButton: { flex: 1, minHeight: 48, borderRadius: 12, paddingHorizontal: 9, paddingVertical: 8, flexDirection: "row", alignItems: "center", gap: 8 }, plus: { width: 26, height: 26, borderRadius: 13, backgroundColor: teal, alignItems: "center", justifyContent: "center" }, buttonTitle: { color: "#111827", fontSize: 12, fontWeight: "700" }, buttonCaption: { color: "#7F8590", fontSize: 10, marginTop: 2 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 7, paddingVertical: 11 }, dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#DDE2E7" },
  categories: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 10, marginTop: 0, marginBottom: 14, rowGap: 9 }, category: { width: "20%", alignItems: "center", paddingHorizontal: 3 }, categoryTile: { width: "100%", maxWidth: 85, height: 52, borderRadius: 12, borderColor: "#EDF1F5", borderWidth: 1, alignItems: "center", justifyContent: "center" }, categoryLabel: { color: "#111827", textAlign: "center", fontSize: 10, lineHeight: 13, fontWeight: "700", marginTop: 5, minHeight: 26 },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, marginTop: 14, marginBottom: 10 }, sectionTitle: { fontSize: 18, fontWeight: "800", color: "#101827" }, seeAll: { flexDirection: "row", alignItems: "center", minHeight: 36 }, seeAllText: { color: teal, fontSize: 11, fontWeight: "600" },
  grid: { paddingHorizontal: 14, flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }, card: { backgroundColor: "#FFFFFF", borderRadius: 9, overflow: "hidden", borderWidth: 1, borderColor: "#EBEEF1", boxShadow: "0px 2px 4px #132B4010" }, cardBody: { padding: 5, gap: 2, height:84 }, cardTitle: { color: "#101827", fontSize: 12, lineHeight: 15, fontWeight: "700", height: 30 }, location: { height:14, flexDirection: "row", alignItems: "center", gap: 2 }, locationText: { fontSize: 10, color: "#7A808A", flex: 1 }, price: { color: "#002E93", fontSize: 18, fontWeight: "800" }, favorite: { position: "absolute", top: 3, right: 2, width: 32, height: 32, borderRadius: 16, backgroundColor: "#00000050", alignItems: "center", justifyContent: "center" }, commission: { position: "absolute", bottom: 4, left: 4, right: 4, borderRadius: 12, backgroundColor: "#00959CEB", flexDirection: "row", alignItems: "center", paddingHorizontal: 5, paddingVertical: 4, gap: 3 }, commissionText: { color: "white", fontSize: 10, fontWeight: "600", flexShrink: 1 }, demo: { position: "absolute", top: 5, left: 4, borderRadius: 4, backgroundColor: "#FFFFFFDC", paddingHorizontal: 4, paddingVertical: 2 }, demoText: { fontSize: 8, color: "#4B5563" }, empty: { padding: 24, color: "#64748B", textAlign: "center" }, loadMore: { alignSelf: "center", padding: 20 },
});

