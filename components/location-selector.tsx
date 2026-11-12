import { MaterialCommunityIcons } from "@/components/icons";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { AnchoredDropdown, useAnchor } from "@/components/anchored-dropdown";
import { colors } from "@/components/colors";
import { OptionSheet } from "@/components/option-sheet";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { districtsOfProvince, locKey, provinces, searchDistricts, searchProvinces } from "@/lib/locations";
import { fetchNeighborhoods, type Neighborhood } from "@/lib/location-service";

export type LocationValue = {
  provinceId?: number;
  districtId?: number;
  neighborhood?: string;
  neighborhoodId?: number;
  addressLine?: string;
};

type Mode = "listing" | "filter" | "profile" | "store";

/**
 * Reusable, cascading TR location selector (İl → İlçe → Mahalle).
 * Used by the listing form, explore/category filters, profile & store address.
 * İl seçilmeden ilçe, ilçe seçilmeden mahalle açılmaz; üst seçim değişince
 * alt seçimler temizlenir. Açık adres opsiyoneldir ve listede gösterilmez.
 */
export function LocationSelector({
  value,
  onChange,
  required,
  neighborhoodRequired,
  showNeighborhood = true,
  showAddressLine = false,
  mode = "listing"
}: {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  required?: boolean;
  /** Mahalle için ayrı zorunluluk (varsayılan = required). Mahalle çoğu ilanda opsiyoneldir. */
  neighborhoodRequired?: boolean;
  showNeighborhood?: boolean;
  showAddressLine?: boolean;
  mode?: Mode;
}) {
  const nbRequired = neighborhoodRequired ?? required;
  const { language } = useLanguage();
  const provinceLabel = provinces.find((p) => p.id === value.provinceId)?.name;
  const validProvinceId = provinceLabel ? value.provinceId : undefined;
  const districtList = useMemo(() => districtsOfProvince(validProvinceId), [validProvinceId]);
  const districtLabel = districtList.find((d) => d.id === value.districtId)?.name;
  const validDistrictId = districtLabel ? value.districtId : undefined;
  const invalidSelection = value.provinceId != null && !provinceLabel || value.districtId != null && !districtLabel;

  return (
    <View style={{ gap: 12, zIndex: 5 }}>
      {invalidSelection ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12, lineHeight: 18 }}>{translateCopy("Kayıtlı konumdaki il veya ilçe artık geçerli değil. İl ve ilçeni yeniden seç.", language)}</Text> : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 180, zIndex: 30 }}>
          <ComboBox
            label={`${translateCopy("İl", language)}${required ? " *" : ""}`}
            placeholder={mode === "filter" ? translateCopy("Tüm iller", language) : translateCopy("İl seçin", language)}
            valueLabel={provinceLabel}
            search={(q) => searchProvinces(q).map((p) => ({ id: p.id, label: p.name }))}
            onSelect={(id) => { if (id !== value.provinceId || value.districtId != null && !districtLabel) onChange({ provinceId: id }); }}
            onClear={mode === "filter" ? () => onChange({}) : undefined}
          />
        </View>
        <View style={{ flex: 1, minWidth: 180, zIndex: 20 }}>
          <ComboBox
            label={`${translateCopy("İlçe", language)}${required ? " *" : ""}`}
            placeholder={validProvinceId ? (mode === "filter" ? translateCopy("Tüm ilçeler", language) : translateCopy("İlçe seçin", language)) : translateCopy("Önce il seçin", language)}
            valueLabel={districtLabel}
            disabled={!validProvinceId}
            search={(q) => searchDistricts(validProvinceId, q).map((d) => ({ id: d.id, label: d.name }))}
            onSelect={(id) => { if (id !== value.districtId) onChange({ ...value, districtId: id, neighborhood: undefined, neighborhoodId: undefined, addressLine: undefined }); }}
            onClear={mode === "filter" ? () => onChange({ ...value, districtId: undefined, neighborhood: undefined, neighborhoodId: undefined, addressLine: undefined }) : undefined}
          />
        </View>
        {showNeighborhood ? (
          <View style={{ flex: 1, minWidth: 180, zIndex: 10 }}>
            <NeighborhoodField key={`${validProvinceId ?? "none"}:${validDistrictId ?? "none"}`} districtId={validDistrictId} value={validDistrictId ? value.neighborhood : undefined} required={nbRequired} onChange={(name, id) => onChange({ ...value, neighborhood: name, neighborhoodId: id })} />
          </View>
        ) : null}
      </View>

      {showAddressLine ? (
        <View>
          <FieldLabel text={translateCopy("Açık adres (opsiyonel)", language)} />
          <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12 }}>
            <TextInput
              value={value.addressLine ?? ""}
              onChangeText={(t) => onChange({ ...value, addressLine: t })}
              placeholder={translateCopy("Cadde, sokak, no — yalnızca satış/talep onayından sonra paylaşılır", language)}
              placeholderTextColor={colors.subtle}
              multiline
              style={{ color: colors.ink, fontSize: 13.5, minHeight: 56, paddingVertical: 10, textAlignVertical: "top" }}
            />
          </View>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 6, marginTop: 5 }}>
            <MaterialCommunityIcons name="shield-lock-outline" size={14} color={colors.success} />
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>{translateCopy("Açık adres herkese gösterilmez. İlanda yalnızca il / ilçe / mahalle görünür.", language)}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function FieldLabel({ text }: { text: string }) {
  return <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "800", marginBottom: 6 }}>{text}</Text>;
}

