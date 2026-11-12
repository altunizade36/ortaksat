import { LISTING_GRID_PHOTO_RATIO, LISTING_GRID_BODY_HEIGHT, cardPriceFontSize } from "@/lib/card-layout";
import { ListingCommission } from "@/components/listing-commission";
import { listingPhotos } from "@/lib/mobile-listing";
import { displayListingTitle } from "@/lib/listing-title";
import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import { memo } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { ImageWatermark } from "@/components/image-watermark";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { useCompare } from "@/lib/compare";
import { useFavoriteFlag } from "@/lib/favorites-cache";
import { moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { displayText } from "@/lib/text";
import type { Listing, User } from "@/lib/types";

type StatusTone = "success" | "accent" | "info" | "dark" | "gold";

function ListingCardBase({ listing, owner, width, priceNote, refCode, onCollection, collectionOn, eager }: { listing: Listing; owner?: User; width?: number; priceNote?: { text: string; down: boolean }; refCode?: string; onCollection?: () => void; collectionOn?: boolean; eager?: boolean }) {
  // Ortak vitrininden gelen kartlar ref TAŞIR → ilan detay URL'den atfı yakalar (URL-garantili
  // first-touch; localStorage silinse/engellense bile ortak kredisi kaybolmaz). c=shop kanal ölçümü.
  const cardHref = refCode ? `/listing/${listing.id}?ref=${encodeURIComponent(refCode)}&c=shop` : `/listing/${listing.id}`;
  // NORMAL İLAN (ortak satışa kapalı): komisyon rozeti + ortaklık pill + "Ortak ol" CTA GÖSTERİLMEZ;
  // alıcı normal ilan sitesi gibi görür (İncele). Detay sayfasıyla tutarlı.
    const { language } = useLanguage();
  const isNew = isNewListing(listing.createdAt);
  const featured = Boolean(listing.featured);
  // "0 ortak" ASLA gösterilmez (çirkin + kötü pazarlama: "kimse ilgilenmemiş" izlenimi).
  // Ortak varsa sayısını, yoksa "Yeni" göster.
  // Rozet metni KISA olmalı (dar kartta kesilmesin): "Yeni ilan"→"Yeni".
  // ACİL SATIŞ: attributes._urgentUntil (ISO) GELECEKTEyse → en yüksek öncelikli kırmızı "🔥 Acil"
  // rozeti (DB kolonu değil; JSONB attributes zaten public feed'de → ekstra grant/migrasyon yok).
  const urgentUntil = listing.attributes?._urgentUntil ? String(listing.attributes._urgentUntil) : "";
  const urgent = urgentUntil ? Date.parse(urgentUntil) > Date.now() : false;
  // TALEP İLANI (alıcı arıyor, buluş komisyonu): publish attributes._formKey="arayan" yazar.
  // EN ÜST öncelikli "🔎 ARANIYOR" rozeti — bu ilan tipi diğer her şeyin önünde okunmalı.
  const isDemand = listing.attributes?._formKey === "arayan";
  const statusLabel = listing.status !== "active" ? translateCopy("İlan kapalı", language) : isDemand ? translateCopy("Aranıyor", language) : urgent ? translateCopy("Acil", language) : featured ? translateCopy("Öne çıkan", language) : isNew ? translateCopy("Yeni ilan", language) : "";
  const statusTone: StatusTone = listing.status !== "active" ? "dark" : isDemand ? "info" : urgent ? "accent" : featured ? "gold" : "info";
  const { has, toggle } = useCompare();
  const inCompare = has(listing.id);
  const { isFav, toggle: toggleFav } = useFavoriteFlag(listing.id);
  const imageUri = listing.imageUrl ?? listing.image;
  const imageAlt = listing.imageAlt ?? `${displayListingTitle(listing.title)} ${translateCopy("ilan görseli", language)}`;
  const compact = width != null && width < 190;
  const photoCount = listingPhotos(listing).length;
  const priceLabel = moneyIn(listing.price, listing.currency);
  const priceSize = cardPriceFontSize(priceLabel, (width ?? 196) - (compact ? 20 : 24), compact ? 18 : 20);
  return <View testID="listing-card" dataSet={{ vcard: "1", card: "listing" }} style={{ width, flexGrow: 0, flexShrink: 0, backgroundColor: colors.surface, borderWidth: 1, borderColor: "#E3E9EE", borderRadius: 12, overflow: "hidden", boxShadow: "0px 2px 10px #0F172A08" }}>
    <Link href={cardHref as never} asChild><Pressable accessibilityRole="link" accessibilityLabel={displayListingTitle(listing.title)} style={{ width: "100%" }}>
      <View testID="listing-card-photo" style={{ aspectRatio: LISTING_GRID_PHOTO_RATIO, width: "100%", backgroundColor: colors.surfaceAlt, overflow: "hidden" }}>
        <SafeRemoteImage uri={imageUri} fallbackUri={listing.fallbackCategoryImage} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={eager ? 0 : 160} priority={eager ? "high" : "low"} alt={imageAlt} accessibilityLabel={imageAlt}/>
        <ImageWatermark size={10} opacity={0.09}/>
        <View style={{ position: "absolute", top: 8, left: 8, right: compact ? 42 : 78, alignItems: "flex-start" }}>
          {listing.demo ? <StatusBadge label={translateCopy("ÖRNEK", language)} tone="gold"/> : statusLabel ? <StatusBadge label={statusLabel} tone={statusTone}/> : null}
        </View>
        {photoCount > 1 ? <View style={{ position: "absolute", bottom: 8, left: 8, backgroundColor: "#172033B8", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 3, flexDirection: "row", alignItems: "center", gap: 4 }}><MaterialCommunityIcons name="image-multiple-outline" size={12} color="white"/><Text style={{ color: "white", fontSize: 10.5, fontWeight: "600" }}>{photoCount}</Text></View> : null}
      </View>
      <View testID="listing-card-body" style={{ height: LISTING_GRID_BODY_HEIGHT, gap: 1, padding: 4 }}>
        <Text numberOfLines={2} style={{ color: colors.ink, fontSize: 12, fontWeight: "700", lineHeight: 14, height: 28 }}>{displayListingTitle(listing.title)}</Text>
        <Text testID="listing-card-price" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={{ color: colors.primaryDark, fontSize: priceSize, lineHeight: 20, height: 20, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{priceLabel}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 3, height: 12 }}><MaterialCommunityIcons name="map-marker-outline" size={11} color={colors.muted}/><Text numberOfLines={1} style={{ color: colors.muted, fontSize: 10, lineHeight: 12, flex: 1 }}>{displayText(listing.location) || translateCopy("Konum belirtilmemiş", language)}</Text></View>
        <ListingCommission listing={listing} compact availableWidth={width ? width - 18 : undefined}/>
      </View>
    </Pressable></Link>
    {!listing.demo ? <>
      <Pressable accessibilityRole="button" accessibilityState={{ selected: isFav }} accessibilityLabel={isFav ? translateCopy("Favorilerden çıkar", language) : translateCopy("Favorilere ekle", language)} onPress={toggleFav} style={{ position: "absolute", right: 6, top: 6, width: 30, height: 30, borderRadius: 15, backgroundColor: "#FFFFFFE6", alignItems: "center", justifyContent: "center" }} hitSlop={7}><MaterialCommunityIcons name={isFav ? "heart" : "heart-outline"} size={17} color={isFav ? colors.accent : colors.ink}/></Pressable>
      {!compact ? <Pressable testID="listing-card-footer" accessibilityRole="button" accessibilityState={{ selected: inCompare }} accessibilityLabel={inCompare ? translateCopy("Karşılaştırmadan çıkar", language) : translateCopy("Karşılaştır", language)} onPress={() => toggle(listing.id)} style={{ position: "absolute", right: 42, top: 6, width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center", backgroundColor: inCompare ? colors.primarySoft : "#FFFFFFE6" }} hitSlop={{ top: 7, bottom: 7, left: 7, right: 3 }}><MaterialCommunityIcons name="compare-horizontal" size={15} color={colors.primaryDark}/></Pressable> : null}
      {!compact && onCollection ? <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Koleksiyona ekle", language)} onPress={onCollection} style={{ position: "absolute", right: 78, top: 6, width: 30, height: 30, borderRadius: 15, backgroundColor: collectionOn ? colors.primarySoft : "#FFFFFFE6", alignItems: "center", justifyContent: "center" }}><MaterialCommunityIcons name={collectionOn ? "folder" : "folder-outline"} size={15} color={colors.primaryDark}/></Pressable> : null}
    </> : null}
  </View>;
}

// memo: ust bilesen render olsa da ayni listing/owner/width ile yeniden render
// olmaz. Binlerce kartli listelerde CPU'yu ciddi dusurur.
export const ListingCard = memo(ListingCardBase);

function isNewListing(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const age = Date.now() - date.getTime();
  return age >= 0 && age <= 7 * 24 * 60 * 60 * 1000;
}

function StatusBadge({ label, tone }: { label: string; tone: StatusTone }) {
  // Marka mavisi (yeni/aranıyor), AA kırmızı (acil), sarı zemin + koyu metin (öne çıkan/örnek).
  // Eski turkuaz "success" tonu ve beyaz-üstü-sarı (kontrast ~2.9:1) kaldırıldı.
  const backgroundColor =
    tone === "accent" ? colors.accent : tone === "gold" ? colors.badgeGold : tone === "dark" ? "rgba(9,39,94,0.86)" : colors.primary;
  const color = tone === "gold" ? colors.badgeInk : "#FFFFFF";

  return (
    <View style={{ alignSelf: "flex-start", backgroundColor, borderRadius: 999, maxWidth: "100%", paddingHorizontal: 9, paddingVertical: 4 }}>
      <Text numberOfLines={1} style={{ color, fontSize: 11, fontWeight: "800", lineHeight: 14 }}>
        {label}
      </Text>
    </View>
  );
}
