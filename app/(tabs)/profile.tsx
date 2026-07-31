import { MaterialCommunityIcons } from "@/components/icons";
import { Image } from "expo-image";
import { Link, type Href } from "expo-router";
import { Platform, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { PartnerTier } from "@/components/partner-tier";
import { ProfileStrength } from "@/components/profile-strength";
import { AuthRequired } from "@/components/auth-gate";
import { Card, Metric, PressLink, PrimaryButton, StatusPill } from "@/components/ui";
import { WebFooter } from "@/components/web-landing";
import { money } from "@/lib/format";
import { Alert } from "@/lib/alert";
import { shareOrCopy } from "@/lib/share";
import { haptic } from "@/lib/haptics";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useNativeRefresh } from "@/lib/use-native-refresh";
import { useIsWideWeb, useMounted } from "@/lib/layout";
import { ScreenSkeleton } from "@/components/screen-skeleton";
import { compactNumber } from "@/lib/locale";
import { calculateUserTrustScores } from "@/lib/trust-score";
import { useStore } from "@/lib/use-store";
import { WebContainer } from "@/components/web-container";

function isImageAvatar(value: string) {
  return value.startsWith("http") || value.startsWith("file");
}

function ProfileScreenInner() {
  const { backendMode, blockedUserIds, conversations, currentUser, favorites, followedSellerIds, leads, listings, messages, notifications, offers, partnerships, refreshUserData, reports, reviews, sales, signOut } = useStore();
  const { refreshing, onRefresh } = useNativeRefresh(refreshUserData);
  const { language, t } = useLanguage();
  const isLiveAccount = backendMode === "supabase" && currentUser.id.includes("-");
  const myListings = listings.filter((listing) => listing.ownerId === currentUser.id);
  const myPartnerships = partnerships.filter((partnership) => partnership.partnerId === currentUser.id);
  const myFavorites = favorites.filter((favorite) => favorite.userId === currentUser.id);
  // Verdiğim teklifler — satıcının listesi vardı, alıcının yoktu.
  const myOffers = offers.filter((o) => o.buyerId === currentUser.id);
  const liveOffers = myOffers.filter((o) => o.status === "pending" || o.status === "countered");
  const reviewsByMe = reviews.filter((review) => review.reviewerId === currentUser.id);
  const reviewsAboutMe = reviews.filter((review) => review.reviewedUserId === currentUser.id);
  const activeListings = myListings.filter((listing) => listing.status === "active");
  const pausedListings = myListings.filter((listing) => listing.status === "paused");
  const pendingSellerApplications = partnerships.filter((partnership) => myListings.some((listing) => listing.id === partnership.listingId) && partnership.status === "pending");
  const pendingPartnerships = myPartnerships.filter((partnership) => partnership.status === "pending");
  const activePartnerships = myPartnerships.filter((partnership) => partnership.status === "active");
  const myPartnershipIds = new Set(myPartnerships.map((partnership) => partnership.id));
  const partnerSales = sales.filter((sale) => myPartnershipIds.has(sale.partnershipId));
  const totalCommission = partnerSales.reduce((sum, sale) => sum + sale.commissionAmount, 0);
  const paidCommission = partnerSales.filter((sale) => sale.status === "paid").reduce((sum, sale) => sum + sale.commissionAmount, 0);
  const pendingCommission = partnerSales.filter((sale) => sale.status !== "paid").reduce((sum, sale) => sum + sale.commissionAmount, 0);
  const unreadMessages = messages.filter((message) => message.receiverId === currentUser.id && !message.read);
  const unreadNotifications = notifications.filter((notification) => notification.userId === currentUser.id && !notification.read);
  const myConversations = conversations.filter((conversation) => conversation.participantIds.includes(currentUser.id));
  const openReports = reports.filter((report) => report.reporterId === currentUser.id && (report.status === "open" || report.status === "reviewing"));
  const trust = calculateUserTrustScores({ leads, listings, partnerships, reports, reviews, sales, user: currentUser });
  const isWideWeb = useIsWideWeb();

  // Mağaza bağlantısını PAYLAŞ/KOPYALA (büyüme kaldıracı) — web'de navigator.share,
  // yoksa panoya kopyalar; native'de OS paylaşım paneli. Store sayfasıyla aynı desen.
  async function shareMyStore() {
    haptic.selection();
    const res = await shareOrCopy({
      title: `${currentUser.name} — OrtakSat`,
      message: `${currentUser.name} — OrtakSat mağazama göz at:`,
      url: `https://www.ortaksat.com/store/${currentUser.id}`
    });
    if (res === "copied") Alert.alert(translateCopy("Bağlantı kopyalandı", language), translateCopy("Mağaza bağlantın panoya kopyalandı; istediğin yere yapıştırabilirsin.", language));
  }

  if (isWideWeb) {
    const firstName = currentUser.name.split(" ")[0];

    const stats: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; tint: string; color: string; value: string; title: string; sub: string; href: Href }> = [
      { icon: "cash-multiple", tint: colors.successSoft, color: colors.success, value: money(totalCommission), title: translateCopy("Kayıtlı komisyon", language), sub: translateCopy("Taraflar arası anlaşma", language), href: "/earnings" as Href },
      { icon: "clock-outline", tint: colors.goldSoft, color: colors.gold, value: money(pendingCommission), title: translateCopy("Bekleyen komisyon", language), sub: translateCopy("Onay sürecinde", language), href: "/earnings" as Href },
      { icon: "storefront-outline", tint: colors.primarySoft, color: colors.primaryDark, value: `${activeListings.length}`, title: translateCopy("Aktif ilan", language), sub: `${myListings.length} toplam ilan`, href: "/(tabs)/seller" as Href },
      { icon: "handshake-outline", tint: colors.violetSoft, color: colors.violet, value: `${activePartnerships.length}`, title: translateCopy("Aktif ortaklık", language), sub: `${pendingPartnerships.length} bekliyor`, href: "/(tabs)/partner" as Href }
    ];

    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        <View style={{ alignSelf: "center", gap: 16, maxWidth: 1280, paddingHorizontal: 20, paddingTop: 16, width: "100%" }}>
        {/* Welcome banner */}
        <View style={{ backgroundColor: colors.primaryDark, borderRadius: 18, flexDirection: "row", gap: 16, overflow: "hidden", padding: 22 }}>
          <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, height: 66, justifyContent: "center", overflow: "hidden", width: 66 }}>
            {isImageAvatar(currentUser.avatar) ? <Image source={{ uri: currentUser.avatar }} accessibilityLabel={currentUser.name} contentFit="cover" style={{ height: 66, width: 66 }} /> : <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "900" }}>{currentUser.avatar}</Text>}
          </View>
          <View style={{ flex: 1, gap: 6, justifyContent: "center", minWidth: 0 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "900" }}>{translateCopy("Merhaba,", language)} {firstName} 👋</Text>
            <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 13.5, fontWeight: "600" }}>{translateCopy("Hesabının özetini, kazançlarını ve bugün dikkat etmen gereken işleri burada bulabilirsin.", language)}</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
              <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 4 }}>
                <MaterialCommunityIcons name="star" size={13} color={colors.gold} />
                <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>{currentUser.rating} {translateCopy("puan", language)}</Text>
              </View>
              <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 4 }}>
                <MaterialCommunityIcons name="shield-check" size={13} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>%{trust.overall} {translateCopy("güven", language)}</Text>
              </View>
              <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 4 }}>
                <MaterialCommunityIcons name="cart-check" size={13} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>{compactNumber(currentUser.successfulSales)} {translateCopy("satış", language)}</Text>
              </View>
            </View>
          </View>
          <View style={{ gap: 8, justifyContent: "center" }}>
            <Link href="/profile-edit" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 10, flexDirection: "row", gap: 7, paddingHorizontal: 16, paddingVertical: 10 }}>
                <MaterialCommunityIcons name="account-edit-outline" size={17} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Profili düzenle", language)}</Text>
              </Pressable>
            </Link>
            <Link href="/create" asChild>
              <Pressable style={{ alignItems: "center", borderColor: "rgba(255,255,255,0.5)", borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 16, paddingVertical: 10 }}>
                <MaterialCommunityIcons name="plus" size={17} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("İlan ver", language)}</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        {/* Stat cards — tıklanabilir (detay sayfasına götürür): komisyon → Kazançlarım,
            ilan → İlanlarım, ortaklık → Ortak Satışlarım. Eskiden ölü statik kartlardı. */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {stats.map((s) => (
            <PressLink key={s.title} href={s.href} accessibilityLabel={`${s.title}: ${s.value}`} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 220, flexGrow: 1, gap: 10, minWidth: 0, padding: 16 }}>
              <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
                <View style={{ alignItems: "center", backgroundColor: s.tint, borderRadius: 12, height: 44, justifyContent: "center", width: 44 }}>
                  <MaterialCommunityIcons name={s.icon} size={23} color={s.color} />
                </View>
                <MaterialCommunityIcons name="arrow-top-right" size={16} color={colors.subtle} />
              </View>
              <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>{s.value}</Text>
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{s.title}</Text>
              <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{s.sub}</Text>
            </PressLink>
          ))}
        </View>

        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 20 }}>
          {/* Main column */}
          <View style={{ flex: 1, gap: 16, minWidth: 0 }}>
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 18 }}>
              <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900" }}>{translateCopy("Bugün dikkat etmen gerekenler", language)}</Text>
              {(() => {
                // Sadece AKSİYON gerektirenleri göster (>0). Hepsi 0 ise sıfır-duvarı yerine
                // tek satır "her şey güncel" — yeni kullanıcıda temiz görünüm.
                const todo: Array<{ href: Href; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; n: number }> = [
                  { href: "/(tabs)/seller", icon: "account-clock-outline", label: "Ortak başvuruları", n: pendingSellerApplications.length },
                  { href: "/(tabs)/partner", icon: "handshake-outline", label: "Bekleyen ortaklıklar", n: pendingPartnerships.length },
                  { href: "/messages", icon: "message-badge-outline", label: "Okunmamış mesaj", n: unreadMessages.length },
                  { href: "/notifications", icon: "bell-outline", label: "Yeni bildirim", n: unreadNotifications.length }
                ];
                const actionable = todo.filter((x) => x.n > 0);
                if (actionable.length === 0) {
                  return (
                    <View style={{ alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 4 }}>
                      <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.success} />
                      <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "700" }}>{translateCopy("Bekleyen işin yok — her şey güncel.", language)}</Text>
                    </View>
                  );
                }
                return actionable.map((x) => <ActionRow key={x.label} href={x.href} icon={x.icon} label={x.label} tone="warning" value={`${x.n}`} />);
              })()}
            </View>

            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 6, padding: 18 }}>
              <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900", marginBottom: 4 }}>{translateCopy("Hesap özeti", language)}</Text>
              {/* 2 sütun: sol = kendi içeriğim/aktivitem, sağ = keşif/ağ/diğer. Tek uzun
                  liste yerine kompakt + sidebar yüksekliğiyle dengeli. */}
              <View style={{ flexDirection: "row", gap: 22 }}>
                <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
                  <MenuRow icon="storefront-outline" label="İlanlarım" detail={`${activeListings.length} aktif · ${pausedListings.length} duraklatılmış`} value={`${myListings.length}`} href="/(tabs)/seller" />
                  <MenuRow icon="handshake-outline" label="Ortaklıklarım" detail={`${activePartnerships.length} aktif · ${pendingPartnerships.length} bekliyor`} value={`${myPartnerships.length}`} href="/(tabs)/partner" />
                  <MenuRow icon="cash-multiple" label="Kazançlarım" detail={`${money(paidCommission)} ödendi · ${money(pendingCommission)} bekliyor`} value="→" href={"/earnings" as Href} />
                  <MenuRow icon="tag-outline" label="Tekliflerim" detail={liveOffers.length ? `${liveOffers.length} süren teklif` : "Verdiğin teklifler"} value={`${myOffers.length}`} href="/offers" />
                  <MenuRow icon="heart-outline" label="Favoriler" detail="Kaydedilen ilanlar" value={`${myFavorites.length}`} href="/favorites" />
                  <MenuRow icon="storefront-check-outline" label="Takip Ettiklerin" detail="Takip ettiğin satıcıların yeni ilanları" value={`${followedSellerIds.length}`} href="/following" />
                  <MenuRow icon="chat-outline" label="Görüşmeler" detail="Alıcı, satıcı ve ortak mesajları" value={`${myConversations.length}`} href="/(tabs)/messages" />
                </View>
                <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
                  <MenuRow icon="star-outline" label="Değerlendirmeler" detail={`${reviewsAboutMe.length} hakkımda · ${reviewsByMe.length} yazdığım`} value={`${reviewsAboutMe.length + reviewsByMe.length}`} />
                  <MenuRow icon="account-star-outline" label="Uzman Ortaklar" detail="Deneyimli ortak bul · favori ortakların" value="→" href={"/ortaklar" as Href} />
                  <MenuRow icon="bullhorn-variant-outline" label="Ortak Aranıyor" detail="İlansız ortak talebi aç veya açık taleplere başvur" value="→" href={"/ortak-araniyor" as Href} />
                  <MenuRow icon="account-heart-outline" label="Davet Ettiklerim" detail="Arkadaşını davet et, ağını büyüt" value="→" href={"/davet" as Href} />
                  <MenuRow icon="account-cancel-outline" label="Engellenenler" detail="Engellediğin kullanıcılar sana mesaj gönderemez" value={`${blockedUserIds.length}`} href="/engellenenler" />
                </View>
              </View>
            </View>

          </View>

          {/* Sidebar */}
          <View style={{ gap: 16, width: 300 }}>
            {/* Profil gücü — masaüstü/mobil ORTAK bileşen (tek kaynak). Eskiden masaüstünde
                ayrı, eksik (3 doğrulama) ve "Tamamla"yı yanlış /profile-edit'e yollayan bespoke
                kart vardı; ProfileStrength 6 adımlı + doğrulamayı doğru /trust'a yönlendirir. */}
            <ProfileStrength user={currentUser} hasListing={myListings.length > 0} hasPartnership={myPartnerships.length > 0} />

            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 18 }}>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy("Güven puanların", language)}</Text>
              <DeskTrustBar label={translateCopy("Satıcı güveni", language)} value={trust.seller.score} />
              <DeskTrustBar label={translateCopy("Ortak güveni", language)} value={trust.partner.score} />
              <DeskTrustBar label={translateCopy("Yanıt oranı", language)} value={currentUser.responseRate} />
            </View>

            {/* Ortak başarı rozeti/seviyesi — motivasyon (onaylı satışlardan). */}
            <PartnerTier sales={partnerSales} />

            <View style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 16, borderWidth: 1, gap: 8, padding: 18 }}>
              <MaterialCommunityIcons name="store" size={24} color={colors.primaryDark} />
              <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{translateCopy("Mağazanı paylaş", language)}</Text>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy("Tüm ilanlarının bulunduğu mağaza sayfanı tek bağlantıyla müşterilerinle paylaş.", language)}</Text>
              {/* Gerçek PAYLAŞ aksiyonu (eskiden yalnız "Mağazama git" navigasyonu vardı). */}
              <Pressable onPress={() => void shareMyStore()} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, justifyContent: "center", marginTop: 4, opacity: pressed ? 0.85 : 1, paddingVertical: 10 })}>
                <MaterialCommunityIcons name="share-variant" size={16} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Bağlantıyı paylaş", language)}</Text>
              </Pressable>
              <Link href={{ pathname: "/store/[id]", params: { id: currentUser.id } }} asChild>
                <Pressable style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 7, justifyContent: "center", opacity: pressed ? 0.85 : 1, paddingVertical: 10 })}>
                  <MaterialCommunityIcons name="storefront-outline" size={16} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{translateCopy("Mağazama git", language)}</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
        </View>

        <WebFooter />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 12, padding: 12, paddingBottom: Platform.OS === "web" ? 28 : 96 }} refreshControl={Platform.OS === "web" ? undefined : <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}>
      <WebContainer max={1280} padding={0} style={{ gap: 12 }}>
      {/* Marka hero (mobil) — masaüstü welcome-banner paritesi: yuvarlak avatar + isim
          + puan/güven/satış çipleri. Eskiden düz kare-avatar kartıydı. */}
      <View style={{ backgroundColor: colors.primaryDark, borderRadius: 18, gap: 13, overflow: "hidden", padding: 16 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
          <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 999, height: 60, justifyContent: "center", overflow: "hidden", width: 60 }}>
            {isImageAvatar(currentUser.avatar) ? (
              <Image source={{ uri: currentUser.avatar }} accessibilityLabel={currentUser.name} contentFit="cover" style={{ height: 60, width: 60 }} />
            ) : (
              <Text adjustsFontSizeToFit numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "900", paddingHorizontal: 4 }}>{currentUser.avatar}</Text>
            )}
          </View>
          <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
            <Text selectable numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "900" }}>{currentUser.name}</Text>
            <Text selectable numberOfLines={1} style={{ color: "rgba(255,255,255,0.82)", fontSize: 12.5, fontWeight: "600" }}>{currentUser.phone || t("profilePhoneMissing")}</Text>
          </View>
          <Link href="/profile-edit" asChild>
            <Pressable accessibilityRole="button" accessibilityLabel={t("editProfile")} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 999, height: 40, justifyContent: "center", width: 40 }}>
              <MaterialCommunityIcons name="account-edit-outline" size={20} color="#FFFFFF" />
            </Pressable>
          </Link>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 5 }}>
            <MaterialCommunityIcons name="star" size={13} color={colors.gold} />
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>{currentUser.rating} {translateCopy("puan", language)}</Text>
          </View>
          <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 5 }}>
            <MaterialCommunityIcons name="shield-check" size={13} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>%{trust.overall} {translateCopy("güven", language)}</Text>
          </View>
          <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 10, paddingVertical: 5 }}>
            <MaterialCommunityIcons name="cart-check" size={13} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>{compactNumber(currentUser.successfulSales)} {translateCopy("satış", language)}</Text>
          </View>
        </View>
      </View>

      <Card>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <StatusPill label={isLiveAccount ? t("liveAccount") : t("preview")} tone={isLiveAccount ? "success" : "warning"} />
          {currentUser.verifiedPhone ? <StatusPill label={t("phoneVerified")} tone="success" /> : <StatusPill label={t("phonePending")} tone="warning" />}
          {currentUser.verifiedIdentity ? <StatusPill label={t("identityVerified")} tone="success" /> : <StatusPill label={t("identityPending")} tone="warning" />}
          {currentUser.verifiedInstagram ? <StatusPill label={t("instagramVerified")} tone="success" /> : <StatusPill label={t("instagramPending")} tone="warning" />}
        </View>
        {currentUser.bio ? (
          <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
            {currentUser.bio}
          </Text>
        ) : null}

        <ProfileStrength user={currentUser} hasListing={myListings.length > 0} hasPartnership={myPartnerships.length > 0} />

        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={{ flex: 1 }}>
            <PrimaryButton href="/profile-edit" icon="account-edit-outline" tone="soft">{t("editProfile")}</PrimaryButton>
          </View>
          <View style={{ flex: 1 }}>
            {isLiveAccount ? <PrimaryButton tone="secondary" onPress={() => void signOut()}>{t("signOut")}</PrimaryButton> : <PrimaryButton href="/auth">{t("signInRegister")}</PrimaryButton>}
          </View>
        </View>
      </Card>

      <Card>
        <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{t("accountSupport")}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Shortcut href={{ pathname: "/store/[id]", params: { id: currentUser.id } }} icon="store-search-outline" label={translateCopy("Mağazam", language)} />
          <Shortcut href="/auth" icon="account-switch-outline" label={t("switchAccounts")} />
          {/* Girişli (canlı) hesapta "Giriş Yap / Kayıt Ol" gösterme — gereksiz/kafa karıştırıcı. */}
          {!isLiveAccount ? <Shortcut href="/auth" icon="login" label={t("signInRegister")} /> : null}
          <Shortcut href="/legal" icon="face-agent" label={t("customerService")} />
          <Shortcut href="/favorites" icon="bookmark-outline" label={t("savedItems")} />
        </View>
      </Card>

      {/* Mağazanı paylaş — masaüstü sidebar paritesi + GERÇEK paylaş aksiyonu (büyüme). */}
      <View style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 12, borderWidth: 1, gap: 8, padding: 16 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <MaterialCommunityIcons name="store" size={22} color={colors.primaryDark} />
          <Text style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "900" }}>{translateCopy("Mağazanı paylaş", language)}</Text>
        </View>
        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy("Tüm ilanlarının bulunduğu mağaza sayfanı tek bağlantıyla müşterilerinle paylaş.", language)}</Text>
        <Pressable onPress={() => void shareMyStore()} accessibilityRole="button" accessibilityLabel={translateCopy("Bağlantıyı paylaş", language)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, justifyContent: "center", opacity: pressed ? 0.85 : 1, paddingVertical: 12 })}>
          <MaterialCommunityIcons name="share-variant" size={16} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Bağlantıyı paylaş", language)}</Text>
        </Pressable>
      </View>

      {/* Güven puanların — masaüstüyle aynı KOMPAKT kart (eskiden 2 ayrı büyük
          "Satıcı/Ortak güveni" kartıydı + Genel güven metriği → güven 4 yerde tekrar
          ediyordu). Tek kartta 3 bar; genel güven zaten hero'da. */}
      <Card>
        <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy("Güven puanların", language)}</Text>
        <DeskTrustBar label={translateCopy("Satıcı güveni", language)} value={trust.seller.score} />
        <DeskTrustBar label={translateCopy("Ortak güveni", language)} value={trust.partner.score} />
        <DeskTrustBar label={translateCopy("Yanıt oranı", language)} value={currentUser.responseRate} />
      </Card>

      {/* Ortak başarı rozeti/seviyesi — motivasyon (onaylı satışlardan). */}
      <PartnerTier sales={partnerSales} />

      {/* Finansal/satış özeti (4 metrik). Puan hero'da, Favori Hesap özetinde → tekrar kaldırıldı. */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Metric label={t("successfulSales")} value={compactNumber(currentUser.successfulSales)} />
        <Metric label={t("totalEarnings")} value={money(totalCommission)} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Metric label={t("pending")} value={money(pendingCommission)} />
        <Metric label={t("paid")} value={money(paidCommission)} />
      </View>

      <Card>
        <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{t("attentionToday")}</Text>
        {(() => {
          // Yalnız aksiyon gerektirenler (>0); hepsi 0 ise sıfır-duvarı yerine tek temiz satır.
          const todo: Array<{ href: Href; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; n: number }> = [
            { href: "/(tabs)/seller", icon: "account-clock-outline", label: t("sellerApplications"), n: pendingSellerApplications.length },
            { href: "/(tabs)/partner", icon: "handshake-outline", label: t("pendingPartnership"), n: pendingPartnerships.length },
            { href: "/(tabs)/messages", icon: "message-badge-outline", label: t("unreadMessage"), n: unreadMessages.length },
            { href: "/trust", icon: "shield-alert-outline", label: t("openTrustRecord"), n: openReports.length }
          ];
          const actionable = todo.filter((x) => x.n > 0);
          if (actionable.length === 0) {
            return (
              <View style={{ alignItems: "center", flexDirection: "row", gap: 10, paddingVertical: 4 }}>
                <MaterialCommunityIcons name="check-circle-outline" size={20} color={colors.success} />
                <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "700" }}>{translateCopy("Bekleyen işin yok — her şey güncel.", language)}</Text>
              </View>
            );
          }
          return actionable.map((x) => <ActionRow key={x.label} href={x.href} icon={x.icon} label={x.label} tone="warning" value={`${x.n}`} />);
        })()}
      </Card>

      <Card>
        <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{t("accountSummary")}</Text>
        <MenuRow icon="storefront-outline" label={t("myListings")} detail={`${activeListings.length} ${t("activeShort")} · ${pausedListings.length} ${t("pausedShort")}`} value={`${myListings.length}`} href="/(tabs)/seller" />
        <MenuRow icon="handshake-outline" label={t("myPartnerships")} detail={`${activePartnerships.length} ${t("activeShort")} · ${pendingPartnerships.length} ${t("pending")}`} value={`${myPartnerships.length}`} href="/(tabs)/partner" />
        <MenuRow icon="cash-multiple" label={translateCopy("Kazançlarım", language)} detail={`${money(paidCommission)} ${translateCopy("ödendi", language)} · ${money(pendingCommission)} ${translateCopy("bekliyor", language)}`} value="→" href={"/earnings" as Href} />
        <MenuRow icon="star-outline" label={t("reviews")} detail={`${reviewsAboutMe.length} ${t("profileReviews")} · ${reviewsByMe.length} ${t("writtenByYou")}`} value={`${reviewsAboutMe.length + reviewsByMe.length}`} />
        <MenuRow icon="tag-outline" label={translateCopy("Tekliflerim", language)} detail={liveOffers.length ? `${liveOffers.length} ${translateCopy("süren teklif", language)}` : translateCopy("Verdiğin teklifler", language)} value={`${myOffers.length}`} href="/offers" />
        <MenuRow icon="heart-outline" label={translateCopy("Favoriler", language)} detail={translateCopy("Kaydedilen ilanlar", language)} value={`${myFavorites.length}`} href="/favorites" />
        <MenuRow icon="storefront-check-outline" label={translateCopy("Takip Ettiklerin", language)} detail={translateCopy("Takip ettiğin satıcıların yeni ilanları", language)} value={`${followedSellerIds.length}`} href="/following" />
        <MenuRow icon="account-star-outline" label={translateCopy("Uzman Ortaklar", language)} detail={translateCopy("Deneyimli ortak bul · favori ortakların", language)} value="→" href={"/ortaklar" as Href} />
        <MenuRow icon="bullhorn-variant-outline" label={translateCopy("Ortak Aranıyor", language)} detail={translateCopy("İlansız ortak talebi aç veya açık taleplere başvur", language)} value="→" href={"/ortak-araniyor" as Href} />
        <MenuRow icon="account-heart-outline" label={translateCopy("Davet Ettiklerim", language)} detail={translateCopy("Arkadaşını davet et, ağını büyüt", language)} value="→" href={"/davet" as Href} />
        <MenuRow icon="bell-outline" label={t("notification")} detail={t("unreadNotification")} value={`${unreadNotifications.length}`} href="/notifications" />
        <MenuRow icon="chat-outline" label={t("conversation")} detail={t("buyerSellerPartnerMessages")} value={`${myConversations.length}`} href="/(tabs)/messages" />
        <MenuRow icon="account-cancel-outline" label={translateCopy("Engellenenler", language)} detail={translateCopy("Engellediğin kullanıcılar sana mesaj gönderemez", language)} value={`${blockedUserIds.length}`} href="/engellenenler" />
        <MenuRow icon="database-check-outline" label={t("dataInfrastructure")} detail={isLiveAccount ? t("liveProfileActive") : t("previewData")} value={isLiveAccount ? t("live") : t("preview")} href="/profile-edit" />
      </Card>

      </WebContainer>
    </ScrollView>
  );
}


function DeskTrustBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "700" }}>{label}</Text>
        <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "900" }}>%{value}</Text>
      </View>
      <ProgressBar value={value} />
    </View>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 8, overflow: "hidden" }}>
      <View style={{ backgroundColor: value >= 75 ? colors.success : value >= 45 ? colors.warning : colors.accent, borderRadius: 999, height: "100%", width: `${value}%` }} />
    </View>
  );
}

function ActionRow({ href, icon, label, tone, value }: { href: Href; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; tone: "warning" | "neutral"; value: string }) {
  const { language } = useLanguage();
  const active = tone === "warning";
  return (
    <PressLink href={href} accessibilityLabel={translateCopy(label, language)} pressedOpacity={0.75} style={{ alignItems: "center", backgroundColor: active ? colors.warningSoft : colors.surfaceAlt, borderColor: active ? colors.warningSoft : colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 48, padding: 10 }}>
        <MaterialCommunityIcons name={icon} size={20} color={active ? colors.warning : colors.primary} />
        <Text numberOfLines={1} selectable style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "900" }}>{translateCopy(label, language)}</Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} selectable style={{ color: active ? colors.warning : colors.muted, fontSize: 15, fontVariant: ["tabular-nums"], fontWeight: "900", minWidth: 28, textAlign: "right" }}>{value}</Text>
    </PressLink>
  );
}

