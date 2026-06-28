import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link, type Href } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { Card, Metric, PrimaryButton, StatusPill } from "@/components/ui";
import { money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { compactNumber } from "@/lib/locale";
import { calculateUserTrustScores, type RoleTrustScore } from "@/lib/trust-score";
import { useStore } from "@/lib/use-store";

function isImageAvatar(value: string) {
  return value.startsWith("http") || value.startsWith("file");
}

export default function ProfileScreen() {
  const { backendMode, conversations, currentUser, favorites, leads, listings, messages, notifications, partnerships, reports, reviews, sales, signOut } = useStore();
  const { language, setLanguage, t, useDeviceLanguage } = useLanguage();
  const isLiveAccount = backendMode === "supabase" && currentUser.id.includes("-");
  const myListings = listings.filter((listing) => listing.ownerId === currentUser.id);
  const myPartnerships = partnerships.filter((partnership) => partnership.partnerId === currentUser.id);
  const myFavorites = favorites.filter((favorite) => favorite.userId === currentUser.id);
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

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ gap: 12, padding: 12, paddingBottom: 96 }}>
      <Card>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
          <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, height: 62, justifyContent: "center", overflow: "hidden", width: 62 }}>
            {isImageAvatar(currentUser.avatar) ? (
              <Image source={{ uri: currentUser.avatar }} contentFit="cover" style={{ height: 62, width: 62 }} />
            ) : (
              <Text adjustsFontSizeToFit numberOfLines={1} selectable style={{ color: "#FFFFFF", fontSize: 20, fontWeight: "900", paddingHorizontal: 4 }}>
                {currentUser.avatar}
              </Text>
            )}
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 22, fontWeight: "900" }}>
              {currentUser.name}
            </Text>
            <Text selectable numberOfLines={1} style={{ color: colors.muted, fontSize: 13 }}>
              {currentUser.phone || t("profilePhoneMissing")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
              <StatusPill label={isLiveAccount ? t("liveAccount") : t("preview")} tone={isLiveAccount ? "success" : "warning"} />
              {currentUser.verifiedPhone ? <StatusPill label={t("phoneVerified")} tone="success" /> : <StatusPill label={t("phonePending")} tone="warning" />}
              {currentUser.verifiedIdentity ? <StatusPill label={t("identityVerified")} tone="success" /> : <StatusPill label={t("identityPending")} tone="warning" />}
              {currentUser.verifiedInstagram ? <StatusPill label={t("instagramVerified")} tone="success" /> : <StatusPill label={t("instagramPending")} tone="warning" />}
            </View>
          </View>
        </View>
        {currentUser.bio ? (
          <Text selectable style={{ color: colors.muted, fontSize: 13, lineHeight: 19 }}>
            {currentUser.bio}
          </Text>
        ) : null}

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Metric label={t("generalTrust")} value={`%${trust.overall}`} />
          <Metric label={t("responseRate")} value={`%${currentUser.responseRate}`} />
        </View>

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
          <Shortcut href="/auth" icon="login" label={t("signInRegister")} />
          <Shortcut href="/legal" icon="face-agent" label={t("customerService")} />
          <Shortcut href="/favorites" icon="bookmark-outline" label={t("savedItems")} />
        </View>
        <Pressable
          onPress={() => void signOut()}
          style={({ pressed }) => ({
            alignItems: "center",
            backgroundColor: isLiveAccount ? colors.accentSoft : colors.surfaceAlt,
            borderColor: isLiveAccount ? colors.accentSoft : colors.line,
            borderRadius: 8,
            borderWidth: 1,
            flexDirection: "row",
            gap: 10,
            minHeight: 48,
            opacity: pressed ? 0.75 : 1,
            padding: 10
          })}
        >
          <MaterialCommunityIcons name="logout" size={20} color={isLiveAccount ? colors.accent : colors.muted} />
          <Text selectable style={{ color: isLiveAccount ? colors.accent : colors.muted, flex: 1, fontSize: 14, fontWeight: "900" }}>
            {t("signOut")}
          </Text>
          <Text selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
            {isLiveAccount ? t("active") : t("preview")}
          </Text>
        </Pressable>
      </Card>

      <Card>
        <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{t("languageSettings")}</Text>
        <Text selectable style={{ color: colors.muted, fontSize: 13, fontWeight: "700", lineHeight: 19 }}>
          {t("languageHelp")}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <LanguageButton active={language === "tr"} icon="translate" label={t("turkish")} onPress={() => void setLanguage("tr")} />
          <LanguageButton active={language === "en"} icon="alphabetical-variant" label={t("english")} onPress={() => void setLanguage("en")} />
          <LanguageButton icon="cellphone-cog" label={t("deviceLanguage")} onPress={() => void useDeviceLanguage()} />
        </View>
      </Card>

      <TrustRoleCard icon="storefront-outline" title={t("sellerTrust")} score={trust.seller} />
      <TrustRoleCard icon="handshake-outline" title={t("partnerTrust")} score={trust.partner} />

      <View style={{ flexDirection: "row", gap: 8 }}>
        <Metric label={t("rating")} value={`${currentUser.rating}`} />
        <Metric label={t("successfulSales")} value={compactNumber(currentUser.successfulSales)} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Metric label={t("totalEarnings")} value={money(totalCommission)} />
        <Metric label={t("pending")} value={money(pendingCommission)} />
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Metric label={t("paid")} value={money(paidCommission)} />
        <Metric label={t("favorite")} value={`${myFavorites.length}`} />
      </View>

      <Card>
        <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{t("attentionToday")}</Text>
        <ActionRow href="/(tabs)/seller" icon="account-clock-outline" label={t("sellerApplications")} tone={pendingSellerApplications.length ? "warning" : "neutral"} value={`${pendingSellerApplications.length}`} />
        <ActionRow href="/(tabs)/partner" icon="handshake-outline" label={t("pendingPartnership")} tone={pendingPartnerships.length ? "warning" : "neutral"} value={`${pendingPartnerships.length}`} />
        <ActionRow href="/(tabs)/messages" icon="message-badge-outline" label={t("unreadMessage")} tone={unreadMessages.length ? "warning" : "neutral"} value={`${unreadMessages.length}`} />
        <ActionRow href="/trust" icon="shield-alert-outline" label={t("openTrustRecord")} tone={openReports.length ? "warning" : "neutral"} value={`${openReports.length}`} />
      </Card>

      <Card>
        <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{t("accountSummary")}</Text>
        <MenuRow icon="storefront-outline" label={t("myListings")} detail={`${activeListings.length} ${t("activeShort")} · ${pausedListings.length} ${t("pausedShort")}`} value={`${myListings.length}`} />
        <MenuRow icon="handshake-outline" label={t("myPartnerships")} detail={`${activePartnerships.length} ${t("activeShort")} · ${pendingPartnerships.length} ${t("pending")}`} value={`${myPartnerships.length}`} />
        <MenuRow icon="star-outline" label={t("reviews")} detail={`${reviewsAboutMe.length} ${t("profileReviews")} · ${reviewsByMe.length} ${t("writtenByYou")}`} value={`${reviewsAboutMe.length + reviewsByMe.length}`} />
        <MenuRow icon="bell-outline" label={t("notification")} detail={t("unreadNotification")} value={`${unreadNotifications.length}`} />
        <MenuRow icon="chat-outline" label={t("conversation")} detail={t("buyerSellerPartnerMessages")} value={`${myConversations.length}`} />
        <MenuRow icon="database-check-outline" label={t("dataInfrastructure")} detail={isLiveAccount ? t("liveProfileActive") : t("previewData")} value={isLiveAccount ? t("live") : t("preview")} />
      </Card>

      <Card>
        <Text selectable style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{t("shortcuts")}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
          <Shortcut href={{ pathname: "/store/[id]", params: { id: currentUser.id } }} icon="store-search-outline" label={translateCopy("Mağazam", language)} />
          <Shortcut href="/(tabs)/seller" icon="storefront-outline" label={t("seller")} />
          <Shortcut href="/(tabs)/partner" icon="handshake-outline" label={t("partner")} />
          <Shortcut href="/favorites" icon="heart-outline" label={t("favorite")} />
          <Shortcut href="/trust" icon="shield-check-outline" label={t("trust")} />
          <Shortcut href="/legal" icon="file-document-outline" label={t("legal")} />
        </View>
      </Card>
    </ScrollView>
  );
}