/**
 * Mahalle alanı: Supabase'de mahalle verisi varsa aranabilir gerçek liste;
 * yoksa (veya "listede yok") serbest metin + öneri akışı. İlçe değişince sıfırlanır.
 */
function NeighborhoodField({ districtId, value, required, onChange }: { districtId?: number; value?: string; required?: boolean; onChange: (name: string, id?: number) => void }) {
  const { language } = useLanguage();
  const copy = (s: string) => translateCopy(s, language);
  const [list, setList] = useState<Neighborhood[]>([]);
  const [manual, setManual] = useState(false);
  const [loading, setLoading] = useState(!!districtId);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const label = `${copy("Mahalle / Köy")}${required ? " *" : ""}`;
  useEffect(() => {
    let active = true;
    if (!districtId) { setLoading(false); return; }
    setLoading(true); setFailed(false);
    fetchNeighborhoods(districtId, true).then(rows => { if (active) setList(rows); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [districtId, retry]);
  if (loading) return <View><FieldLabel text={label} /><Text accessibilityRole="progressbar" style={{ color: colors.muted, minHeight: 46, paddingVertical: 12 }}>{copy("Mahalleler yükleniyor…")}</Text></View>;
  return <View style={{ gap: 7 }}>
    {list.length > 0 && !manual ? <>
      <ComboBox label={label} placeholder={copy("Mahalle seçin")} valueLabel={value} search={query => list.filter(n => locKey(n.name).includes(locKey(query))).map(n => ({ id: n.id, label: n.name }))} onSelect={id => { const item = list.find(n => n.id === id); if (item) onChange(item.name, item.id); }} onClear={() => onChange("")} />
      <Pressable accessibilityRole="button" onPress={() => setManual(true)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "700" }}>{copy("Mahallem listede yok")}</Text></Pressable>
    </> : <>
      <FieldLabel text={label} />
      <TextInput accessibilityLabel={copy("Mahalle / Köy")} editable={!!districtId} value={value ?? ""} onChangeText={text => onChange(text)} maxLength={100} placeholder={districtId ? copy("Mahalle / köy adını yaz") : copy("Önce ilçe seçin")} placeholderTextColor={colors.subtle} style={{ color: colors.ink, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.line, borderRadius: 11, paddingHorizontal: 12, fontSize: 13.5, minHeight: 46, opacity: districtId ? 1 : 0.55 }} />
      {districtId && <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>{copy(failed ? "Mahalle listesi yüklenemedi. Tekrar deneyebilir veya mahalle adını yazabilirsin." : "Mahalleni listede bulamazsan adını kendin yazabilirsin.")}</Text>}
      {list.length > 0 && <Pressable accessibilityRole="button" onPress={() => setManual(false)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.primaryDark, fontSize: 12 }}>{copy("Listeden seç")}</Text></Pressable>}
    </>}
    {failed && <Pressable accessibilityRole="button" onPress={() => setRetry(n => n + 1)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "700" }}>{copy("Mahalleleri yeniden yükle")}</Text></Pressable>}
  </View>;
}

