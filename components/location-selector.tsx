import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
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
  const districtList = useMemo(() => districtsOfProvince(value.provinceId), [value.provinceId]);
  const provinceLabel = provinces.find((p) => p.id === value.provinceId)?.name;
  const districtLabel = districtList.find((d) => d.id === value.districtId)?.name;

  return (
    <View style={{ gap: 12, zIndex: 5 }}>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 180, zIndex: 30 }}>
          <ComboBox
            label={`İl${required ? " *" : ""}`}
            placeholder={mode === "filter" ? "Tüm iller" : "İl seçin"}
            valueLabel={provinceLabel}
            search={(q) => searchProvinces(q).map((p) => ({ id: p.id, label: p.name }))}
            onSelect={(id) => onChange({ provinceId: id, districtId: undefined, neighborhood: undefined, addressLine: value.addressLine })}
            onClear={mode === "filter" ? () => onChange({}) : undefined}
          />
        </View>
        <View style={{ flex: 1, minWidth: 180, zIndex: 20 }}>
          <ComboBox
            label={`İlçe${required ? " *" : ""}`}
            placeholder={value.provinceId ? (mode === "filter" ? "Tüm ilçeler" : "İlçe seçin") : "Önce il seçin"}
            valueLabel={districtLabel}
            disabled={!value.provinceId}
            search={(q) => searchDistricts(value.provinceId, q).map((d) => ({ id: d.id, label: d.name }))}
            onSelect={(id) => onChange({ ...value, districtId: id, neighborhood: undefined })}
            onClear={mode === "filter" ? () => onChange({ ...value, districtId: undefined, neighborhood: undefined }) : undefined}
          />
        </View>
        {showNeighborhood ? (
          <View style={{ flex: 1, minWidth: 180, zIndex: 10 }}>
            <FieldLabel text={`Mahalle / Köy${required ? " *" : ""}`} />
            <NeighborhoodField districtId={value.districtId} value={value.neighborhood} onChange={(n) => onChange({ ...value, neighborhood: n })} />
          </View>
        ) : null}
      </View>

      {showAddressLine ? (
        <View>
          <FieldLabel text="Açık adres (opsiyonel)" />
          <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 11, borderWidth: 1, paddingHorizontal: 12 }}>
            <TextInput
              value={value.addressLine ?? ""}
              onChangeText={(t) => onChange({ ...value, addressLine: t })}
              placeholder="Cadde, sokak, no — yalnızca satış/talep onayından sonra paylaşılır"
              placeholderTextColor={colors.subtle}
              multiline
              style={{ color: colors.ink, fontSize: 13.5, minHeight: 56, paddingVertical: 10, textAlignVertical: "top" }}
            />
          </View>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 6, marginTop: 5 }}>
            <MaterialCommunityIcons name="shield-lock-outline" size={14} color={colors.success} />
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600" }}>Açık adres herkese gösterilmez. İlanda yalnızca il / ilçe / mahalle görünür.</Text>
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

  // Veri yoksa veya kullanıcı "listede yok" dediyse: serbest metin
  if (!hasData || manual) {
    return (
      <View>
        <View style={{ alignItems: "center", backgroundColor: districtId ? colors.surfaceAlt : colors.background, borderColor: colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 8, opacity: districtId ? 1 : 0.55, paddingHorizontal: 12 }}>
          <MaterialCommunityIcons name="map-marker-outline" size={18} color={colors.muted} />
          <TextInput editable={!!districtId} value={value ?? ""} onChangeText={onChange} placeholder={districtId ? "Mahalle yazın" : "Önce ilçe seçin"} placeholderTextColor={colors.subtle} style={{ color: colors.ink, flex: 1, fontSize: 13.5, minHeight: 44, paddingVertical: 8 }} />
          {hasData ? <Pressable onPress={() => { setManual(false); }} hitSlop={8}><MaterialCommunityIcons name="format-list-bulleted" size={17} color={colors.muted} /></Pressable> : null}
        </View>
        {districtId && (value?.trim().length ?? 0) > 1 ? (
          <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "600", marginTop: 4 }}>Mahalleniz listede yoksa yazdığınız ad öneri olarak kaydedilir, ekibimiz inceler.</Text>
        ) : null}
      </View>
    );
  }

  // Gerçek mahalle listesi (Supabase)
  return (
    <View style={{ gap: 4 }}>
      <Pressable onPress={() => { setOpen((o) => !o); setQuery(""); }} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: open ? colors.primary : colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 8, minHeight: 46, paddingHorizontal: 12 }}>
        <MaterialCommunityIcons name="map-marker-outline" size={18} color={value ? colors.primary : colors.muted} />
        <Text numberOfLines={1} style={{ color: value ? colors.ink : colors.subtle, flex: 1, fontSize: 13.5, fontWeight: value ? "700" : "500" }}>{value || "Mahalle seçin"}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>
      {open ? (
        <View style={{ backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 12, borderWidth: 1, maxHeight: 320, overflow: "hidden" }}>
          <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12 }}>
            <MaterialCommunityIcons name="magnify" size={17} color={colors.muted} />
            <TextInput value={query} onChangeText={setQuery} autoFocus placeholder="Mahalle ara…" placeholderTextColor={colors.subtle} style={{ color: colors.ink, flex: 1, fontSize: 13.5, minHeight: 42, paddingVertical: 8 }} />
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
            <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>Mahallem listede yok</Text>
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
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = open ? search(query).slice(0, 40) : [];

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
          <Pressable onPress={() => { onClear(); setOpen(false); }} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={16} color={colors.muted} /></Pressable>
        ) : (
          <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
        )}
      </Pressable>

      {open ? (
        <View style={{ backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 12, borderWidth: 1, marginTop: 2, maxHeight: 320, overflow: "hidden" }}>
          <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 12 }}>
            <MaterialCommunityIcons name="magnify" size={17} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              autoFocus
              placeholder="Ara…"
              placeholderTextColor={colors.subtle}
              style={{ color: colors.ink, flex: 1, fontSize: 13.5, minHeight: 42, paddingVertical: 8 }}
            />
          </View>
          <ScrollView style={{ maxHeight: 270 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
            {results.length === 0 ? (
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", padding: 14 }}>Sonuç yok.</Text>
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
