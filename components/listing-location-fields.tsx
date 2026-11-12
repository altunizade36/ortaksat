import { Text, View, Pressable } from "react-native";
import { useEffect, useRef, useState } from "react";
import { currentListingLocation, currentLocationError, deviceLocationAvailable } from "@/lib/current-location";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { colors } from "@/components/colors";
import { LocationSelector, type LocationValue } from "@/components/location-selector";
import { formatLocation, type AddressVisibility } from "@/lib/locations";
import { translateCopy, useLanguage } from "@/lib/i18n";

const visibilityOptions: Array<{ value: AddressVisibility; label: string }> = [
  { value: "city_only", label: "Yalnız il" },
  { value: "district_only", label: "İl ve ilçe" },
  { value: "neighborhood", label: "Mahalleye kadar" }
];

export function ListingLocationFields({ value, onChange, visibility, onVisibility }: {
  value: LocationValue; onChange: (next: LocationValue) => void;
  visibility: AddressVisibility; onVisibility: (next: AddressVisibility) => void;
}) {
  const { language } = useLanguage();
  const copy = (s: string) => translateCopy(s, language);
  const preview = formatLocation(value, visibility);
  // Legacy private-address preference still displays province/district; no exact address is exposed.
  const selected = visibility === "full_address_private" ? "district_only" : visibility;
  const [locating, setLocating] = useState(false), [locationNotice, setLocationNotice] = useState("");
  const lookup = useRef(0), busy = useRef(false), alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; lookup.current++; }; }, []);
  useEffect(() => { lookup.current++; }, [value.provinceId, value.districtId, value.neighborhoodId, value.neighborhood, value.addressLine]);
  async function locate() {
    if (busy.current) return;
    busy.current = true; setLocating(true); setLocationNotice("");
    const generation = ++lookup.current;
    try {
      const found = await currentListingLocation();
      if (alive.current && generation === lookup.current) {
        onChange(found);
        setLocationNotice(found.districtId ? "İl ve ilçe seçildi. Gerekirse mahalleyi listeden tamamla." : "İl seçildi. İlçeyi listeden tamamla.");
      }
    } catch (e) { if (alive.current && generation === lookup.current) setLocationNotice(currentLocationError(e)); }
    finally { busy.current = false; if (alive.current) setLocating(false); }
  }
  return <View style={{ gap: 14 }}>
    <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{copy("Ürünün bulunduğu konumu seç. İl ve ilçe zorunlu, mahalle / köy isteğe bağlıdır.")}</Text>
    {deviceLocationAvailable && <Pressable accessibilityRole="button" accessibilityLabel={copy("Konumumu kullan")} accessibilityState={{ disabled: locating, busy: locating }} disabled={locating} onPress={() => void locate()} style={{ alignSelf: "flex-start", minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", gap: 7, opacity: locating ? 0.6 : 1 }}><Icon name="crosshairs-gps" size={19} color={colors.primaryDark} /><Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "600" }}>{copy(locating ? "Konum alınıyor…" : "Konumumu kullan")}</Text></Pressable>}
    {!!locationNotice && <Text accessibilityLiveRegion="polite" style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>{copy(locationNotice)}</Text>}
    <LocationSelector value={value} onChange={next => { lookup.current++; setLocationNotice(""); onChange(next); }} required neighborhoodRequired={false} showNeighborhood mode="listing" />
    <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{copy("İlanda görünecek konum")}</Text>
    <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
      {visibilityOptions.map(option => <Pressable key={option.value} accessibilityRole="radio" accessibilityLabel={copy(option.label)} accessibilityState={{ checked: selected === option.value }} onPress={() => onVisibility(option.value)} style={{ minHeight: 44, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: selected === option.value ? colors.primary : colors.line, backgroundColor: selected === option.value ? colors.primarySoft : colors.surface, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: selected === option.value ? colors.primaryDark : colors.muted, fontSize: 12, fontWeight: "600" }}>{copy(option.label)}</Text>
      </Pressable>)}
    </View>
    <View testID="listing-location-preview" style={{ padding: 12, borderRadius: 10, backgroundColor: colors.surfaceAlt, gap: 8 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Icon name="map-marker-outline" size={21} color={colors.primaryDark} /><Text style={{ flex: 1, color: colors.ink, fontSize: 13, lineHeight: 19 }}>{preview || copy("İl ve ilçe seçildiğinde konum burada görünür.")}</Text></View>
      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>{copy("Cadde, sokak, bina ve daire numaranı herkese açık ilan açıklamasına ekleme. Teslimat ayrıntılarını gerektiğinde alıcıyla paylaş.")}</Text>
    </View>
  </View>;
}
