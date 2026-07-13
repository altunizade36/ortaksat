import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { OptionSheet } from "@/components/option-sheet";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { districtsOfProvince, locKey, provinces, searchDistricts, searchProvinces } from "@/lib/locations";
import { fetchNeighborhoods, type Neighborhood } from "@/lib/location-service";

export type LocationValue = {
  provinceId?: number;
  districtId?: number;
  neighborhood?: string;
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
  showNeighborhood = true,
  showAddressLine = false,
  mode = "listing"
}: {
  value: LocationValue;
  onChange: (next: LocationValue) => void;
  required?: boolean;
  showNeighborhood?: boolean;
  showAddressLine?: boolean;
  mode?: Mode;
}) {
  const { language } = useLanguage();
  const districtList = useMemo(() => districtsOfProvince(value.provinceId), [value.provinceId]);
  const provinceLabel = provinces.find((p) => p.id === value.provinceId)?.name;
  const districtLabel = districtList.find((d) => d.id === value.districtId)?.name;

  return (
    <View style={{ gap: 12, zIndex: 5 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 180, zIndex: 30 }}>
          <ComboBox
            label={`${translateCopy("İl", language)}${required ? " *" : ""}`}
            placeholder={mode === "filter" ? translateCopy("Tüm iller", language) : translateCopy("İl seçin", language)}
            valueLabel={provinceLabel}
            search={(q) => searchProvinces(q).map((p) => ({ id: p.id, label: p.name }))}
            onSelect={(id) => onChange({ provinceId: id, districtId: undefined, neighborhood: undefined, addressLine: value.addressLine })}
            onClear={mode === "filter" ? () => onChange({}) : undefined}
          />
        </View>
        <View style={{ flex: 1, minWidth: 180, zIndex: 20 }}>
          <ComboBox
            label={`${translateCopy("İlçe", language)}${required ? " *" : ""}`}
            placeholder={value.provinceId ? (mode === "filter" ? translateCopy("Tüm ilçeler", language) : translateCopy("İlçe seçin", language)) : translateCopy("Önce il seçin", language)}
            valueLabel={districtLabel}
            disabled={!value.provinceId}
            search={(q) => searchDistricts(value.provinceId, q).map((d) => ({ id: d.id, label: d.name }))}
            onSelect={(id) => onChange({ ...value, districtId: id, neighborhood: undefined })}
            onClear={mode === "filter" ? () => onChange({ ...value, districtId: undefined, neighborhood: undefined }) : undefined}
          />
        </View>
        {showNeighborhood ? (
          <View style={{ flex: 1, minWidth: 180, zIndex: 10 }}>
            <FieldLabel text={`${translateCopy("Mahalle / Köy", language)}${required ? " *" : ""}`} />
            <NeighborhoodField districtId={value.districtId} value={value.neighborhood} onChange={(n) => onChange({ ...value, neighborhood: n })} />
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
function NeighborhoodField({ districtId, value, onChange }: { districtId?: number; value?: string; onChange: (n: string) => void }) {
  const { language } = useLanguage();
  const [list, setList] = useState<Neighborhood[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [manual, setManual] = useState(false);

  useEffect(() => {
    let active = true;
    setList([]);
    setManual(false);
    if (districtId == null) return;
    fetchNeighborhoods(districtId).then((rows) => { if (active) setList(rows); }).catch(() => undefined);
    return () => { active = false; };
  }, [districtId]);

  const hasData = list.length > 0;
  const results = open ? list.filter((n) => locKey(n.name).includes(locKey(query))).slice(0, 40) : [];

  // Mahalle listesi de açılınca görünür alana kaydırılmalı (il/ilçe ile aynı mobil hata).
  useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof document === "undefined") return;
    const id = requestAnimationFrame(() => {
      const el = document.querySelector('[data-openloc="1"]') as HTMLElement | null;
      el?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  // Veri yoksa veya kullanıcı "listede yok" dediyse: serbest metin
  if (!hasData || manual) {
    return (
      <View>
        <View style={{ alignItems: "center", backgroundColor: districtId ? colors.surfaceAlt : colors.background, borderColor: colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 8, opacity: districtId ? 1 : 0.55, paddingHorizontal: 12 }}>
          <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.muted} />
          <TextInput editable={!!districtId} value={value ?? ""} onChangeText={onChange} placeholder={districtId ? translateCopy("Mahalle yazın", language) : translateCopy("Önce ilçe seçin", language)} placeholderTextColor={colors.subtle} style={{ color: colors.ink, flex: 1, fontSize: 13.5, minHeight: 44, paddingVertical: 8 }} />
          {hasData ? <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Listeden seç", language)} onPress={() => { setManual(false); }} hitSlop={8}><MaterialCommunityIcons name="format-list-bulleted" size={17} color={colors.muted} /></Pressable> : null}
        </View>
        {districtId && (value?.trim().length ?? 0) > 1 ? (
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", marginTop: 4 }}>{translateCopy("Mahalleniz listede yoksa yazdığınız ad öneri olarak kaydedilir, ekibimiz inceler.", language)}</Text>
        ) : null}
      </View>
    );
  }

  // Gerçek mahalle listesi (Supabase)
  return (
    <View style={{ gap: 4 }}>
      <Pressable onPress={() => { setOpen((o) => !o); setQuery(""); }} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: open ? colors.primary : colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 46, paddingHorizontal: 12 }}>
        <MaterialCommunityIcons name="map-marker-outline" size={18} color={value ? colors.primary : colors.muted} />
        <Text numberOfLines={1} style={{ color: value ? colors.ink : colors.subtle, flex: 1, fontSize: 13.5, fontWeight: value ? "700" : "500" }}>{value || translateCopy("Mahalle seçin", language)}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open ? (
        <View dataSet={{ openloc: "1" }} style={{ backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 12, borderWidth: 1, maxHeight: 320, overflow: "hidden" }}>
          <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12 }}>
            <MaterialCommunityIcons name="magnify" size={17} color={colors.muted} />
            <TextInput value={query} onChangeText={setQuery} autoFocus placeholder={translateCopy("Mahalle ara…", language)} placeholderTextColor={colors.subtle} style={{ color: colors.ink, flex: 1, fontSize: 13.5, minHeight: 42, paddingVertical: 8 }} />
          </View>
          <ScrollView style={{ maxHeight: 230 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {results.map((n) => (
              <Pressable key={n.id} onPress={() => { onChange(n.name); setOpen(false); }} style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : "transparent", paddingHorizontal: 14, paddingVertical: 10 })}>
                <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600" }}>{n.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={() => { setManual(true); setOpen(false); }} style={{ alignItems: "center", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 14, paddingVertical: 11 }}>
            <MaterialCommunityIcons name="plus-circle-outline" size={16} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Mahallem listede yok", language)}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
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
  const results = open ? search(query).slice(0, 40) : [];
  // MOBİL WEB: açılan liste (320px) ekranın altındaki bir alanda açılınca görünür alanın
  // DIŞINDA kalıyordu → kullanıcı basıyor, hiçbir şey olmamış gibi görünüyordu.
  // (RN-web View ref'i DOM düğümü garanti etmez → dataSet + querySelector ile hedefle.)
  useEffect(() => {
    if (!open || Platform.OS !== "web" || typeof document === "undefined") return;
    const id = requestAnimationFrame(() => {
      const el = document.querySelector('[data-openloc="1"]') as HTMLElement | null;
      el?.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
    });
    return () => cancelAnimationFrame(id);
  }, [open]);

  return (
    <View style={{ gap: 4 }}>
      <FieldLabel text={label} />
      <Pressable
        onPress={() => { if (!disabled) { setOpen((o) => !o); setQuery(""); } }}
        style={{ alignItems: "center", backgroundColor: disabled ? colors.background : colors.surfaceAlt, borderColor: open ? colors.primary : colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 46, opacity: disabled ? 0.55 : 1, paddingHorizontal: 12 }}
      >
        <MaterialCommunityIcons name="map-marker-radius-outline" size={18} color={valueLabel ? colors.primary : colors.muted} />
        <Text numberOfLines={1} style={{ color: valueLabel ? colors.ink : colors.subtle, flex: 1, fontSize: 13.5, fontWeight: valueLabel ? "700" : "500" }}>
          {valueLabel ?? placeholder}
        </Text>
        {valueLabel && onClear ? (
          <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Temizle", language)} onPress={() => { onClear(); setOpen(false); }} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={16} color={colors.muted} /></Pressable>
        ) : (
          <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
        )}
      </Pressable>

      {/* NATIVE: alttan açılan seçim sayfası + arama (81 il / ilçeler konumdan bağımsız tam görünür). */}
      {Platform.OS !== "web" ? (
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
        />
      ) : null}
      {open && Platform.OS === "web" ? (
        <View dataSet={{ openloc: "1" }} style={{ backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 12, borderWidth: 1, marginTop: 2, maxHeight: 320, overflow: "hidden" }}>
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
          <ScrollView style={{ maxHeight: 270 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {results.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", padding: 14 }}>{translateCopy("Sonuç yok.", language)}</Text>
            ) : null}
            {results.map((r) => (
              <Pressable key={r.id} onPress={() => { onSelect(r.id); setOpen(false); }} style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : "transparent", paddingHorizontal: 14, paddingVertical: 11 })}>
                <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "600" }}>{r.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}
    </View>
  );
}
