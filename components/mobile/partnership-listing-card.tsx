import { LISTING_GRID_PHOTO_RATIO, LISTING_GRID_BODY_HEIGHT, cardPriceFontSize } from "@/lib/card-layout";
import { ListingCommission } from "@/components/listing-commission";
import { displayListingTitle } from "@/lib/listing-title";
import { Pressable, Text, View } from "react-native";
import { Link } from "expo-router";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { useFavoriteFlag } from "@/lib/favorites-cache";
import { moneyIn } from "@/lib/format";
import type { Listing } from "@/lib/types";
import { mobile } from "./ui";

export function PartnershipListingCard({ listing: l, width, desktop = false }: { listing: Listing; width: number; desktop?: boolean }) {
  const {isFav:favorite,toggle} = useFavoriteFlag(l.id);
  const photos = new Set([l.imageUrl || l.image, ...(l.adAssets || [])].filter(Boolean)).size;
  return <View testID="partnership-listing-card" style={{ width, borderWidth: 1, borderColor: mobile.line, backgroundColor: "white", borderRadius: 12, overflow: "hidden", marginBottom: 4, boxShadow: "0px 2px 10px #0F172A08" }}>
    <Link href={`/listing/${l.id}` as never} asChild><Pressable accessibilityRole="link" accessibilityLabel={`Ortaklık ilanı: ${displayListingTitle(l.title)}`} style={{ width: "100%" }}>
      <View style={{ width: "100%", aspectRatio: LISTING_GRID_PHOTO_RATIO }}><SafeRemoteImage uri={l.imageUrl || l.image} accessibilityLabel={displayListingTitle(l.title)} contentFit="cover" style={{ width: "100%", height: "100%", backgroundColor: "#EAF0F4" }}/>
        <Text style={{ position: "absolute", top: 7, left: 6, color: "#0645C9", backgroundColor: "#E5F0FF", fontSize: 10, fontWeight: "700", borderRadius: 12, paddingVertical: 4, paddingHorizontal: 6 }}>Ortak satış</Text>
        {photos > 0 && <Text style={{ position: "absolute", right: 6, bottom: 6, color: "white", backgroundColor: "#00000099", borderRadius: 5, padding: 3, fontSize: 10 }}>▧ 1/{photos}</Text>}
      </View>
      <View style={{ padding: 4, gap: 2, height: LISTING_GRID_BODY_HEIGHT }}><Text numberOfLines={2} style={{ color: mobile.ink, fontSize: 12.5, lineHeight: 15, height: 30, fontWeight: "700" }}>{displayListingTitle(l.title)}</Text>
        <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75} style={{ fontSize: cardPriceFontSize(moneyIn(l.price,l.currency),width-8,18), lineHeight:22, height:22, color: mobile.teal, fontWeight: "800" }}>{moneyIn(l.price, l.currency)}</Text>
        <Text numberOfLines={1} style={{ height:14,lineHeight:14,fontSize:10,color:mobile.muted }}>⌖ {l.location}</Text>
        <ListingCommission listing={l} compact availableWidth={width-18}/>
      </View>
    </Pressable></Link>
    <Pressable accessibilityRole="button" accessibilityLabel={favorite ? `${displayListingTitle(l.title)} favorilerden kaldır` : `${displayListingTitle(l.title)} favorilere ekle`} accessibilityState={{ selected: favorite }} onPress={toggle} hitSlop={5} style={{ position: "absolute", top: 5, right: 4, minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 22, padding: 4, backgroundColor: "#FFFFFFF2" }}><Icon name={favorite ? "heart" : "heart-outline"} size={21} color={favorite ? "#FF5677" : mobile.ink}/></Pressable>
  </View>;
}