function MenuRow({ detail, icon, label, value, href }: { detail: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string; href?: Href }) {
  const { language } = useLanguage();
  const inner = (
    <View style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 10, paddingTop: 11 }}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{translateCopy(label, language)}</Text>
        <Text numberOfLines={1} selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{translateCopy(detail, language)}</Text>
      </View>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{value}</Text>
      {href ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.subtle} /> : null}
    </View>
  );
  if (!href) return inner;
  return <Link href={href} asChild><Pressable>{inner}</Pressable></Link>;
}

function Shortcut({ href, icon, label }: { href: Href; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }) {
  const { language } = useLanguage();
  return (
    <PressLink href={href} accessibilityLabel={translateCopy(label, language)} pressedOpacity={0.75} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexBasis: "31%", flexGrow: 1, gap: 6, justifyContent: "center", minHeight: 72, padding: 8 }}>
        <MaterialCommunityIcons name={icon} size={21} color={colors.primary} />
        <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "900" }}>{translateCopy(label, language)}</Text>
    </PressLink>
  );
}



export default function ProfileScreen() {
  const { language } = useLanguage();
  const auth = useStore();
  const mounted = useMounted();
  if (!mounted) return <ScreenSkeleton />; // hidrasyon-gate (#418)
  if (!auth.isAuthenticated) return <AuthRequired title={translateCopy("Hesabım için giriş yapın", language)} />;
  return <ProfileScreenInner />;
}
