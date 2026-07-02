import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link, useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { ListingCard } from "@/components/listing-card";
import { EmptyState, Metric, PrimaryButton, StatusPill } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { responsiveGrid, useIsWideWeb } from "@/lib/layout";
import { shortDate } from "@/lib/locale";
import { displayText } from "@/lib/text";
import { calculateUserTrustScores } from "@/lib/trust-score";
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
    const ok = await reportUser(seller.id, "Satıcı bildirimi", "Mağaza/satıcı profilinden bildirildi.");
    Alert.alert(
      ok ? translateCopy("Bildirim alındı", language) : translateCopy("Gönderilemedi", language),
      ok
        ? translateCopy("Bildiriminiz kayıt altına alındı ve incelenecek. Teşekkürler.", language)
        : translateCopy("Bildirim için e-posta ile giriş yapmalısın.", language)
    );
  }
  const [filter, setFilter] = useState<StoreFilter>("active");
  const [tab, setTab] = useState<ProfileTab>("about");
  const [following, setFollowing] = useState(false);
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

  if (isWideWeb) {
    const reviewsAboutSeller = reviews.filter((r) => r.reviewedUserId === seller.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const sellerPartnerships = partnerships.filter((p) => activeListings.some((l) => l.id === p.listingId));
    const featured = activeListings.slice(0, 3);
    const deskCardWidth = responsiveGrid({ available: Math.min(width, 1480) - 40 - 300 - 24, gap: 16, minCardWidth: 210, maxColumns: 3 }).cardWidth;
    const badges: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; sub: string; on: boolean; tint: string; color: string }> = [
      { icon: "check-decagram", label: "Kimlik Doğrulandı", sub: "Resmi kimlik onaylı", on: seller.verifiedIdentity, tint: colors.successSoft, color: colors.success },
      { icon: "phone-check", label: "Telefon Doğrulandı", sub: "SMS ile doğrulandı", on: seller.verifiedPhone, tint: colors.infoSoft, color: colors.info },
      { icon: "instagram", label: "Instagram Bağlı", sub: "Sosyal hesap onaylı", on: !!seller.verifiedInstagram, tint: colors.violetSoft, color: colors.violet },
      { icon: "star-circle", label: "Yüksek Puan", sub: "4.5+ değerlendirme", on: seller.rating >= 4.5, tint: colors.goldSoft, color: colors.gold },
      { icon: "trophy", label: "Çok Satan", sub: "50+ başarılı satış", on: seller.successfulSales >= 50, tint: colors.primarySoft, color: colors.primaryDark },
      { icon: "lightning-bolt", label: "Hızlı Yanıt", sub: "%90+ yanıt oranı", on: seller.responseRate >= 90, tint: colors.accentSoft, color: colors.accent }
    ];
    const tabs: Array<{ key: ProfileTab; label: string; count?: number }> = [
      { key: "about", label: "Hakkında" },
      { key: "listings", label: "İlanları", count: activeListings.length },
      { key: "partnerships", label: "Ortaklıkları", count: sellerPartnerships.length },
      { key: "reviews", label: "Yorumlar", count: reviewsAboutSeller.length },
      { key: "badges", label: "Rozetler", count: badges.filter((b) => b.on).length }
    ];

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        {/* Cover */}
        <View style={{ backgroundColor: colors.primaryDark, height: 150 }} />
        <View style={{ marginTop: -64, paddingHorizontal: 20 }}>
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
                <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 19, maxWidth: 560 }}>{seller.bio || "Ortaksat'ta güvenilir satıcı."}</Text>
                <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 2 }}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                    <MaterialCommunityIcons name="star" size={15} color={colors.gold} />
                    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{seller.rating}</Text>
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>({reviewsAboutSeller.length} yorum)</Text>
                  </View>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                    <MaterialCommunityIcons name="cart-check" size={15} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{seller.successfulSales} satış</Text>
                  </View>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                    <MaterialCommunityIcons name="lightning-bolt" size={15} color={colors.muted} />
                    <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>%{seller.responseRate} yanıt</Text>
                  </View>
                </View>
              </View>
              <View style={{ flexDirection: "row", gap: 10, paddingTop: 6 }}>
                {isOwnStore ? (
                  <Link href="/create" asChild><Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingVertical: 11 }}><MaterialCommunityIcons name="plus" size={17} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Yeni ilan</Text></Pressable></Link>
                ) : (
                  <Pressable onPress={messageSeller} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingVertical: 11 }}><MaterialCommunityIcons name="message-text-outline" size={17} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>Mesaj gönder</Text></Pressable>
                )}
                {!isOwnStore ? (
                  <Pressable onPress={() => setFollowing((v) => !v)} style={{ alignItems: "center", backgroundColor: following ? colors.primarySoft : colors.surface, borderColor: following ? colors.primary : colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 16, paddingVertical: 11 }}><MaterialCommunityIcons name={following ? "account-check" : "account-plus-outline"} size={17} color={colors.primaryDark} /><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{following ? "Takip ediliyor" : "Takip et"}</Text></Pressable>
                ) : null}
              </View>
            </View>

            {/* Stats strip */}
            <View style={{ borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", marginTop: 18, paddingTop: 16 }}>
              <DeskProfileStat value={`${seller.rating}`} label="Puan" />
              <DeskProfileStat value={`${seller.successfulSales}`} label="Satış" />
              <DeskProfileStat value={`${activeListings.length}`} label="Aktif ilan" />
              <DeskProfileStat value={`${sellerPartnerships.length}`} label="Ortaklık" />
              <DeskProfileStat value={`%${trust?.seller.score ?? 0}`} label="Satıcı güveni" last />
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
                    <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Hakkında</Text>
                    <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "500", lineHeight: 22 }}>{seller.bio || "Bu satıcı henüz bir açıklama eklememiş. Ortaksat üzerinde doğrulanmış bir satıcıdır ve güvenli alışveriş sunar."}</Text>
                    <View style={{ borderTopColor: colors.line, borderTopWidth: 1, gap: 10, marginTop: 4, paddingTop: 14 }}>
                      <DeskAboutRow icon="cart-check" label="Toplam satış" value={`${seller.successfulSales}`} />
                      <DeskAboutRow icon="lightning-bolt" label="Yanıt oranı" value={`%${seller.responseRate}`} />
                      <DeskAboutRow icon="tag-multiple-outline" label="Toplam komisyon havuzu" value={money(totalCommission)} />
                      <DeskAboutRow icon="shield-check" label="Satıcı güven puanı" value={`%${trust?.seller.score ?? 0}`} />
                    </View>
                  </View>
                  {hasPartnerActivity ? (
                    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 18 }}>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
                        <MaterialCommunityIcons name="handshake-outline" size={19} color={colors.primaryDark} />
                        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Ortak karnesi</Text>
                      </View>
                      <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500", lineHeight: 19 }}>Bu kişinin başka satıcıların ürünlerini ortak olarak satarak / alıcı getirerek oluşturduğu performans.</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
                        <PartnerScoreCell value={`${partnerBroughtSales}`} label="Getirdiği satış" />
                        <PartnerScoreCell value={`${partnerActiveCount}`} label="Aktif ortaklık" />
                        <PartnerScoreCell value={money(partnerEarned)} label="Kazandırdığı komisyon" />
                        <PartnerScoreCell value={`%${trust?.partner.score ?? 0}`} label="Ortak güven puanı" />
                      </View>
                    </View>
                  ) : null}
                  {featured.length > 0 ? (
                    <View style={{ gap: 12 }}>
                      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                        <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>Vitrin</Text>
                        <Pressable onPress={() => setTab("listings")}><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>Tüm ilanları gör →</Text></Pressable>
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
                    <EmptyState title="Ürün yok" body={isOwnStore ? "İlk ilanını açınca burada görünür." : "Bu mağazada şu an görünür ürün yok."} />
                  ) : (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 16 }}>
                      {sellerListings.map((listing) => <ListingCard key={listing.id} listing={listing} owner={seller} width={deskCardWidth} />)}
                    </View>
                  )}
                </>
              ) : null}

              {tab === "partnerships" ? (
                <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 4, padding: 18 }}>
                  <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: 6 }}>Ortaklığa açık ilanlar</Text>
                  {sellerPartnerships.length === 0 ? (
                    <EmptyState title="Ortaklık yok" body="Bu satıcının ortaklığa açık ilanı bulunmuyor." />
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
                            <Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "800" }}>{l.commissionType === "rate" ? `%${l.commissionValue}` : money(l.commissionValue)} komisyon</Text>
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
                    <EmptyState title="Henüz yorum yok" body="Bu satıcı için ilk değerlendirmeyi sen yapabilirsin." />
                  ) : reviewsAboutSeller.map((r) => {
                    const reviewer = findUser(r.reviewerId);
                    return (
                      <View key={r.id} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 8, padding: 16 }}>
                        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 38, justifyContent: "center", width: 38 }}>
                            <MaterialCommunityIcons name="account" size={20} color={colors.primaryDark} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{reviewer?.name ?? "Kullanıcı"}</Text>
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
                      {b.on ? <View style={{ backgroundColor: colors.successSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3 }}><Text style={{ color: colors.success, fontSize: 11, fontWeight: "800" }}>Kazanıldı</Text></View> : <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>Henüz yok</Text>}
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Sidebar */}
            <View style={{ gap: 16, width: 300 }}>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 18 }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Doğrulama durumu</Text>
                {[
                  { label: "Kimlik", on: seller.verifiedIdentity },
                  { label: "Telefon", on: seller.verifiedPhone },
                  { label: "Instagram", on: !!seller.verifiedInstagram }
                ].map((v) => (
                  <View key={v.label} style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
                    <MaterialCommunityIcons name={v.on ? "check-circle" : "close-circle-outline"} size={18} color={v.on ? colors.success : colors.subtle} />
                    <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{v.label}</Text>
                    <Text style={{ color: v.on ? colors.success : colors.muted, fontSize: 12, fontWeight: "800" }}>{v.on ? "Onaylı" : "Bekliyor"}</Text>
                  </View>
                ))}
              </View>

              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>Güven puanı</Text>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
                  <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 56, justifyContent: "center", width: 56 }}>
                    <Text style={{ color: colors.primaryDark, fontSize: 18, fontWeight: "900" }}>%{trust?.overall ?? 0}</Text>
                  </View>
                  <Text style={{ color: colors.muted, flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>Doğrulama, satış geçmişi ve yorumlara göre hesaplanır.</Text>
                </View>
              </View>

              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
                <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>İletişim</Text>
                {isOwnStore ? (
                  <Link href="/profile-edit" asChild><Pressable style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}><MaterialCommunityIcons name="account-edit-outline" size={17} color={colors.primaryDark} /><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>Profili düzenle</Text></Pressable></Link>
                ) : (
                  <Pressable onPress={messageSeller} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}><MaterialCommunityIcons name="message-text-outline" size={17} color="#FFFFFF" /><Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800" }}>Mesaj gönder</Text></Pressable>
                )}
                {!isOwnStore ? (
                  <Pressable onPress={() => void handleReportSeller()} style={{ alignItems: "center", borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}><MaterialCommunityIcons name="flag-outline" size={17} color={colors.muted} /><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "800" }}>Satıcıyı şikayet et</Text></Pressable>
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
              <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>Ortak karnesi</Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              <PartnerScoreCell value={`${partnerBroughtSales}`} label="Getirdiği satış" />
              <PartnerScoreCell value={`${partnerActiveCount}`} label="Aktif ortaklık" />
              <PartnerScoreCell value={money(partnerEarned)} label="Kazandırdığı komisyon" />
              <PartnerScoreCell value={`%${trust?.partner.score ?? 0}`} label="Ortak güveni" />
            </View>
          </View>
        ) : null}

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
