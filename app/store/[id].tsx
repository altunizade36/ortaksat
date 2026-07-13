import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions } from "react-native";

import { Alert } from "@/lib/alert";

import { colors } from "@/components/colors";
import { StarRatingInput } from "@/components/star-rating-input";
import { Seo } from "@/components/seo";
import { JsonLd } from "@/components/json-ld";
import { ListingCard } from "@/components/listing-card";
import { EmptyState, Metric, PrimaryButton, StatusPill } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { money, trPhoneIntl } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { haptic } from "@/lib/haptics";
import { fetchSellerPhone } from "@/lib/supabase-data";
import { openUrlSafe } from "@/lib/link";
import { responsiveGrid, useIsWideWeb } from "@/lib/layout";
import { shortDate } from "@/lib/locale";
import { displayText } from "@/lib/text";
import { fetchReviewsForUser, replyToReviewLive, toggleReviewHelpfulLive } from "@/lib/live-service";
import { calculateUserTrustScores } from "@/lib/trust-score";
import type { Listing, Review } from "@/lib/types";
import { useStore } from "@/lib/use-store";

type StoreFilter = "active" | "all" | "partner";
type ProfileTab = "about" | "listings" | "partnerships" | "policies" | "reviews" | "badges";

export default function StoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language, t } = useLanguage();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const isWideWeb = useIsWideWeb();
  const { currentUser, findUser, listings, partnerships, leads, reports, reviews, sales, startConversation, reportUser, editReview, deleteReview, reportReview, isFollowing, toggleFollow, backendMode, refreshMarketplace } = useStore();
  // Girişli mi? (helpful oyu için: anon → /auth; girişli + geçici hata → yönlendirme YOK)
  const isAuthed = backendMode === "supabase" && !!currentUser?.id && currentUser.id.includes("-");

  async function handleReportSeller() {
    if (!seller || isOwnStore) return;
    const ok = await reportUser(seller.id, translateCopy("Satıcı bildirimi", language), translateCopy("Mağaza/satıcı profilinden bildirildi.", language));
    Alert.alert(
      ok ? translateCopy("Bildirim alındı", language) : translateCopy("Gönderilemedi", language),
      ok
        ? translateCopy("Bildiriminiz kayıt altına alındı ve incelenecek. Teşekkürler.", language)
        : translateCopy("Bildirim için e-posta ile giriş yapmalısın.", language)
    );
  }
  const [filter, setFilter] = useState<StoreFilter>("active");
  const [storeSort, setStoreSort] = useState<"new" | "priceAsc" | "priceDesc">("new");
  const [tab, setTab] = useState<ProfileTab>("about");
  const [refreshing, setRefreshing] = useState(false);
  const [revealedPhone, setRevealedPhone] = useState<string | null>(null);
  const [revealingPhone, setRevealingPhone] = useState(false);
  const seller = id ? findUser(id) : undefined;
  const isOwnStore = seller?.id === currentUser.id;
  const trust = seller ? calculateUserTrustScores({ leads, listings, partnerships, reports, reviews, sales, user: seller }) : undefined;
  // Ortak (partner) karnesi — kişinin başkalarının ürünlerini satarak/getirerek yaptığı iş.
  const partnerAllPartnerships = seller ? partnerships.filter((p) => p.partnerId === seller.id) : [];
  const partnerActiveCount = partnerAllPartnerships.filter((p) => p.status === "active").length;
  const partnerPartnershipIds = new Set(partnerAllPartnerships.map((p) => p.id));
  const partnerSalesList = sales.filter((s) => partnerPartnershipIds.has(s.partnershipId));
  const partnerBroughtSales = partnerSalesList.length;
  const partnerEarned = partnerSalesList.reduce((sum, s) => sum + s.commissionAmount, 0);
  const hasPartnerActivity = partnerAllPartnerships.length > 0 || partnerBroughtSales > 0;
  const sellerListings = useMemo(() => {
    const arr = listings
      .filter((listing) => listing.ownerId === id && listing.status !== "rejected")
      .filter((listing) => {
        if (filter === "active") return listing.status === "active";
        if (filter === "partner") return listing.status === "active" && listing.partnershipMode !== "invite";
        return true;
      });
    if (storeSort === "priceAsc") arr.sort((a, b) => a.price - b.price);
    else if (storeSort === "priceDesc") arr.sort((a, b) => b.price - a.price);
    else arr.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); // "new"
    return arr;
  }, [filter, id, listings, storeSort]);
  const activeListings = listings.filter((listing) => listing.ownerId === id && listing.status === "active");
  const totalCommission = activeListings.reduce((sum, listing) => {
    return sum + (listing.commissionType === "rate" ? Math.round((listing.price * listing.commissionValue) / 100) : listing.commissionValue);
  }, 0);
  const gridGap = 10;
  const cardWidth = responsiveGrid({ available: width - 24, gap: gridGap, minCardWidth: 176 }).cardWidth;

  // Bu kullanıcı HAKKINDA yazılmış yorumları canlıdan getir (global store yalnız
  // giriş yapan kullanıcının YAZDIĞI yorumları tutuyor). Böylece ziyaretçi de
  // satıcının aldığı gerçek değerlendirmeleri görür.
  const [fetchedReviews, setFetchedReviews] = useState<Review[]>([]);
  const [reviewSort, setReviewSort] = useState<"recent" | "high" | "low" | "helpful">("recent");
  // ReviewCard yanıt/oy sonrası kaynağı günceller → tab değişip geri gelince (remount) stale
  // prop yerine güncel değer seed'lenir (eskiden yanıt/oy görünüşte kayboluyordu).
  const patchReview = (rid: string, patch: Partial<Review>) => setFetchedReviews((rs) => rs.map((r) => (r.id === rid ? { ...r, ...patch } : r)));
  const removeFetched = (rid: string) => setFetchedReviews((rs) => rs.filter((r) => r.id !== rid));
  useEffect(() => {
    let alive = true;
    if (id) void fetchReviewsForUser(id).then((r) => { if (alive) setFetchedReviews(r); });
    return () => { alive = false; };
  }, [id]);
  const reviewsAboutSeller = useMemo(() => {
    const map = new Map<string, Review>();
    for (const r of reviews) if (r.reviewedUserId === id) map.set(r.id, r);
    for (const r of fetchedReviews) map.set(r.id, r);
    const list = Array.from(map.values());
    const byRecent = (a: Review, b: Review) => b.createdAt.localeCompare(a.createdAt);
    if (reviewSort === "high") return list.sort((a, b) => b.rating - a.rating || byRecent(a, b));
    if (reviewSort === "low") return list.sort((a, b) => a.rating - b.rating || byRecent(a, b));
    if (reviewSort === "helpful") return list.sort((a, b) => (b.helpfulCount ?? 0) - (a.helpfulCount ?? 0) || byRecent(a, b));
    return list.sort(byRecent);
  }, [reviews, fetchedReviews, id, reviewSort]);

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        refreshMarketplace(),
        id ? fetchReviewsForUser(id).then((r) => setFetchedReviews(r)) : Promise.resolve()
      ]);
    } catch {
      // sessiz
    } finally {
      setRefreshing(false);
    }
  }

  function messageSeller() {
    if (!seller || isOwnStore) return;
    if (currentUser.id === "anon") {
      Alert.alert(translateCopy("Giriş gerekli", language), translateCopy("Satıcıya mesaj göndermek için giriş yapmalısın.", language), [
        { text: translateCopy("Vazgeç", language), style: "cancel" },
        { text: translateCopy("Giriş yap", language), onPress: () => router.push("/auth") }
      ]);
      return;
    }
    const firstListing = activeListings[0] ?? sellerListings[0];
    if (!firstListing) {
      Alert.alert(translateCopy("İletişim kurulamadı", language), translateCopy("Bu satıcının şu an aktif ilanı yok. İlan yayınlandığında mesaj gönderebilirsin.", language));
      return;
    }
    const conversation = startConversation(firstListing.id, seller.id, `${seller.name} mağazasındaki ürünler için bilgi almak istiyorum.`);
    if (conversation) router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
    else Alert.alert(translateCopy("İletişim kurulamadı", language), translateCopy("Şu an konuşma başlatılamadı, lütfen tekrar dene.", language));
  }

  // Sahibinden tarzı "Numarayı Göster": istek üzerine gerçek numara (girişli kullanıcıya).
  async function revealPhone() {
    if (!seller || isOwnStore || revealingPhone) return;
    if (currentUser.id === "anon") {
      Alert.alert(translateCopy("Giriş gerekli", language), translateCopy("Numarayı görmek için giriş yapmalısın.", language), [
        { text: translateCopy("Vazgeç", language), style: "cancel" },
        { text: translateCopy("Giriş yap", language), onPress: () => router.push("/auth") }
      ]);
      return;
    }
    haptic.light();
    setRevealingPhone(true);
    const p = await fetchSellerPhone(seller.id);
    setRevealingPhone(false);
    if (!p) { Alert.alert(translateCopy("Numara görünmüyor", language), translateCopy("Satıcı numara paylaşmamış; mesaj gönderebilirsin.", language)); return; }
    setRevealedPhone(p);
  }

  const following = seller ? isFollowing(seller.id) : false;
  function handleFollow() {
    if (!seller || isOwnStore) return;
    if (currentUser.id === "anon") {
      Alert.alert(translateCopy("Giriş gerekli", language), translateCopy("Mağazayı takip etmek için giriş yapmalısın.", language), [
        { text: translateCopy("Vazgeç", language), style: "cancel" },
        { text: translateCopy("Giriş yap", language), onPress: () => router.push("/auth") }
      ]);
      return;
    }
    haptic.selection();
    toggleFollow(seller.id);
  }

  if (!seller) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 12 }}>
        <EmptyState title={translateCopy("Mağaza bulunamadı", language)} body={translateCopy("Bu satıcı profili kaldırılmış veya bağlantı geçersiz olabilir.", language)} />
      </ScrollView>
    );
  }

  // Doğrulama/başarı rozetleri — hem masaüstü hem mobil dal kullanır.
  const badges: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; sub: string; on: boolean; tint: string; color: string }> = [
    { icon: "check-decagram", label: translateCopy("Kimlik Doğrulandı", language), sub: translateCopy("Resmi kimlik onaylı", language), on: seller.verifiedIdentity, tint: colors.successSoft, color: colors.success },
    { icon: "phone-check", label: translateCopy("Telefon Doğrulandı", language), sub: translateCopy("Numara onaylı", language), on: seller.verifiedPhone, tint: colors.infoSoft, color: colors.info },
    { icon: "instagram", label: translateCopy("Instagram Bağlı", language), sub: translateCopy("Sosyal hesap onaylı", language), on: !!seller.verifiedInstagram, tint: colors.violetSoft, color: colors.violet },
    { icon: "star-circle", label: translateCopy("Yüksek Puan", language), sub: translateCopy("4.5+ değerlendirme", language), on: seller.rating >= 4.5, tint: colors.goldSoft, color: colors.gold },
    { icon: "trophy", label: translateCopy("Çok Satan", language), sub: translateCopy("50+ başarılı satış", language), on: seller.successfulSales >= 50, tint: colors.primarySoft, color: colors.primaryDark },
    { icon: "lightning-bolt", label: translateCopy("Hızlı Yanıt", language), sub: translateCopy("%90+ yanıt oranı", language), on: seller.responseRate >= 90, tint: colors.accentSoft, color: colors.accent }
  ];

  if (isWideWeb) {
    const sellerPartnerships = partnerships.filter((p) => activeListings.some((l) => l.id === p.listingId));
    const featured = activeListings.slice(0, 3);
    const deskCardWidth = responsiveGrid({ available: Math.min(width, 1480) - 40 - 300 - 24, gap: 16, minCardWidth: 210, maxColumns: 3 }).cardWidth;
    const tabs: Array<{ key: ProfileTab; label: string; count?: number }> = [
      { key: "about", label: translateCopy("Hakkında", language) },
      { key: "listings", label: translateCopy("İlanları", language), count: activeListings.length },
      { key: "partnerships", label: translateCopy("Ortaklıkları", language), count: sellerPartnerships.length },
      { key: "policies", label: translateCopy("Politikalar", language) },
      { key: "reviews", label: translateCopy("Yorumlar", language), count: reviewsAboutSeller.length },
      { key: "badges", label: translateCopy("Rozetler", language), count: badges.filter((b) => b.on).length }
    ];

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        <Seo title={`${seller?.name ?? "Satıcı"} — Mağaza ve ilanları | OrtakSat`} description={`${seller?.name ?? "Bu satıcının"} OrtakSat mağazası: ${activeListings.length} aktif ilan. Ürünleri incele, ortak ol veya doğrudan satıcıyla iletişime geç.`} path={id ? `/store/${id}` : undefined} image={seller?.avatar?.startsWith("http") ? seller.avatar : undefined} />
        {seller ? (
          <JsonLd id="store" json={JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Store",
            name: seller.name,
            url: `https://www.ortaksat.com/store/${seller.id}`,
            ...(seller.avatar?.startsWith("http") ? { image: seller.avatar } : {}),
            ...(reviewsAboutSeller.length > 0 && seller.rating > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(seller.rating.toFixed(1)), reviewCount: reviewsAboutSeller.length } } : {})
          })} />
        ) : null}
        {/* Cover — mağazaya özgü katmanlı banner (harici görsel yok; CSP-güvenli) */}
        <StoreCover seed={seller.id} height={150} />
        <View style={{ alignSelf: "center", marginTop: -64, maxWidth: 1280, paddingHorizontal: 20, width: "100%" }}>
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, padding: 20 }}>
            <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 18 }}>
              <View style={{ borderColor: colors.surface, borderRadius: 20, borderWidth: 4, marginTop: -54 }}>
                {isImageAvatar(seller.avatar) ? (
                  <Image source={{ uri: seller.avatar }} contentFit="cover" style={{ borderRadius: 16, height: 96, width: 96 }} />
                ) : (
                  <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 16, height: 96, justifyContent: "center", width: 96 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 30, fontWeight: "900" }}>{seller.avatar || seller.name.slice(0, 2)}</Text>
                  </View>
                )}
              </View>
              <View style={{ flex: 1, gap: 6, minWidth: 0, paddingTop: 6 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                  <Text style={{ color: colors.ink, fontSize: 24, fontWeight: "900" }}>{seller.name}</Text>
                  {seller.verifiedIdentity ? <MaterialCommunityIcons name="check-decagram" size={22} color={colors.info} /> : null}
                </View>
                <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 19, maxWidth: 560 }}>{seller.bio || translateCopy("Ortaksat'ta güvenilir satıcı.", language)}</Text>
                <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 2 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                    <MaterialCommunityIcons name="star" size={15} color={colors.gold} />
                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{seller.rating}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>({reviewsAboutSeller.length} {translateCopy("yorum", language)})</Text>
                  </View>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                    <MaterialCommunityIcons name="cart-check" size={15} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{seller.successfulSales} {translateCopy("satış", language)}</Text>
                  </View>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                    <MaterialCommunityIcons name="lightning-bolt" size={15} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>%{seller.responseRate} {translateCopy("yanıt", language)}</Text>
                  </View>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                    <MaterialCommunityIcons name="account-heart-outline" size={15} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{seller.followerCount} {translateCopy("takipçi", language)}</Text>
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, paddingTop: 6 }}>
                {!isOwnStore ? (
                  <Pressable onPress={handleFollow} accessibilityRole="button" style={{ alignItems: "center", backgroundColor: following ? colors.surfaceAlt : colors.primary, borderColor: following ? colors.primary : colors.primary, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingVertical: 11 }}>
                    <MaterialCommunityIcons name={following ? "account-heart" : "account-heart-outline"} size={17} color={following ? colors.primary : "#FFFFFF"} />
                    <Text style={{ color: following ? colors.primary : "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy(following ? "Takiptesin" : "Takip Et", language)}</Text>
                  </Pressable>
                ) : null}
                {isOwnStore ? (
                  <Link href="/create" asChild><Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingVertical: 11 }}><MaterialCommunityIcons name="plus" size={17} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Yeni ilan", language)}</Text></Pressable></Link>
                ) : (
                  <Pressable onPress={messageSeller} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingVertical: 11 }}><MaterialCommunityIcons name="message-text-outline" size={17} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Mesaj gönder", language)}</Text></Pressable>
                )}
              </View>
            </View>

            {/* Stats strip */}
            <View style={{ borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", marginTop: 18, paddingTop: 16 }}>
              <DeskProfileStat value={`${seller.rating}`} label={translateCopy("Puan", language)} />
              <DeskProfileStat value={`${seller.successfulSales}`} label={translateCopy("Satış", language)} />
              <DeskProfileStat value={`${activeListings.length}`} label={translateCopy("Aktif ilan", language)} />
              <DeskProfileStat value={`${sellerPartnerships.length}`} label={translateCopy("Ortaklık", language)} />
              <DeskProfileStat value={`%${trust?.seller.score ?? 0}`} label={translateCopy("Satıcı güveni", language)} last />
            </View>
          </View>

          {/* Tabs */}
          <View style={{ flexDirection: "row", gap: 4, marginTop: 16 }}>
            {tabs.map((tb) => {
              const on = tab === tb.key;
              return (
                <Pressable key={tb.key} onPress={() => setTab(tb.key)} style={{ borderBottomColor: on ? colors.primary : "transparent", borderBottomWidth: 2.5, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 11 }}>
                  <Text style={{ color: on ? colors.primaryDark : colors.muted, fontSize: 14, fontWeight: "800" }}>{tb.label}</Text>
                  {tb.count != null ? <View style={{ backgroundColor: on ? colors.primarySoft : colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}><Text style={{ color: on ? colors.primaryDark : colors.muted, fontSize: 11, fontWeight: "800" }}>{tb.count}</Text></View> : null}
                </Pressable>
              );
            })}
          </View>
          <View style={{ backgroundColor: colors.line, height: 1, marginBottom: 16 }} />

          {/* Body: content + sidebar */}
          <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 20 }}>
            <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
              {tab === "about" ? (
                <>
                  <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
                    <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{translateCopy("Hakkında", language)}</Text>
                    <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "500", lineHeight: 22 }}>{seller.bio || translateCopy("Bu satıcı henüz bir açıklama eklememiş. Ortaksat üzerinde doğrulanmış bir satıcıdır ve güvenli alışveriş sunar.", language)}</Text>
                    <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 10, marginTop: 4, paddingTop: 14 }}>
                      <DeskAboutRow icon="cart-check" label={translateCopy("Toplam satış", language)} value={`${seller.successfulSales}`} />
                      <DeskAboutRow icon="lightning-bolt" label={translateCopy("Yanıt oranı", language)} value={`%${seller.responseRate}`} />
                      <DeskAboutRow icon="tag-multiple-outline" label={translateCopy("Toplam komisyon havuzu", language)} value={money(totalCommission)} />
                      <DeskAboutRow icon="shield-check" label={translateCopy("Satıcı güven puanı", language)} value={`%${trust?.seller.score ?? 0}`} />
                    </View>
                  </View>
                  {hasPartnerActivity ? (
                    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 18 }}>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                        <MaterialCommunityIcons name="handshake-outline" size={19} color={colors.primaryDark} />
                        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{translateCopy("Ortak karnesi", language)}</Text>
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500", lineHeight: 19 }}>{translateCopy("Bu kişinin başka satıcıların ürünlerini ortak olarak satarak / alıcı getirerek oluşturduğu performans.", language)}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                        <PartnerScoreCell value={`${partnerBroughtSales}`} label={translateCopy("Getirdiği satış", language)} />
                        <PartnerScoreCell value={`${partnerActiveCount}`} label={translateCopy("Aktif ortaklık", language)} />
                        <PartnerScoreCell value={money(partnerEarned)} label={translateCopy("Kazandırdığı komisyon", language)} />
                        <PartnerScoreCell value={`%${trust?.partner.score ?? 0}`} label={translateCopy("Ortak güven puanı", language)} />
                      </View>
                    </View>
                  ) : null}
                  {featured.length > 0 ? (
                    <View style={{ gap: 12 }}>
                      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{translateCopy("Vitrin", language)}</Text>
                        <Pressable onPress={() => setTab("listings")}><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Tüm ilanları gör →", language)}</Text></Pressable>
                      </View>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                        {featured.map((listing) => <ListingCard key={listing.id} listing={listing} owner={seller} width={deskCardWidth} />)}
                      </View>
                    </View>
                  ) : null}
                </>
              ) : null}

              {tab === "listings" ? (
                <>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <StoreFilterChip active={filter === "active"} icon="check-circle-outline" label="Aktif" onPress={() => setFilter("active")} />
                    <StoreFilterChip active={filter === "partner"} icon="handshake-outline" label="Ortaklığa açık" onPress={() => setFilter("partner")} />
                    <StoreFilterChip active={filter === "all"} icon="view-grid-outline" label="Tümü" onPress={() => setFilter("all")} />
                  </View>
                  {/* Mağaza-içi sıralama (Trendyol mağaza sayfasındaki gibi). */}
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                    <StoreFilterChip active={storeSort === "new"} icon="clock-outline" label="En yeni" onPress={() => setStoreSort("new")} />
                    <StoreFilterChip active={storeSort === "priceAsc"} icon="sort-ascending" label="En düşük fiyat" onPress={() => setStoreSort("priceAsc")} />
                    <StoreFilterChip active={storeSort === "priceDesc"} icon="sort-descending" label="En yüksek fiyat" onPress={() => setStoreSort("priceDesc")} />
                  </View>
                  {sellerListings.length === 0 ? (
                    <EmptyState title={translateCopy("Ürün yok", language)} body={isOwnStore ? translateCopy("İlk ilanını açınca burada görünür.", language) : translateCopy("Bu mağazada şu an görünür ürün yok.", language)} />
                  ) : (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                      {sellerListings.map((listing) => <ListingCard key={listing.id} listing={listing} owner={seller} width={deskCardWidth} />)}
                    </View>
                  )}
                </>
              ) : null}

              {tab === "partnerships" ? (
                <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 4, padding: 18 }}>
                  <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: 6 }}>{translateCopy("Ortaklığa açık ilanlar", language)}</Text>
                  {sellerPartnerships.length === 0 ? (
                    <EmptyState title={translateCopy("Ortaklık yok", language)} body={translateCopy("Bu satıcının ortaklığa açık ilanı bulunmuyor.", language)} />
                  ) : activeListings.filter((l) => l.partnershipMode !== "invite").map((l, idx) => (
                    <Link key={l.id} href={{ pathname: "/listing/[id]", params: { id: l.id } }} asChild>
                      <Pressable style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : "transparent", borderTopColor: colors.line, borderTopWidth: idx === 0 ? 0 : 1, flexDirection: "row", gap: 12, paddingVertical: 12 })}>
                        <Image source={{ uri: l.image }} contentFit="cover" style={{ backgroundColor: colors.line, borderRadius: 10, height: 48, width: 48 }} />
                        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                          <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>{displayText(l.title)}</Text>
                          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{l.category} · {l.location}</Text>
                        </View>
                        <View style={{ alignItems: "flex-end", gap: 2 }}>
                          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{money(l.price)}</Text>
                          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                            <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "800" }}>{l.commissionType === "rate" ? `%${l.commissionValue}` : money(l.commissionValue)} {translateCopy("komisyon", language)}</Text>
                          </View>
                        </View>
                      </Pressable>
                    </Link>
                  ))}
                </View>
              ) : null}

              {tab === "policies" ? (
                <StorePolicies listings={activeListings} language={language} />
              ) : null}

              {tab === "reviews" ? (
                <View style={{ gap: 12 }}>
                  {reviewsAboutSeller.length > 0 ? <ReviewSummary reviews={reviewsAboutSeller} rating={seller.rating} language={language} /> : null}
                  {reviewsAboutSeller.length > 1 ? <ReviewSortBar value={reviewSort} onChange={setReviewSort} language={language} /> : null}
                  {reviewsAboutSeller.length === 0 ? (
                    <EmptyState title={translateCopy("Henüz yorum yok", language)} body={translateCopy("Bu satıcı için ilk değerlendirmeyi sen yapabilirsin.", language)} />
                  ) : reviewsAboutSeller.map((r) => (
                    <ReviewCard key={r.id} review={r} reviewerName={findUser(r.reviewerId)?.name} isSeller={isOwnStore} authed={isAuthed} onPatch={patchReview} onRemove={removeFetched} isMine={r.reviewerId === currentUser.id} onEdit={editReview} onDelete={deleteReview} onReport={reportReview} language={language} />
                  ))}
                </View>
              ) : null}

              {tab === "badges" ? (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
                  {badges.map((b) => (
                    <View key={b.label} style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 200, flexGrow: 1, gap: 8, opacity: b.on ? 1 : 0.5, padding: 18 }}>
                      <View style={{ alignItems: "center", backgroundColor: b.on ? b.tint : colors.surfaceAlt, borderRadius: 14, height: 52, justifyContent: "center", width: 52 }}>
                        <MaterialCommunityIcons name={b.icon} size={28} color={b.on ? b.color : colors.subtle} />
                      </View>
                      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900", textAlign: "center" }}>{b.label}</Text>
                      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600", textAlign: "center" }}>{b.sub}</Text>
                      {b.on ? <View style={{ backgroundColor: colors.successSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}><Text style={{ color: colors.success, fontSize: 11, fontWeight: "800" }}>{translateCopy("Kazanıldı", language)}</Text></View> : <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>{translateCopy("Henüz yok", language)}</Text>}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Sidebar */}
            <View style={{ gap: 16, width: 300 }}>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 18 }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Doğrulama durumu", language)}</Text>
                {[
                  { label: translateCopy("Kimlik", language), on: seller.verifiedIdentity },
                  { label: translateCopy("Telefon", language), on: seller.verifiedPhone },
                  { label: "Instagram", on: !!seller.verifiedInstagram }
                ].map((v) => (
                  <View key={v.label} style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
                    <MaterialCommunityIcons name={v.on ? "check-circle" : "close-circle-outline"} size={18} color={v.on ? colors.success : colors.subtle} />
                    <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{v.label}</Text>
                    <Text style={{ color: v.on ? colors.success : colors.muted, fontSize: 12, fontWeight: "800" }}>{v.on ? translateCopy("Onaylı", language) : translateCopy("Bekliyor", language)}</Text>
                  </View>
                ))}
              </View>

              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Güven puanı", language)}</Text>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
                  <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 56, justifyContent: "center", width: 56 }}>
                    <Text style={{ color: colors.primaryDark, fontSize: 18, fontWeight: "900" }}>%{trust?.overall ?? 0}</Text>
                  </View>
                  <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy("Doğrulama, satış geçmişi ve yorumlara göre hesaplanır.", language)}</Text>
                </View>
              </View>

              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("İletişim", language)}</Text>
                {isOwnStore ? (
                  <Link href="/profile-edit" asChild><Pressable style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}><MaterialCommunityIcons name="account-edit-outline" size={17} color={colors.primaryDark} /><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Profili düzenle", language)}</Text></Pressable></Link>
                ) : (
                  <Pressable onPress={messageSeller} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}><MaterialCommunityIcons name="message-text-outline" size={17} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>{translateCopy("Mesaj gönder", language)}</Text></Pressable>
                )}
                {!isOwnStore ? (
                  revealedPhone ? (
                    <Pressable onPress={() => void openUrlSafe(`tel:${trPhoneIntl(revealedPhone)}`)} style={{ alignItems: "center", backgroundColor: colors.successSoft, borderColor: colors.success, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}><MaterialCommunityIcons name="phone" size={17} color={colors.success} /><Text selectable style={{ color: colors.success, fontSize: 14, fontWeight: "900" }}>{revealedPhone}</Text></Pressable>
                  ) : (
                    <Pressable onPress={() => void revealPhone()} style={{ alignItems: "center", borderColor: colors.primary, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}><MaterialCommunityIcons name="phone-outline" size={17} color={colors.primaryDark} /><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{revealingPhone ? "…" : translateCopy("Numarayı Göster", language)}</Text></Pressable>
                  )
                ) : null}
                {!isOwnStore ? (
                  <Pressable onPress={() => void handleReportSeller()} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}><MaterialCommunityIcons name="flag-outline" size={17} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Satıcıyı şikayet et", language)}</Text></Pressable>
                ) : null}
              </View>
            </View>
          </View>
        </View>

        <View style={{ marginTop: 20 }}>
          <WebFooter />
        </View>
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      contentContainerStyle={{ gap: 12, padding: 12, paddingBottom: 104 }}
    >
      <StoreCover seed={seller.id} height={92} radius={10} />
      <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, gap: 12, marginTop: -44, padding: 14 }}>
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
          <Metric label={translateCopy("Takipçi", language)} value={`${seller.followerCount}`} />
          <Metric label={t("earning")} value={money(totalCommission)} />
        </View>
        {!isOwnStore ? (
          <Pressable onPress={handleFollow} accessibilityRole="button" style={{ alignItems: "center", backgroundColor: following ? colors.surfaceAlt : colors.primary, borderColor: colors.primary, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 12 }}>
            <MaterialCommunityIcons name={following ? "account-heart" : "account-heart-outline"} size={18} color={following ? colors.primary : "#FFFFFF"} />
            <Text style={{ color: following ? colors.primary : "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{translateCopy(following ? "Takiptesin" : "Takip Et", language)}</Text>
          </Pressable>
        ) : null}

        {hasPartnerActivity ? (
          <View style={{ backgroundColor: colors.primarySoft, borderRadius: 10, gap: 8, padding: 12 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
              <MaterialCommunityIcons name="handshake-outline" size={16} color={colors.primaryDark} />
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{translateCopy("Ortak karnesi", language)}</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <PartnerScoreCell value={`${partnerBroughtSales}`} label={translateCopy("Getirdiği satış", language)} />
              <PartnerScoreCell value={`${partnerActiveCount}`} label={translateCopy("Aktif ortaklık", language)} />
              <PartnerScoreCell value={money(partnerEarned)} label={translateCopy("Kazandırdığı komisyon", language)} />
              <PartnerScoreCell value={`%${trust?.partner.score ?? 0}`} label={translateCopy("Ortak güveni", language)} />
            </View>
          </View>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          {isOwnStore ? (
            <View style={{ flex: 1 }}>
              <PrimaryButton href="/create" icon="store-plus-outline">{translateCopy("Yeni ilan aç", language)}</PrimaryButton>
            </View>
          ) : (
            <View style={{ flex: 1 }}>
              <PrimaryButton icon="message-text-outline" onPress={messageSeller}>{translateCopy("Mağazaya mesaj gönder", language)}</PrimaryButton>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <PrimaryButton href={isOwnStore ? "/(tabs)/seller" : "/(tabs)/partner"} tone="secondary" icon={isOwnStore ? "storefront-outline" : "handshake-outline"}>
              {isOwnStore ? translateCopy("Satıcı paneli", language) : translateCopy("Ortaklık ürünleri", language)}
            </PrimaryButton>
          </View>
          {/* Şikayet et (mobil) — masaüstü sidebar'daki güvenlik aksiyonunun karşılığı. */}
          {!isOwnStore ? (
            <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Satıcıyı şikayet et", language)} onPress={() => void handleReportSeller()} style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, justifyContent: "center", opacity: pressed ? 0.7 : 1, paddingHorizontal: 12 })}>
              <MaterialCommunityIcons name="flag-outline" size={19} color={colors.muted} />
            </Pressable>
          ) : null}
        </View>
        {/* Numarayı Göster (mobil, Sahibinden tarzı) */}
        {!isOwnStore ? (
          revealedPhone ? (
            <Pressable onPress={() => void openUrlSafe(`tel:${trPhoneIntl(revealedPhone)}`)} style={{ alignItems: "center", backgroundColor: colors.successSoft, borderColor: colors.success, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 8, paddingVertical: 12 }}><MaterialCommunityIcons name="phone" size={18} color={colors.success} /><Text selectable style={{ color: colors.success, fontSize: 15, fontWeight: "900" }}>{revealedPhone}</Text></Pressable>
          ) : (
            <Pressable onPress={() => void revealPhone()} style={{ alignItems: "center", borderColor: colors.primary, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", marginTop: 8, paddingVertical: 12 }}><MaterialCommunityIcons name="phone-outline" size={18} color={colors.primaryDark} /><Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "800" }}>{revealingPhone ? "…" : translateCopy("Numarayı Göster", language)}</Text></Pressable>
          )
        ) : null}
      </View>

      {/* Doğrulama rozetleri (mobil) — güven sinyali masaüstündeki gibi görünür. */}
      <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 8, borderWidth: 1, gap: 8, padding: 12 }}>
        <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{translateCopy("Doğrulama & rozetler", language)}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
          {badges.map((b) => (
            <View key={b.label} style={{ alignItems: "center", backgroundColor: b.on ? b.tint : colors.surfaceAlt, borderRadius: 999, flexDirection: "row", gap: 5, opacity: b.on ? 1 : 0.55, paddingHorizontal: 10, paddingVertical: 6 }}>
              <MaterialCommunityIcons name={b.on ? b.icon : "lock-outline"} size={13} color={b.on ? b.color : colors.subtle} />
              <Text style={{ color: b.on ? b.color : colors.subtle, fontSize: 11.5, fontWeight: "800" }}>{b.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <StoreFilterChip active={filter === "active"} icon="check-circle-outline" label="Aktif" onPress={() => setFilter("active")} />
        <StoreFilterChip active={filter === "partner"} icon="handshake-outline" label="Ortaklığa açık" onPress={() => setFilter("partner")} />
        <StoreFilterChip active={filter === "all"} icon="view-grid-outline" label="Tümü" onPress={() => setFilter("all")} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        <StoreFilterChip active={storeSort === "new"} icon="clock-outline" label="En yeni" onPress={() => setStoreSort("new")} />
        <StoreFilterChip active={storeSort === "priceAsc"} icon="sort-ascending" label="En düşük fiyat" onPress={() => setStoreSort("priceAsc")} />
        <StoreFilterChip active={storeSort === "priceDesc"} icon="sort-descending" label="En yüksek fiyat" onPress={() => setStoreSort("priceDesc")} />
      </ScrollView>

      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text selectable style={{ color: colors.ink, flex: 1, fontSize: 19, fontWeight: "900" }}>
          {translateCopy("Mağaza ürünleri", language)}
        </Text>
        <Text selectable style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>
          {sellerListings.length} {t("results")}
        </Text>
      </View>

      {sellerListings.length === 0 ? (
        <EmptyState title={translateCopy("Ürün yok", language)} body={isOwnStore ? translateCopy("İlk ilanını açınca mağazana ve ana pazara otomatik düşer.", language) : translateCopy("Bu mağazada şu an görünür ürün yok.", language)} />
      ) : (
        <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: gridGap }}>
          {sellerListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} owner={seller} width={cardWidth} />
          ))}
        </View>
      )}

      {/* Politikalar (mobil) — masaüstü sekmesinin karşılığı; ilanlardan derlenir. */}
      {activeListings.length > 0 ? (
        <View style={{ gap: 10, marginTop: 4 }}>
          <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: "900" }}>
            {translateCopy("Mağaza politikaları", language)}
          </Text>
          <StorePolicies listings={activeListings} language={language} />
        </View>
      ) : null}

      {/* Yorumlar (mobil) — güven sinyali masaüstündeki gibi görünür. */}
      <View style={{ gap: 10, marginTop: 4 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 19, fontWeight: "900" }}>
          {translateCopy("Satıcı yorumları", language)} {reviewsAboutSeller.length ? `(${reviewsAboutSeller.length})` : ""}
        </Text>
        {reviewsAboutSeller.length > 0 ? <ReviewSummary reviews={reviewsAboutSeller} rating={seller.rating} language={language} /> : null}
        {reviewsAboutSeller.length > 1 ? <ReviewSortBar value={reviewSort} onChange={setReviewSort} language={language} /> : null}
        {reviewsAboutSeller.length === 0 ? (
          <EmptyState title={translateCopy("Henüz yorum yok", language)} body={translateCopy("Bu satıcı için ilk değerlendirmeyi sen yapabilirsin.", language)} />
        ) : (
          // Mobilde de paylaşılan ReviewCard: satıcı yanıtı + faydalı oyu masaüstüyle eşit (eskiden
          // mobil satır bunları HİÇ göstermiyordu → satıcı yanıtları mobil ziyaretçiye görünmezdi).
          reviewsAboutSeller.map((r) => (
            <ReviewCard key={r.id} review={r} reviewerName={findUser(r.reviewerId)?.name} isSeller={isOwnStore} authed={isAuthed} onPatch={patchReview} onRemove={removeFetched} isMine={r.reviewerId === currentUser.id} onEdit={editReview} onDelete={deleteReview} onReport={reportReview} language={language} />
          ))
        )}
      </View>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Yorum özeti: büyük ortalama + yıldız satırı + 5★..1★ dağılım barları (Trendyol/Sahibinden).
type ReviewSort = "recent" | "high" | "low" | "helpful";
function ReviewSortBar({ value, onChange, language }: { value: ReviewSort; onChange: (v: ReviewSort) => void; language: "tr" | "en" }) {
  const opts: Array<{ key: ReviewSort; label: string }> = [
    { key: "recent", label: translateCopy("En yeni", language) },
    { key: "high", label: translateCopy("En yüksek", language) },
    { key: "low", label: translateCopy("En düşük", language) },
    { key: "helpful", label: translateCopy("En faydalı", language) }
  ];
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {opts.map((o) => {
        const on = value === o.key;
        return (
          <Pressable key={o.key} onPress={() => onChange(o.key)} accessibilityRole="button" style={({ pressed }) => ({ backgroundColor: on ? colors.primary : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, opacity: pressed ? 0.8 : 1, paddingHorizontal: 12, paddingVertical: 6 })}>
            <Text style={{ color: on ? "#FFFFFF" : colors.muted, fontSize: 12, fontWeight: "800" }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ReviewSummary({ reviews, rating, language }: { reviews: Review[]; rating: number; language: "tr" | "en" }) {
  const total = reviews.length;
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 18, padding: 16 }}>
      <View style={{ alignItems: "center", justifyContent: "center", minWidth: 78, paddingHorizontal: 6 }}>
        <Text style={{ color: colors.ink, fontSize: 34, fontWeight: "900" }}>{rating.toFixed(1)}</Text>
        <View style={{ flexDirection: "row", gap: 1 }}>{[1, 2, 3, 4, 5].map((n) => <MaterialCommunityIcons key={n} name={n <= Math.round(rating) ? "star" : "star-outline"} size={13} color={colors.gold} />)}</View>
        <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700", marginTop: 2 }}>{total} {translateCopy("yorum", language)}</Text>
      </View>
      <View style={{ flex: 1, gap: 4, justifyContent: "center" }}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = reviews.filter((r) => Math.round(r.rating) === star).length;
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <View key={star} style={{ alignItems: "center", flexDirection: "row", gap: 7 }}>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "800", width: 10 }}>{star}</Text>
              <MaterialCommunityIcons name="star" size={11} color={colors.gold} />
              <View style={{ backgroundColor: colors.line, borderRadius: 999, flex: 1, height: 7, overflow: "hidden" }}>
                <View style={{ backgroundColor: colors.gold, height: 7, width: `${pct}%` }} />
              </View>
              <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700", textAlign: "right", width: 24 }}>{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Mağazaya özgü katmanlı banner. Harici görsel yok (CSP), gradient kütüphanesi
// yok — üst üste bindirilmiş yarı saydam Views ile derinlik. Tohum (seller.id)
// aksan tonunu belirler; her mağaza farklı görünür ama marka tutarlı kalır.
function StoreCover({ seed, height = 150, radius = 0 }: { seed: string; height?: number; radius?: number }) {
  const accents = [colors.primary, colors.info, colors.gold, colors.accent];
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const accent = accents[h % accents.length];
  return (
    <View style={{ backgroundColor: colors.primaryDark, borderRadius: radius, height, overflow: "hidden" }}>
      <View style={{ position: "absolute", backgroundColor: colors.primary, opacity: 0.5, width: "170%", height: 130, top: -24, left: -60, transform: [{ rotate: "-7deg" }] }} />
      <View style={{ position: "absolute", backgroundColor: accent, opacity: 0.3, width: 240, height: 240, borderRadius: 240, right: -60, top: -80 }} />
      <View style={{ position: "absolute", backgroundColor: "#FFFFFF", opacity: 0.07, width: 170, height: 170, borderRadius: 170, right: 150, bottom: -90 }} />
      <View style={{ position: "absolute", backgroundColor: accent, opacity: 0.16, width: 130, height: 130, borderRadius: 130, left: -40, bottom: -60 }} />
    </View>
  );
}

// Mağaza politikaları: satıcının AKTİF ilanlarındaki gerçek alanlardan derlenir
// (sahte veri yok). Aracı-platform/para-tutmaz uyarısı her zaman görünür.
function StorePolicies({ listings, language }: { listings: Listing[]; language: "tr" | "en" }) {
  const tr = (s: string) => translateCopy(s, language);
  const returnDays = listings.map((l) => l.returnWindowDays).filter((d) => d > 0);
  const minReturn = returnDays.length ? Math.min(...returnDays) : 0;
  const maxReturn = returnDays.length ? Math.max(...returnDays) : 0;
  const dueDays = listings.map((l) => l.commissionDueDays).filter((d) => d > 0);
  const minDue = dueDays.length ? Math.min(...dueDays) : 0;
  const maxDue = dueDays.length ? Math.max(...dueDays) : 0;
  const deliveryNotes = Array.from(new Set(listings.map((l) => (l.deliveryNote || "").trim()).filter(Boolean))).slice(0, 4);
  const contactLabels: Record<string, string> = { whatsapp: "WhatsApp", phone: tr("Telefon"), message: tr("Uygulama içi mesaj") };
  const contacts = Array.from(new Set(listings.map((l) => l.contactMethod))).map((c) => contactLabels[c] ?? c);
  const partnerRules = Array.from(new Set(listings.flatMap((l) => l.partnerRules || []).map((r) => r.trim()).filter(Boolean))).slice(0, 6);

  const returnText = returnDays.length === 0 ? tr("İlana göre değişir") : minReturn === maxReturn ? `${minReturn} ${tr("gün")}` : `${minReturn}–${maxReturn} ${tr("gün")}`;
  const dueText = dueDays.length === 0 ? tr("Satışta belirlenir") : minDue === maxDue ? `${minDue} ${tr("gün")}` : `${minDue}–${maxDue} ${tr("gün")}`;

  return (
    <View style={{ gap: 12 }}>
      <PolicyCard icon="cash-remove" title={tr("Ödeme modeli")} tone="warn" body={tr("OrtakSat bir aracı platformdur — para tutmaz, ödeme almaz. Ödeme, teslimat ve iade tamamen alıcı ile satıcı arasında yapılır. Görüşmeyi uygulama içi mesajdan yürütmen önerilir.")} />
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <PolicyStat icon="backup-restore" title={tr("İade süresi")} value={returnText} />
        <PolicyStat icon="cash-clock" title={tr("Komisyon vadesi")} value={dueText} />
        <PolicyStat icon="phone-outline" title={tr("İletişim")} value={contacts.length ? contacts.join(" · ") : tr("Uygulama içi mesaj")} />
      </View>
      {deliveryNotes.length > 0 ? (
        <PolicyCard icon="truck-outline" title={tr("Teslimat / kargo")} list={deliveryNotes} />
      ) : (
        <PolicyCard icon="truck-outline" title={tr("Teslimat / kargo")} body={tr("Teslimat koşulları ilana göre değişir; ilan sayfasındaki teslimat notuna bak veya satıcıya sor.")} />
      )}
      {partnerRules.length > 0 ? <PolicyCard icon="handshake-outline" title={tr("Ortaklık kuralları")} list={partnerRules} /> : null}
      <Text style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600", lineHeight: 17 }}>{tr("Bu politikalar satıcının aktif ilanlarından derlenmiştir. Kesin koşullar için ilgili ilanı incele.")}</Text>
    </View>
  );
}

function PolicyCard({ icon, title, body, list, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; body?: string; list?: string[]; tone?: "warn" }) {
  const warn = tone === "warn";
  return (
    <View style={{ backgroundColor: warn ? colors.warningSoft : colors.surface, borderColor: warn ? colors.warning : colors.line, borderRadius: 16, borderWidth: 1, gap: 8, padding: 18 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name={icon} size={19} color={warn ? colors.warning : colors.primaryDark} />
        <Text style={{ color: colors.ink, fontSize: 15.5, fontWeight: "900" }}>{title}</Text>
      </View>
      {body ? <Text style={{ color: warn ? colors.warning : colors.muted, fontSize: 13.5, fontWeight: "500", lineHeight: 20 }}>{body}</Text> : null}
      {list ? list.map((item, i) => (
        <View key={i} style={{ flexDirection: "row", gap: 8 }}>
          <MaterialCommunityIcons name="check-circle" size={15} color={colors.success} style={{ marginTop: 3 }} />
          <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "500", lineHeight: 20 }}>{item}</Text>
        </View>
      )) : null}
    </View>
  );
}

function PolicyStat({ icon, title, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; title: string; value: string }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 150, flexGrow: 1, gap: 6, padding: 14 }}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>{title}</Text>
      <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{value}</Text>
    </View>
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

function DeskProfileStat({ value, label, last }: { value: string; label: string; last?: boolean }) {
  return (
    <View style={{ alignItems: "center", borderRightColor: colors.line, borderRightWidth: last ? 0 : 1, flex: 1, gap: 3 }}>
      <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function PartnerScoreCell({ value, label }: { value: string; label: string }) {
  return (
    <View style={{ backgroundColor: colors.primarySoft, borderRadius: 12, flexBasis: 130, flexGrow: 1, gap: 3, padding: 13 }}>
      <Text style={{ color: colors.primaryDark, fontSize: 19, fontWeight: "900" }}>{value}</Text>
      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

function DeskAboutRow({ icon, label, value }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <MaterialCommunityIcons name={icon} size={18} color={colors.primary} />
      <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function isImageAvatar(value: string) {
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("file:");
}

// Yorum kartı: puan/yorum + satıcı yanıtı (yalnız satıcı yazar) + "Faydalı" oyu (girişli kullanıcı).
function ReviewCard({ review, reviewerName, isSeller, authed, onPatch, onRemove, isMine, onEdit, onDelete, onReport, language }: { review: Review; reviewerName?: string; isSeller: boolean; authed?: boolean; onPatch?: (id: string, patch: Partial<Review>) => void; onRemove?: (id: string) => void; isMine?: boolean; onEdit?: (id: string, rating: number, comment: string) => Promise<boolean>; onDelete?: (id: string) => Promise<boolean>; onReport?: (review: Review, details?: string) => Promise<boolean>; language: "tr" | "en" }) {
  const router = useRouter();
  const [savedReply, setSavedReply] = useState(review.sellerReply);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.sellerReply ?? "");
  const [saving, setSaving] = useState(false);
  const [helpful, setHelpful] = useState(review.helpfulCount ?? 0);
  const [voting, setVoting] = useState(false);
  const [voteErr, setVoteErr] = useState(false);
  // Kendi yorumunu düzenleme + şikayet durumları
  const [editingOwn, setEditingOwn] = useState(false);
  const [ownRating, setOwnRating] = useState(review.rating);
  const [ownComment, setOwnComment] = useState(review.comment);
  const [ownBusy, setOwnBusy] = useState(false);
  const [reported, setReported] = useState(false);
  const saveOwnEdit = async () => {
    if (ownBusy || !onEdit || !ownComment.trim()) return;
    setOwnBusy(true);
    const ok = await onEdit(review.id, ownRating, ownComment.trim());
    setOwnBusy(false);
    if (ok) { onPatch?.(review.id, { rating: ownRating, comment: ownComment.trim() }); setEditingOwn(false); }
  };
  const deleteOwn = async () => {
    if (ownBusy || !onDelete) return;
    setOwnBusy(true);
    const ok = await onDelete(review.id);
    setOwnBusy(false);
    if (ok) onRemove?.(review.id);
  };
  const reportOne = async () => {
    if (reported || !onReport) return;
    const ok = await onReport(review);
    if (ok) setReported(true);
  };
  // Kaynak prop güncellenince (onPatch sonrası / yeniden fetch) yerel durumu senkronize et —
  // tab değişip geri dönünce (remount) stale değer seed'lenmesin.
  useEffect(() => { setSavedReply(review.sellerReply); }, [review.sellerReply]);
  useEffect(() => { setHelpful(review.helpfulCount ?? 0); }, [review.helpfulCount]);

  const submitReply = async () => {
    if (saving) return;
    setSaving(true);
    const text = draft.trim();
    const ok = await replyToReviewLive(review.id, text);
    setSaving(false);
    if (ok) { setSavedReply(text || undefined); setEditing(false); onPatch?.(review.id, { sellerReply: text || undefined }); }
  };
  const vote = async () => {
    if (voting) return;
    // Girişsizse doğrudan girişe yönlendir (RPC'yi çağırıp null'ı "giriş yok" sanmak yerine).
    if (authed === false) { router.push("/auth"); return; }
    setVoting(true);
    setVoteErr(false);
    const n = await toggleReviewHelpfulLive(review.id);
    setVoting(false);
    if (n == null) { setVoteErr(true); return; } // GEÇİCİ hata (ağ/RPC) — girişli kullanıcıyı /auth'a ATMA
    setHelpful(n);
    onPatch?.(review.id, { helpfulCount: n });
  };

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 8, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 38, justifyContent: "center", width: 38 }}>
          <MaterialCommunityIcons name="account" size={20} color={colors.primaryDark} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{reviewerName ?? translateCopy("Kullanıcı", language)}</Text>
            {review.saleId ? (
              <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 999, flexDirection: "row", gap: 3, paddingHorizontal: 7, paddingVertical: 2 }}>
                <MaterialCommunityIcons name="check-decagram" size={12} color={colors.success} />
                <Text style={{ color: colors.success, fontSize: 10.5, fontWeight: "900" }}>{translateCopy("Doğrulanmış satış", language)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{shortDate(review.createdAt)}</Text>
        </View>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 2 }}>
          {[1, 2, 3, 4, 5].map((n) => <MaterialCommunityIcons key={n} name={n <= review.rating ? "star" : "star-outline"} size={15} color={colors.gold} />)}
        </View>
      </View>
      {editingOwn && isMine ? (
        <View style={{ gap: 8 }}>
          <StarRatingInput value={ownRating} onChange={setOwnRating} size={26} />
          <TextInput value={ownComment} onChangeText={setOwnComment} multiline placeholder={translateCopy("Yorumun…", language)} placeholderTextColor={colors.subtle} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 13.5, minHeight: 64, padding: 10, textAlignVertical: "top" }} />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={saveOwnEdit} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, opacity: pressed ? 0.85 : 1, paddingHorizontal: 16, paddingVertical: 9 })}>
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{ownBusy ? translateCopy("Kaydediliyor…", language) : translateCopy("Kaydet", language)}</Text>
            </Pressable>
            <Pressable onPress={() => { setEditingOwn(false); setOwnRating(review.rating); setOwnComment(review.comment); }} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14, paddingVertical: 9 })}>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Vazgeç", language)}</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "500", lineHeight: 20 }}>{review.comment}</Text>
      )}

      {savedReply ? (
        <View style={{ backgroundColor: colors.primarySoft, borderRadius: 12, borderLeftColor: colors.primary, borderLeftWidth: 3, gap: 3, marginTop: 2, padding: 11 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
            <MaterialCommunityIcons name="storefront-outline" size={13} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{translateCopy("Satıcı yanıtı", language)}</Text>
          </View>
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "500", lineHeight: 19 }}>{savedReply}</Text>
        </View>
      ) : null}

      <View style={{ alignItems: "center", flexDirection: "row", gap: 8, marginTop: 2 }}>
        <Pressable onPress={vote} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, opacity: pressed ? 0.7 : 1, paddingHorizontal: 11, paddingVertical: 6 })}>
          <MaterialCommunityIcons name="thumb-up-outline" size={14} color={colors.muted} />
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Faydalı", language)}{helpful > 0 ? ` · ${helpful}` : ""}</Text>
        </Pressable>
        {isSeller ? (
          <Pressable onPress={() => { setDraft(savedReply ?? ""); setEditing((e) => !e); }} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 5, opacity: pressed ? 0.7 : 1, paddingHorizontal: 4, paddingVertical: 6 })}>
            <MaterialCommunityIcons name="reply-outline" size={15} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{savedReply ? translateCopy("Yanıtı düzenle", language) : translateCopy("Yanıtla", language)}</Text>
          </Pressable>
        ) : null}
        {isMine ? (
          <>
            <Pressable onPress={() => { setEditingOwn((e) => !e); setOwnRating(review.rating); setOwnComment(review.comment); }} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 4, opacity: pressed ? 0.7 : 1, paddingHorizontal: 4, paddingVertical: 6 })}>
              <MaterialCommunityIcons name="pencil-outline" size={15} color={colors.muted} />
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy("Düzenle", language)}</Text>
            </Pressable>
            <Pressable onPress={deleteOwn} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 4, opacity: pressed ? 0.7 : 1, paddingHorizontal: 4, paddingVertical: 6 })}>
              <MaterialCommunityIcons name="trash-can-outline" size={15} color={colors.accent} />
              <Text style={{ color: colors.accent, fontSize: 12, fontWeight: "800" }}>{ownBusy ? "…" : translateCopy("Sil", language)}</Text>
            </Pressable>
          </>
        ) : authed ? (
          <Pressable onPress={reportOne} disabled={reported} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", flexDirection: "row", gap: 4, marginLeft: "auto", opacity: pressed ? 0.7 : 1, paddingHorizontal: 4, paddingVertical: 6 })}>
            <MaterialCommunityIcons name={reported ? "flag-checkered" : "flag-outline"} size={15} color={colors.muted} />
            <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{reported ? translateCopy("Bildirildi", language) : translateCopy("Şikayet et", language)}</Text>
          </Pressable>
        ) : null}
        {voteErr ? <Text style={{ color: colors.accent, fontSize: 11, fontWeight: "700" }}>{translateCopy("Şu an yapılamadı, tekrar dene", language)}</Text> : null}
      </View>

      {editing && isSeller ? (
        <View style={{ gap: 8, marginTop: 2 }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            multiline
            placeholder={translateCopy("Yanıtın… (nazik ve yapıcı olun)", language)}
            placeholderTextColor={colors.subtle}
            style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 13, minHeight: 64, padding: 10, textAlignVertical: "top" }}
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Pressable onPress={submitReply} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, opacity: pressed ? 0.85 : 1, paddingHorizontal: 16, paddingVertical: 9 })}>
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{saving ? translateCopy("Kaydediliyor…", language) : translateCopy("Yanıtı kaydet", language)}</Text>
            </Pressable>
            <Pressable onPress={() => setEditing(false)} accessibilityRole="button" style={({ pressed }) => ({ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, opacity: pressed ? 0.85 : 1, paddingHorizontal: 14, paddingVertical: 9 })}>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>{translateCopy("Vazgeç", language)}</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}