function LanguageButton({ active, icon, label, onPress }: { active?: boolean; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; onPress: () => void }) {
  const { language } = useLanguage();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: active ? colors.primary : colors.surfaceAlt,
        borderColor: active ? colors.primary : colors.line,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: "row",
        gap: 7,
        minHeight: 42,
        opacity: pressed ? 0.72 : 1,
        paddingHorizontal: 12
      })}
    >
      <MaterialCommunityIcons name={icon} size={17} color={active ? "#FFFFFF" : colors.primary} />
      <Text selectable adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={{ color: active ? "#FFFFFF" : colors.ink, flexShrink: 1, fontSize: 13, fontWeight: "900" }}>
        {translateCopy(label, language)}
      </Text>
    </Pressable>
  );
}

function TrustRoleCard({ icon, score, title }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; score: RoleTrustScore; title: string }) {
  const { language } = useLanguage();
  return (
    <Card>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
        <MaterialCommunityIcons name={icon} size={22} color={score.score >= 70 ? colors.success : score.score >= 50 ? colors.warning : colors.accent} />
        <View style={{ flex: 1 }}>
          <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{translateCopy(title, language)}</Text>
          <Text selectable numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>{translateCopy(score.label, language)}</Text>
        </View>
        <Text selectable style={{ color: colors.primaryDark, fontSize: 18, fontVariant: ["tabular-nums"], fontWeight: "900" }}>%{score.score}</Text>
      </View>
      <ProgressBar value={score.score} />
      {score.breakdown.filter((item) => item.value !== 0).slice(0, 5).map((item) => (
        <View key={`${title}-${item.label}`} style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
          <MaterialCommunityIcons name={item.tone === "negative" ? "minus-circle" : "check-circle"} size={15} color={item.tone === "negative" ? colors.accent : colors.success} />
          <Text selectable numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 12, fontWeight: "800" }}>{translateCopy(item.label, language)}</Text>
          <Text selectable style={{ color: item.tone === "negative" ? colors.accent : colors.success, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
            {item.value > 0 ? `+${item.value}` : item.value}
          </Text>
        </View>
      ))}
    </Card>
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
    <Link href={href} asChild>
      <Pressable style={({ pressed }) => ({ alignItems: "center", backgroundColor: active ? colors.warningSoft : colors.surfaceAlt, borderColor: active ? colors.warningSoft : colors.line, borderRadius: 8, borderWidth: 1, flexDirection: "row", gap: 10, minHeight: 48, opacity: pressed ? 0.75 : 1, padding: 10 })}>
        <MaterialCommunityIcons name={icon} size={20} color={active ? colors.warning : colors.primary} />
        <Text numberOfLines={1} selectable style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "900" }}>{translateCopy(label, language)}</Text>
        <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} selectable style={{ color: active ? colors.warning : colors.muted, fontSize: 15, fontVariant: ["tabular-nums"], fontWeight: "900", minWidth: 28, textAlign: "right" }}>{value}</Text>
      </Pressable>
    </Link>
  );
}

function MenuRow({ detail, icon, label, value }: { detail: string; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; value: string }) {
  const { language } = useLanguage();
  return (
    <View style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 10, paddingTop: 11 }}>
      <MaterialCommunityIcons name={icon} size={20} color={colors.primary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text selectable numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{translateCopy(label, language)}</Text>
        <Text numberOfLines={1} selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{translateCopy(detail, language)}</Text>
      </View>
      <Text selectable style={{ color: colors.muted, fontSize: 13, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{value}</Text>
    </View>
  );
}

function Shortcut({ href, icon, label }: { href: Href; icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }) {
  const { language } = useLanguage();
  return (
    <Link href={href} asChild>
      <Pressable style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 8, borderWidth: 1, flexBasis: "31%", flexGrow: 1, gap: 6, justifyContent: "center", minHeight: 72, opacity: pressed ? 0.75 : 1, padding: 8 })}>
        <MaterialCommunityIcons name={icon} size={21} color={colors.primary} />
        <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "900" }}>{translateCopy(label, language)}</Text>
      </Pressable>
    </Link>
  );
}


