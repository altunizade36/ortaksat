import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { colors } from "@/components/colors";
import { commissionAmount, moneyIn } from "@/lib/format";
import { categoryConversion } from "@/lib/conversion";
import { translateCopy, useLanguage } from "@/lib/i18n";
import type { Listing } from "@/lib/types";

/** Listing terms only: not an executed agreement, balance or payment promise. */
export function ListingTermsSummary({ listing }: { listing: Listing }) {
  const [expanded, setExpanded] = useState(false);
  const { language } = useLanguage();
  const tr = (value: string) => translateCopy(value, language);
  if (listing.partnershipMode === "none") return null;
  const mode = listing.partnershipMode === "open" ? "Anında katılım" : listing.partnershipMode === "invite" ? "Yalnızca davetle" : "Satıcı onayıyla";
  const event = categoryConversion(listing.category);
  const rules = listing.partnerRules ?? [];
  const region = String(listing.attributes?._partnerRegion ?? "").trim();
  const maxPartners = Number(listing.attributes?._maxPartners ?? 0);
  return <View testID="listing-terms-summary" style={{ borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.primarySoft, padding: 12, gap: 9 }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Icon name="handshake-outline" size={18} color={colors.primaryDark} /><Text style={{ flex: 1, color: colors.ink, fontSize: 13, fontWeight: "700" }}>{tr("Ortaklık koşulları")}</Text><Text style={{ color: colors.muted, fontSize: 11 }}>{tr(mode)}</Text></View>
    <View style={{ gap: 2 }}><Text style={{ color: colors.muted, fontSize: 11 }}>{tr("Komisyon")}{listing.commissionType === "rate" ? ` · %${listing.commissionValue}` : ""}</Text><Text testID="listing-terms-amount" style={{ color: colors.primaryDark, fontSize: 21, fontWeight: "700", lineHeight: 27 }}>{moneyIn(commissionAmount(listing), listing.currency)}</Text></View>
    <View style={{ flexDirection: "row", gap: 12 }}>
      <View style={{ flex: 1, gap: 2 }}><Text style={{ color: colors.muted, fontSize: 11 }}>{tr("Yönlendirme süresi")}</Text><Text style={{ color: colors.ink, fontSize: 12, fontWeight: "600" }}>{listing.attributionWindowDays} {tr("gün")}</Text></View>
      <View style={{ flex: 1, gap: 2 }}><Text style={{ color: colors.muted, fontSize: 11 }}>{tr("Komisyon vadesi")}</Text><Text style={{ color: colors.ink, fontSize: 12, fontWeight: "600" }}>{listing.commissionDueDays} {tr("gün")}</Text></View>
    </View>
    <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16 }}>{tr("Hak ediş koşulu")}: {tr(event.event)}. {tr("Ödeme taraflar arasındadır.")}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={tr("Ortaklık koşullarını göster")} accessibilityState={{ expanded }} onPress={() => setExpanded((v) => !v)} style={{ minHeight: 36, flexDirection: "row", alignItems: "center", gap: 6, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 6 }}><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "600", flex: 1 }}>{tr(expanded ? "Ayrıntıları gizle" : "Koşulların ayrıntıları")}{rules.length ? ` (${rules.length})` : ""}</Text><Icon name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.primaryDark} /></Pressable>
    {expanded ? <View testID="listing-terms-details" style={{ gap: 7 }}>
      <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{tr(event.hint)}</Text>
      {rules.map((rule, index) => <Text key={`${index}-${rule}`} style={{ color: colors.ink, fontSize: 12, lineHeight: 18 }}>• {tr(rule)}</Text>)}
      {region ? <Text style={{ color: colors.muted, fontSize: 12 }}>{tr("Bölge")}: {region}</Text> : null}
      {Number.isFinite(maxPartners) && maxPartners > 0 ? <Text style={{ color: colors.muted, fontSize: 12 }}>{tr("Maksimum ortak")}: {maxPartners}</Text> : null}
    </View> : null}
  </View>;
}
