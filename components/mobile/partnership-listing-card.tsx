import { LISTING_GRID_PHOTO_RATIO, LISTING_GRID_BODY_HEIGHT, cardPriceFontSize } from "@/lib/card-layout";
import { ListingCommission } from "@/components/listing-commission";
import { displayListingTitle } from "@/lib/listing-title";
import { Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { useFavoriteFlag } from "@/lib/favorites-cache";
import { moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import type { Listing } from "@/lib/types";
import { mobile } from "./ui";

export function PartnershipListingCard({ listing: l, width, desktop = false }: { listing: Listing; width: number; desktop?: boolean }) {
  const {isFav:favorite,toggle} = useFavoriteFlag(l.id);
  const { language } = useLanguage();
  const photos = new Set([l.imageUrl || l.image, ...(l.adAssets || [])].filter(Boolean)).size;
  return <View testID="partnership-listing-card" style={{ width, borderWidth: 1, borderColor: mobile.line, backgroundColor: "white", borderRadius: 12, overflow: "hidden", marginBottom: 4, boxShadow: "0px 2px 10px #0F172A08" }}>
    <Link href={`/listing/${l.id}` as never} asChild><Pressable accessibilityRole="link" accessibilityLabel={`Ortaklık ilanı: ${displayListingTitle(l.title)}`} style={{ width: "100%" }}>
      <View style={{ width: "100%", aspectRatio: LISTING_GRID_PHOTO_RATIO }}><SafeRemoteImage uri={l.imageUrl || l.image} accessibilityLabel={displayListingTitle(l.title)} contentFit="cover" style={{ width: "100%", height: "100%", backgroundColor: "#EAF0F4" }}/>
        <View style={{ position: "absolute", top: 8, left: 8, right: 40, alignItems: "flex-start" }}><View style={{ backgroundColor: "#0645C9", borderRadius: 999, maxWidth: "100%", paddingVertical: 4, paddingHorizontal: width < 170 ? 7 : 9 }}><Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: width < 170 ? 10 : 11, lineHeight: 14, fontWeight: "800" }}>{translateCopy("Ortaklığa açık", language)}</Text></View></View>
        {photos > 1 && <View style={{ position: "absolute", left: 8, bottom: 8, backgroundColor: "#172033B8", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 }}><Icon name="image-multiple-outline" size={12} color="white"/><Text style={{ color: "white", fontSize: 10.5, fontWeight: "600" }}>{photos}</Text></View>}
      </View>
      <View style={{ padding: 4, gap: 2, height: LISTING_GRID_BODY_HEIGHT }}><Text numberOfLines={2} style={{ color: mobile.ink, fontSize: 12.5, lineHeight: 15, height: 30, fontWeight: "700" }}>{displayListingTitle(l.title)}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ fontSize: cardPriceFontSize(moneyIn(l.price,l.currency),width-8,18), lineHeight:22, height:22, color: mobile.teal, fontWeight: "800" }}>{moneyIn(l.price, l.currency)}</Text>
        <Text numberOfLines={1} style={{ height:14,lineHeight:14,fontSize:10,color:mobile.muted }}>⌖ {l.location}</Text>
        <ListingCommission listing={l} compact availableWidth={width-18}/>
      </View>
    </Pressable></Link>
    <Pressable accessibilityRole="button" accessibilityLabel={favorite ? `${displayListingTitle(l.title)} favorilerden kaldır` : `${displayListingTitle(l.title)} favorilere ekle`} accessibilityState={{ selected: favorite }} onPress={toggle} hitSlop={5} style={{ position: "absolute", top: 0, right: 0, width: 44, height: 44, alignItems: "center", justifyContent: "center" }}><View style={{ width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: "#FFFFFFE6" }}><Icon name={favorite ? "heart" : "heart-outline"} size={17} color={favorite ? "#DC2626" : mobile.ink}/></View></Pressable>
  </View>;
}
