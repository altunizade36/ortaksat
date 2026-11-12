import { cardPriceFontSize } from "@/lib/card-layout";
import { Text, View } from "react-native";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { colors } from "@/components/colors";
import { commissionAmount, moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import type { Listing } from "@/lib/types";

// Komisyon etiketi marka mavisiyle gösterilir (kullanıcı isteği: yeşil yok).
const COMMISSION_INK = colors.primary;
const COMMISSION_LINE = "#C9DBF7";

/** Listing terms are a potential commission, never a paid balance or guarantee. */
export function ListingCommission({ listing, compact = false, availableWidth }: { listing: Listing; compact?: boolean; availableWidth?: number }) {
  const { language } = useLanguage();
  const tr = (copy: string) => translateCopy(copy, language);
  const partnerable = listing.partnershipMode !== "none";
  const closed = listing.status !== "active" || (listing.attributes?._formKey !== "arayan" && listing.stockCount <= 0);
  const caption = listing.partnershipMode === "open" ? "Anında katılım" : listing.partnershipMode === "invite" ? "Davetle katılım" : "Satıcı onayıyla";
  return <View testID="listing-commission" dataSet={{ available: String(partnerable && !closed) }} style={{ backgroundColor: partnerable && !closed ? colors.primarySoft : colors.surfaceAlt, borderWidth: 1, borderColor: partnerable && !closed ? COMMISSION_LINE : colors.line, borderRadius: compact ? 7 : 10, paddingHorizontal: compact ? 5 : 6, paddingVertical: compact ? 2 : 6, height: compact ? 24 : 68, justifyContent: "center", gap: 2, flexDirection: compact ? "row" : "column", alignItems: compact ? "center" : undefined }}>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, flex: compact ? 1 : undefined, minWidth: 0 }}><Icon name={partnerable && !closed ? "handshake-outline" : "tag-outline"} size={12} color={partnerable && !closed ? COMMISSION_INK : colors.muted}/><Text numberOfLines={1} style={{ color: partnerable && !closed ? COMMISSION_INK : colors.muted, fontSize: compact ? 10 : 10.5, lineHeight: 12, fontWeight: "800", flex: 1 }}>{tr(closed ? "Kapalı" : !partnerable ? "Satış ilanı" : listing.demo ? "Örnek komisyon" : "Komisyon")}</Text></View>
    {partnerable && !closed ? <>
      <Text testID="listing-commission-amount" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72} style={{ color: COMMISSION_INK, fontSize: availableWidth ? cardPriceFontSize(moneyIn(commissionAmount(listing), listing.currency), compact ? Math.max(54, availableWidth * 0.48) : availableWidth - 14, compact ? 13 : 18) : compact ? 13 : 18, lineHeight: compact ? 16 : 23, fontWeight: "800", fontVariant: ["tabular-nums"], maxWidth: compact ? "52%" : undefined }}>{moneyIn(commissionAmount(listing), listing.currency)}</Text>
      {!compact ? <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10.5, lineHeight: 14 }}>{tr(caption)}{listing.commissionType === "rate" ? ` · %${listing.commissionValue}` : ""}{(listing.bonusAmount ?? 0) > 0 && (listing.bonusQuota ?? 0) > 0 ? ` · +${moneyIn(listing.bonusAmount!, listing.currency)} ${tr("bonus")}` : ""}</Text> : null}

    </> : <Text numberOfLines={1} style={{ color: colors.muted, fontSize: compact ? 10 : 12, lineHeight: compact ? 14 : 17, flex: compact ? 1 : undefined }}>{tr(closed ? "Detayda gör" : "Ortak satışa kapalı")}</Text>}
  </View>;
}
