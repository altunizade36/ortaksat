import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { colors } from "@/components/colors";
import { moneyIn } from "@/lib/format";
import { displayListingTitle } from "@/lib/listing-title";
import { translateCopy, useLanguage } from "@/lib/i18n";
import type { Listing } from "@/lib/types";

export function ConversationListingStrip({ listing }: { listing?: Listing }) {
  const { language } = useLanguage();
  if (!listing) return <View style={{ padding: 10, backgroundColor: colors.surfaceAlt }}><Text style={{ color: colors.muted, fontSize: 12 }}>{translateCopy("İlan bilgileri şu anda görüntülenemiyor. Mesaj geçmişin korunur.", language)}</Text></View>;
  // İlan artık yayında değilse (satıldı / durduruldu / arşivlendi) bunu sohbetin İÇİNDE söyle:
  // eskiden şerit aktif ilanla aynı görünüyor, kullanıcı satılmış ürün için pazarlığa devam ediyor,
  // "Teklif ver" düğmesinin neden soluk olduğunu da anlamıyordu.
  const stateLabel = listing.status === "active" ? (listing.attributes?._formKey !== "arayan" && listing.stockCount <= 0 ? "Stokta yok" : "") : listing.status === "sold" ? "Satıldı" : "Yayında değil";
  return <Link href={{ pathname: "/listing/[id]", params: { id: listing.id } }} asChild><Pressable testID="conversation-listing-strip" accessibilityLabel={translateCopy("İlanı gör", language)} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderWidth: 1, marginHorizontal: 10, marginVertical: 8, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, flexDirection: "row", alignItems: "center", gap: 9 }}>
    <SafeRemoteImage uri={listing.image} contentFit="cover" accessibilityLabel={displayListingTitle(listing.title)} style={{ width: 38, height: 38, borderRadius: 7, backgroundColor: colors.line, opacity: stateLabel ? 0.6 : 1 }} />
    <View style={{ flex: 1, minWidth: 0, gap: 2 }}><Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "600" }}>{displayListingTitle(listing.title)}</Text><View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><Text numberOfLines={1} style={{ color: colors.primaryDark, flexShrink: 1, fontSize: 13, fontWeight: "700" }}>{moneyIn(listing.price, listing.currency)}</Text>{stateLabel ? <View testID="conversation-listing-state" style={{ backgroundColor: colors.accentSoft, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 1 }}><Text numberOfLines={1} style={{ color: colors.accent, fontSize: 10.5, fontWeight: "700" }}>{translateCopy(stateLabel, language)}</Text></View> : null}</View></View>
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, minHeight: 36 }}><Icon name="open-in-new" size={15} color={colors.primaryDark} /><Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "600" }}>{translateCopy("İlanı gör", language)}</Text></View>
  </Pressable></Link>;
}