function ComboBox({
  label,
  placeholder,
  valueLabel,
  disabled,
  search,
  onSelect,
  onClear
}: {
  label: string;
  placeholder: string;
  valueLabel?: string;
  disabled?: boolean;
  search: (q: string) => Array<{ id: number; label: string }>;
  onSelect: (id: number) => void;
  onClear?: () => void;
}) {
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // KIRPMA KALDIRILDI: eskiden `.slice(0, 40)` vardı → 81 ilin yalnız 40'ı listeleniyor,
  // kalanı SADECE arama ile bulunabiliyordu ("iller eksik, bir kısmı görünüyor" şikayeti).
  // İl 81, ilçe en fazla 39 — tamamını göstermek sorun değil.
  const results = open ? search(query) : [];
  // ÇAPALI AÇILIR LİSTE: liste artık AKIŞTA değil, tetikleyicinin ekran konumuna
  // çapalanmış bir katmanda (Modal/portal) açılır. Böylece sayfayı AŞAĞI İTMEZ ve
  // `overflow:hidden` olan kart/panel içinde KIRPILMAZ ("il/ilçe görünmüyor" sorunu).
  // Eski çözüm sayfayı listeye kaydırmaktı — istenmeyen davranış buydu.
  const { ref: anchorRef, rect: anchorRect, measure } = useAnchor(open);
  // DAR EKRAN = alttan açılan tam sayfa (native VE telefon tarayıcısı). Eskiden koşul
  // `Platform.OS !== "web"` idi → telefonun TARAYICISINDAN girenler küçük çapalı popover
  // alıyordu; autoFocus klavyeyi açınca viewport değişip liste yeniden konumlanıyor,
  // kullanıcı aşağı inerken liste yukarı sıçrıyordu ("il/ilçe ararken kayma").
  const isWideWeb = useIsWideWeb();
  const useSheet = Platform.OS !== "web" || !isWideWeb;
  const openList = () => { if (disabled) return; measure(); setQuery(""); setOpen(true); };

  return (
    <View style={{ gap: 4 }}>
      <FieldLabel text={label} />
      <View ref={anchorRef} collapsable={false} onLayout={measure}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${label}: ${valueLabel || placeholder}`}
          accessibilityState={{ disabled: !!disabled, expanded: open }}
          disabled={disabled}
          onPress={() => (open ? setOpen(false) : openList())}
          style={{ alignItems: "center", backgroundColor: disabled ? colors.background : colors.surfaceAlt, borderColor: open ? colors.primary : colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 46, opacity: disabled ? 0.55 : 1, paddingHorizontal: 12 }}
        >
          <MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={valueLabel ? colors.primary : colors.muted} />
          <Text numberOfLines={1} style={{ color: valueLabel ? colors.ink : colors.subtle, flex: 1, fontSize: 13.5, fontWeight: valueLabel ? "700" : "500" }}>
            {valueLabel ?? placeholder}
          </Text>
          {valueLabel && onClear ? (
            <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Temizle", language)} onPress={event => { event.stopPropagation(); onClear(); setOpen(false); }} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={16} color={colors.muted} /></Pressable>
          ) : (
            <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
          )}
        </Pressable>
      </View>

      {/* DAR EKRAN (native + telefon tarayıcısı): alttan açılan seçim sayfası + arama
          (81 il / ilçeler tam görünür, klavye açılınca liste sıçramaz). */}
      {useSheet ? (open ? (
        <OptionSheet
          visible={open}
          title={label}
          options={search("").map((r) => r.label)}
          value={valueLabel}
          onSelect={(name) => {
            if (!name) { onClear?.(); return; }
            const hit = search("").find((r) => r.label === name);
            if (hit) onSelect(hit.id);
          }}
          onClose={() => setOpen(false)}
          searchable
          allowClear={!!onClear}
        />
      ) : null) : (
        <AnchoredDropdown visible={open} anchor={anchorRect} onClose={() => setOpen(false)} maxHeight={340} minWidth={220}>
          <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12 }}>
            <MaterialCommunityIcons name="magnify" size={17} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder={translateCopy("Ara…", language)}
              placeholderTextColor={colors.subtle}
              style={{ color: colors.ink, flex: 1, fontSize: 13.5, minHeight: 42, paddingVertical: 8 }}
            />
          </View>
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {results.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", padding: 14 }}>{translateCopy("Sonuç yok.", language)}</Text>
            ) : null}
            {results.map((r) => (
              <Pressable key={r.id} accessibilityRole="button" accessibilityState={{ selected: r.label === valueLabel }} onPress={() => { onSelect(r.id); setOpen(false); }} style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : "transparent", paddingHorizontal: 14, paddingVertical: 11 })}>
                <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600" }}>{r.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </AnchoredDropdown>
      )}
    </View>
  );
}
