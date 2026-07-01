import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { getCategoryShortLabel, inferListingSubcategory } from "@/lib/categories";
import { commissionAmount, money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { compactNumber, REFERENCE_NOW } from "@/lib/locale";
import { displayText } from "@/lib/text";
import type { Listing, User } from "@/lib/types";

type StatusTone = "success" | "accent" | "info" | "dark";

export function ListingCard({ listing, owner, width }: { listing: Listing; owner?: User; width?: number }) {
  const { language, t } = useLanguage();
  const commission = commissionAmount(listing);
  const imageSize = Math.max(148, width ?? 156);
  const conversionScore = listing.leadCount + listing.partnerCount * 2 + Math.round(listing.favoriteCount / 8);
  const isHighConversion = conversionScore >= 18;
  const isNew = isNewListing(listing.createdAt);
  const statusLabel = listing.partnershipMode === "open" ? t("instantPartner") : isHighConversion ? t("highConversion") : isNew ? t("newListing") : `${compactNumber(listing.partnerCount)} ${t("partners")}`;
  const statusTone: StatusTone = listing.partnershipMode === "open" ? "success" : isHighConversion ? "accent" : isNew ? "info" : "dark";
  const subcategory = inferListingSubcategory(listing);
  const isVerified = Boolean(owner?.verifiedPhone || owner?.verifiedIdentity);

  return (
    <View style={{ width }}>
      <Link href={`/listing/${listing.id}`} asChild>
        <Pressable style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1, width: "100%" })}>
          <View
            dataSet={{ card: "listing" }}
            style={{
              backgroundColor: colors.surface,
              borderColor: colors.line,
              borderRadius: 16,
              borderWidth: 1,
              overflow: "hidden",
              shadowColor: "#101828",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.07,
              shadowRadius: 18
            }}
          >
            <View style={{ backgroundColor: colors.line, height: imageSize, overflow: "hidden", width: "100%" }}>
              <SafeRemoteImage uri={listing.image} style={{ height: imageSize, width: "100%" }} contentFit="cover" transition={160} />
              <View style={{ position: "absolute", top: 10, left: 10, right: 10, flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
                <StatusBadge label={statusLabel} tone={statusTone} />
                <View style={{ backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 4 }}>
                  <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 10, fontWeight: "900" }}>
                    {translateCopy(getCategoryShortLabel(listing.category), language)}
                  </Text>
                </View>
              </View>
            </View>

            <View style={{ gap: 8, padding: 12 }}>
              <Text numberOfLines={1} selectable style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "800", letterSpacing: 0.3, textTransform: "uppercase" }}>
                {translateCopy(subcategory, language)}
              </Text>
              <Text numberOfLines={2} selectable style={{ color: colors.ink, fontSize: 15, fontWeight: "800", lineHeight: 19, minHeight: 38 }}>
                {displayText(listing.title)}
              </Text>

              <View style={{ alignItems: "center", flexDirection: "row", gap: 6, justifyContent: "space-between" }}>
                <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} selectable style={{ color: colors.ink, flexShrink: 1, fontSize: 18, fontVariant: ["tabular-nums"], fontWeight: "900", minWidth: 0 }}>
                  {money(listing.price)}
                </Text>
                <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, flexShrink: 1, maxWidth: "58%", minWidth: 0, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text adjustsFontSizeToFit minimumFontScale={0.7} numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "900" }}>
                    {t("earning")} {money(commission)}
                  </Text>
                </View>
              </View>

              <View style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
                <MaterialCommunityIcons name="star" size={13} color={colors.gold} />
                <Text numberOfLines={1} selectable style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>
                  {owner?.rating ?? 0}
                </Text>
                {isVerified ? <MaterialCommunityIcons name="check-decagram" size={13} color={colors.primary} /> : null}
                <Text numberOfLines={1} selectable style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "700" }}>
                  {" · "}{displayText(listing.location)}
                </Text>
                <MaterialCommunityIcons name="account-group-outline" size={13} color={colors.subtle} />
                <Text numberOfLines={1} selectable style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }}>
                  {compactNumber(listing.partnerCount)} ortak
                </Text>
              </View>

              <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, justifyContent: "center", marginTop: 2, minHeight: 38, paddingHorizontal: 8 }}>
                <MaterialCommunityIcons name="handshake-outline" size={16} color="#FFFFFF" />
                <Text adjustsFontSizeToFit minimumFontScale={0.8} numberOfLines={1} style={{ color: "#FFFFFF", flexShrink: 1, fontSize: 13, fontWeight: "900" }}>
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
  const age = REFERENCE_NOW - date.getTime();
  return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000;
}

function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  const backgroundColor =
    tone === "success" ? "rgba(0,134,111,0.96)" : tone === "accent" ? "rgba(229,75,75,0.96)" : tone === "info" ? "rgba(49,87,213,0.96)" : "rgba(17,24,39,0.78)";

  return (
    <View style={{ alignSelf: "flex-start", backgroundColor, borderRadius: 999, maxWidth: "72%", paddingHorizontal: 10, paddingVertical: 5 }}>
      <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "900" }}>
        {label}
      </Text>
    </View>
  );
}
