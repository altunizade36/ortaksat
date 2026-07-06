import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { Seo } from "@/components/seo";
import { ListingCard } from "@/components/listing-card";
import { EmptyState, Metric, PrimaryButton, StatusPill } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { responsiveGrid, useIsWideWeb } from "@/lib/layout";
import { shortDate } from "@/lib/locale";
import { displayText } from "@/lib/text";
import { fetchReviewsForUser } from "@/lib/live-service";
import { calculateUserTrustScores } from "@/lib/trust-score";
import type { Review } from "@/lib/types";
import { useStore } from "@/lib/use-store";

type StoreFilter = "active" | "all" | "partner";
type ProfileTab = "about" | "listings" | "partnerships" | "reviews" | "badges";

export default function StoreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language, t } = useLanguage();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const isWideWeb = useIsWideWeb();
  const { currentUser, findUser, listings, partnerships, leads, reports, reviews, sales, startConversation, reportUser } = useStore();

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
  const [tab, setTab] = useState<ProfileTab>("about");
  const [refreshing, setRefreshing] = useState(false);
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
  const cardWidth = responsiveGrid({ available: width - 24, gap: gridGap, minCardWidth: 176 }).cardWidth;

  // Bu kullanıcı HAKKINDA yazılmış yorumları canlıdan getir (global store yalnız
  // giriş yapan kullanıcının YAZDIĞI yorumları tutuyor). Böylece ziyaretçi de
  // satıcının aldığı gerçek değerlendirmeleri görür.
  const [fetchedReviews, setFetchedReviews] = useState<Review[]>([]);
  useEffect(() => {
    let alive = true;
    if (id) void fetchReviewsForUser(id).then((r) => { if (alive) setFetchedReviews(r); });
    return () => { alive = false; };
  }, [id]);
  const reviewsAboutSeller = useMemo(() => {
    const map = new Map<string, Review>();
    for (const r of reviews) if (r.reviewedUserId === id) map.set(r.id, r);
    for (const r of fetchedReviews) map.set(r.id, r);
    return Array.from(map.values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [reviews, fetchedReviews, id]);

  function refresh() {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 420);
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
    const firstListing = activeListings[0];
    if (!firstListing) {
      Alert.alert(translateCopy("İletişim kurulamadı", language), translateCopy("Bu satıcının şu an aktif ilanı yok. İlan yayınlandığında mesaj gönderebilirsin.", language));
      return;
    }
    const conversation = startConversation(firstListing.id, seller.id, `${seller.name} mağazasındaki ürünler için bilgi almak istiyorum.`);
    if (conversation) router.push({ pathname: "/chat/[id]", params: { id: conversation.id } });
    else Alert.alert(translateCopy("İletişim kurulamadı", language), translateCopy("Şu an konuşma başlatılamadı, lütfen tekrar dene.", language));
  }

  if (!seller) {
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ padding: 12 }}>
        <EmptyState title={translateCopy("Mağaza bulunamadı", language)} body={translateCopy("Bu satıcı profili kaldırılmış veya bağlantı geçersiz olabilir.", language)} />
      </ScrollView>
    );
  }

  if (isWideWeb) {
    const sellerPartnerships = partnerships.filter((p) => activeListings.some((l) => l.id === p.listingId));
    const featured = activeListings.slice(0, 3);
    const deskCardWidth = responsiveGrid({ available: Math.min(width, 1480) - 40 - 300 - 24, gap: 16, minCardWidth: 210, maxColumns: 3 }).cardWidth;
    const badges: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; sub: string; on: boolean; tint: string; color: string }> = [
      { icon: "check-decagram", label: translateCopy("Kimlik Doğrulandı", language), sub: translateCopy("Resmi kimlik onaylı", language), on: seller.verifiedIdentity, tint: colors.successSoft, color: colors.success },
      { icon: "phone-check", label: translateCopy("Telefon Doğrulandı", language), sub: translateCopy("Numara onaylı", language), on: seller.verifiedPhone, tint: colors.infoSoft, color: colors.info },
      { icon: "instagram", label: translateCopy("Instagram Bağlı", language), sub: translateCopy("Sosyal hesap onaylı", language), on: !!seller.verifiedInstagram, tint: colors.violetSoft, color: colors.violet },
      { icon: "star-circle", label: translateCopy("Yüksek Puan", language), sub: translateCopy("4.5+ değerlendirme", language), on: seller.rating >= 4.5, tint: colors.goldSoft, color: colors.gold },
      { icon: "trophy", label: translateCopy("Çok Satan", language), sub: translateCopy("50+ başarılı satış", language), on: seller.successfulSales >= 50, tint: colors.primarySoft, color: colors.primaryDark },
      { icon: "lightning-bolt", label: translateCopy("Hızlı Yanıt", language), sub: translateCopy("%90+ yanıt oranı", language), on: seller.responseRate >= 90, tint: colors.accentSoft, color: colors.accent }
    ];
    const tabs: Array<{ key: ProfileTab; label: string; count?: number }> = [
      { key: "about", label: translateCopy("Hakkında", language) },
      { key: "listings", label: translateCopy("İlanları", language), count: activeListings.length },
      { key: "partnerships", label: translateCopy("Ortaklıkları", language), count: sellerPartnerships.length },
      { key: "reviews", label: translateCopy("Yorumlar", language), count: reviewsAboutSeller.length },
      { key: "badges", label: translateCopy("Rozetler", language), count: badges.filter((b) => b.on).length }
    ];

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        <Seo title={`${seller?.name ?? "Satıcı"} — Mağaza ve ilanları | OrtakSat`} description={`${seller?.name ?? "Bu satıcının"} OrtakSat mağazası: ${activeListings.length} aktif ilan. Ürünleri incele, ortak ol veya doğrudan satıcıyla iletişime geç.`} path={id ? `/store/${id}` : undefined} image={seller?.avatar?.startsWith("http") ? seller.avatar : undefined} />
        {/* Cover */}
        <View style={{ backgroundColor: colors.primaryDark, height: 150 }} />
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
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, paddingTop: 6 }}>
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
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <StoreFilterChip active={filter === "active"} icon="check-circle-outline" label="Aktif" onPress={() => setFilter("active")} />
                    <StoreFilterChip active={filter === "partner"} icon="handshake-outline" label="Ortaklığa açık" onPress={() => setFilter("partner")} />
                    <StoreFilterChip active={filter === "all"} icon="view-grid-outline" label="Tümü" onPress={() => setFilter("all")} />
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

              {tab === "reviews" ? (
                <View style={{ gap: 12 }}>
                  {reviewsAboutSeller.length === 0 ? (
                    <EmptyState title={translateCopy("Henüz yorum yok", language)} body={translateCopy("Bu satıcı için ilk değerlendirmeyi sen yapabilirsin.", language)} />
                  ) : reviewsAboutSeller.map((r) => {
                    const reviewer = findUser(r.reviewerId);
                    return (
                      <View key={r.id} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 8, padding: 16 }}>
                        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 38, justifyContent: "center", width: 38 }}>
                            <MaterialCommunityIcons name="account" size={20} color={colors.primaryDark} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{reviewer?.name ?? translateCopy("Kullanıcı", language)}</Text>
                            <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{shortDate(r.createdAt)}</Text>
                          </View>
                          <View style={{ alignItems: "center", flexDirection: "row", gap: 2 }}>
                            {[1, 2, 3, 4, 5].map((n) => <MaterialCommunityIcons key={n} name={n <= r.rating ? "star" : "star-outline"} size={15} color={colors.gold} />)}
                          </View>
                        </View>
                        <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "500", lineHeight: 20 }}>{r.comment}</Text>
                      </View>
                    );
                  })}
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
        <EmptyState title={translateCopy("Ürün yok", language)} body={isOwnStore ? translateCopy("İlk ilanını açınca mağazana ve ana pazara otomatik düşer.", language) : translateCopy("Bu mağazada şu an görünür ürün yok.", language)} />
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
