import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { getCategoryShortLabel, inferListingSubcategory } from "@/lib/categories";
import { commissionAmount, money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { compactNumber } from "@/lib/locale";
import { displayText } from "@/lib/text";
import type { Listing, User } from "@/lib/types";

export function ListingCard({ listing, owner, width }: { listing: Listing; owner?: User; width?: number }) {
  const { language, t } = useLanguage();
  const commission = commissionAmount(listing);
  const imageSize = Math.max(148, width ?? 156);
  const conversionScore = listing.leadCount + listing.partnerCount * 2 + Math.round(listing.favoriteCount / 8);
  const isHighConversion = conversionScore >= 18;
  const isNew = isNewListing(listing.createdAt);
  const commissionLabel = listing.commissionType === "rate" ? `%${listing.commissionValue}` : t("fixed");
  const statusLabel = listing.partnershipMode === "open" ? t("instantPartner") : isHighConversion ? t("highConversion") : isNew ? t("newListing") : `${compactNumber(listing.partnerCount)} ${t("partners")}`;
  const statusTone = listing.partnershipMode === "open" ? "success" : isHighConversion ? "accent" : isNew ? "info" : "dark";
  const subcategory = inferListingSubcategory(listing);

  return (
    <View style={{ width }}>
      <Link href={`/listing/${listing.id}`} asChild>
        <Pressable
          style={({ pressed }) => ({
            opacity: pressed ? 0.82 : 1,
            width: "100%"
          })}
        >
          <View
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.line,
              borderRadius: 8,
              borderWidth: 1,
              overflow: "hidden",
              shadowColor: "#101828",
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: 0.1,
              shadowRadius: 16
            }}
          >
            <View style={{ backgroundColor: colors.line, height: imageSize, overflow: "hidden", width: "100%" }}>
              <SafeRemoteImage uri={listing.image} style={{ height: imageSize, width: "100%" }} contentFit="cover" transition={160} />
              <View
                style={{
                  alignItems: "center",
                  flexDirection: "row",
                  position: "absolute",
                  gap: 5,
                  left: 6,
                  right: 6,
                  top: 6
                }}
              >
                <ImageBadge label={translateCopy(getCategoryShortLabel(listing.category), language)} icon="tag-outline" tone="dark" />
                <ImageBadge label={`${t("earning")} ${money(commission)}`} icon="cash-plus" tone="success" right />
              </View>
              <View style={{ bottom: 6, left: 6, position: "absolute", right: 6 }}>
                <ImageBadge label={statusLabel} tone={statusTone} full />
              </View>
            </View>

              <View style={{ gap: 7, minHeight: 146, padding: 10 }}>
              <Text numberOfLines={1} selectable style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "900" }}>
                {translateCopy(subcategory, language)}
              </Text>
              <Text numberOfLines={2} selectable style={{ color: colors.ink, fontSize: 14, fontWeight: "900", lineHeight: 17, minHeight: 34 }}>
                {displayText(listing.title)}
              </Text>

              <View style={{ gap: 2 }}>
                <Text adjustsFontSizeToFit minimumFontScale={0.82} numberOfLines={1} selectable style={{ color: colors.ink, fontSize: 17, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
                  {money(listing.price)}
                </Text>
                <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} selectable style={{ color: colors.primaryDark, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
                  {t("earning")}: {money(commission)}
                </Text>
              </View>

              <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                <MaterialCommunityIcons name="star" size={12} color={colors.gold} />
                <Text numberOfLines={1} selectable style={{ color: colors.muted, flex: 1, fontSize: 11, fontWeight: "800" }}>
                  {owner?.rating ?? 0} · {displayText(listing.location)}
                </Text>
              </View>

              <View style={{ flexDirection: "row", gap: 4 }}>
                <MiniBadge icon="package-variant-closed" label={`${compactNumber(listing.stockCount)} ${t("stock")}`} tone="neutral" />
                <MiniBadge icon="percent" label={commissionLabel} tone="primary" />
              </View>
              <Text numberOfLines={1} selectable style={{ color: colors.muted, fontSize: 10, fontWeight: "800" }}>
                {listing.partnershipMode === "open" ? t("instantPartner") : listing.partnershipMode === "approval" ? t("approvedPartner") : t("inviteOnly")}
              </Text>
              <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, flexDirection: "row", gap: 5, justifyContent: "center", minHeight: 32, paddingHorizontal: 8 }}>
                <MaterialCommunityIcons name="handshake-outline" size={15} color="#FFFFFF" />
                <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} style={{ color: "#FFFFFF", flexShrink: 1, fontSize: 12, fontWeight: "900" }}>
                  {translateCopy(listing.partnershipMode === "open" ? "Hemen ortak ol" : "Ortaklık iste", language)}
                </Text>
              </View>
            </View>
          </View>
        </Pressable>
      </Link>
    </View>
  );
}

function isNewListing(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const age = Date.now() - date.getTime();
  return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000;
}

function ImageBadge({
  full,
  icon,
  label,
  right,
  tone = "dark",
}: {
  full?: boolean;
  icon?: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  right?: boolean;
  tone?: "dark" | "success" | "accent" | "info";
}) {
  const backgroundColor =
    tone === "success" ? "rgba(0,135,111,0.94)" : tone === "accent" ? "rgba(239,68,68,0.94)" : tone === "info" ? "rgba(37,99,235,0.94)" : "rgba(17,24,39,0.72)";

  return (
    <View
      style={{
        alignItems: "center",
        alignSelf: right ? "flex-end" : "flex-start",
        backgroundColor,
        borderRadius: 999,
        flex: full ? undefined : right ? 0 : 1,
        flexDirection: "row",
        gap: 3,
        justifyContent: "center",
        maxWidth: full ? "100%" : right ? 112 : 92,
        minHeight: full ? 25 : 23,
        paddingHorizontal: right ? 7 : 6,
        paddingVertical: 3,
        width: full ? "100%" : undefined
      }}
    >
      {icon ? <MaterialCommunityIcons name={icon} size={10} color="#FFFFFF" /> : null}
      <Text adjustsFontSizeToFit minimumFontScale={0.72} numberOfLines={1} style={{ color: "#FFFFFF", flexShrink: 1, fontSize: full ? 11 : 10, fontWeight: "900", textAlign: "center" }}>
        {label}
      </Text>
    </View>
  );
}

function MiniBadge({ icon, label, tone }: { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; tone: "primary" | "info" | "neutral" }) {
  const color = tone === "primary" ? colors.primaryDark : tone === "info" ? colors.info : colors.muted;
  const backgroundColor = tone === "primary" ? colors.primarySoft : tone === "info" ? colors.infoSoft : colors.surfaceAlt;

  return (
    <View style={{ alignItems: "center", backgroundColor, borderRadius: 999, flex: 1, flexDirection: "row", gap: 4, justifyContent: "center", minHeight: 24, minWidth: 0, paddingHorizontal: 6, paddingVertical: 4 }}>
      <MaterialCommunityIcons name={icon} size={11} color={color} />
      <Text adjustsFontSizeToFit minimumFontScale={0.78} numberOfLines={1} selectable style={{ color, flexShrink: 1, fontSize: 10, fontWeight: "900" }}>
        {label}
      </Text>
    </View>
  );
}
