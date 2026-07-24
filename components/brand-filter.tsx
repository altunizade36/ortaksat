import { MaterialCommunityIcons } from "@/components/icons";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy } from "@/lib/i18n";

// Aranabilir/kaydırılabilir facet kutusu — seçenek sayısı chip-facet sınırını aştığında
// kullanılır (marka: araba ~74, telefon 22; İç Özellikler 46, renk, muhit…).
// Keşfet + kategori + ana sayfa filtreleri paylaşır.
export function BrandFilter({ label, options, selected, onToggle, language }: { label: string; options: string[]; selected: string[]; onToggle: (b: string) => void; language: "tr" | "en" }) {
  const [q, setQ] = useState("");
  const needle = q.trim().toLocaleLowerCase("tr-TR");
  // Kırpma 60→200: 79 otomobil markasının son ~19'u (Toyota→Zeekr) filtrede yalnız arama ile
  // görünüyordu ("markalar eksik"). 200 tüm marka listelerini kapsar, arama zaten daraltıyor.
  const shown = (needle ? options.filter((o) => o.toLocaleLowerCase("tr-TR").includes(needle)) : options).slice(0, 200);
  return (
    <View style={{ gap: 6, width: "100%" }}>
      <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800" }}>
        {translateCopy(label, language)}{selected.length ? ` · ${selected.length} ${translateCopy("seçili", language)}` : ""}
      </Text>
      <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 9, borderWidth: 1, flexDirection: "row", gap: 6, minHeight: 38, paddingHorizontal: 9 }}>
        <MaterialCommunityIcons name="magnify" size={16} color={colors.muted} />
        <TextInput value={q} onChangeText={setQ} placeholder={`${translateCopy(label, language)} ${translateCopy("ara…", language)}`} placeholderTextColor={colors.subtle} style={{ color: colors.ink, flex: 1, fontSize: 13, minHeight: 38 }} />
        {q ? <Pressable onPress={() => setQ("")} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={16} color={colors.muted} /></Pressable> : null}
      </View>
      {selected.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
          {selected.map((b) => (
            <Pressable key={b} onPress={() => onToggle(b)} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, flexDirection: "row", gap: 4, paddingHorizontal: 9, paddingVertical: 4 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "800" }}>{b}</Text>
              <MaterialCommunityIcons name="close" size={12} color="#FFFFFF" />
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={{ maxHeight: 150 }}>
        <ScrollView showsVerticalScrollIndicator style={{ maxHeight: 150 }} contentContainerStyle={{ flexDirection: "row", flexWrap: "wrap", gap: 5 }}>
          {shown.map((o) => {
            const on = selected.includes(o);
            return (
              <Pressable key={o} onPress={() => onToggle(o)} style={{ backgroundColor: on ? colors.primarySoft : colors.surfaceAlt, borderColor: on ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, paddingHorizontal: 9, paddingVertical: 4 }}>
                <Text style={{ color: on ? colors.primaryDark : colors.ink, fontSize: 11, fontWeight: "800" }}>{o}</Text>
              </Pressable>
            );
          })}
          {shown.length === 0 ? <Text style={{ color: colors.subtle, fontSize: 12, fontWeight: "700", padding: 6 }}>{translateCopy("Sonuç yok", language)}</Text> : null}
        </ScrollView>
      </View>
    </View>
  );
}
