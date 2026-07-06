import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { getFormSchema, resolveFormKey, suggestCategories, type CategoryNode } from "@/lib/category-tree";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { useStore } from "@/lib/use-store";

/**
 * Sahibinden-style multi-level category picker.
 * Üstte arama + öneri, solda üst kategoriler, ortada alt seviyeler (breadcrumb
 * ile), sağda seçim özeti ve o kategori için gereken bilgiler. Seçim bitince
 * onChange(path) çağrılır; form alanları bu path'e göre değişir.
 */
export function CategoryPicker({ value, onChange }: { value: CategoryNode[]; onChange: (path: CategoryNode[]) => void }) {
  const { categoryTree } = useStore();
  const { language } = useLanguage();
  const isWideWeb = useIsWideWeb();
  const [trail, setTrail] = useState<CategoryNode[]>(value ?? []);
  const [query, setQuery] = useState("");
  const suggestions = query.trim().length >= 2 ? suggestCategories(query, 7) : [];

  const top = trail[0];
  const current = trail[trail.length - 1];
  const midItems = current?.children ?? (top ? [] : []);
  const finalized = value.length > 0;

  const pickTop = (n: CategoryNode) => { setTrail([n]); setQuery(""); };
  const pickChild = (n: CategoryNode) => {
    const next = [...trail, n];
    if (n.children && n.children.length) setTrail(next);
    else onChange(next); // leaf → finalize
  };
  const selectCurrent = () => { if (trail.length >= 2) onChange(trail); };
  const goTo = (idx: number) => setTrail(trail.slice(0, idx + 1));

  const previewPath = finalized ? value : trail;
  const formKey = previewPath.length ? resolveFormKey(previewPath) : "";
  const requiredLabels = formKey ? getFormSchema(formKey).fields.filter((f) => f.required).map((f) => f.label) : [];

  return (
    <View style={{ gap: 14 }}>
      {/* Para-modeli bilgi kutusu (her kategori ekranında görünür) */}
      <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 10, flexDirection: "row", gap: 9, paddingHorizontal: 12, paddingVertical: 9 }}>
        <MaterialCommunityIcons name="shield-check-outline" size={17} color={colors.primaryDark} />
        <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 12, fontWeight: "700", lineHeight: 16 }}>
          {translateCopy("OrtakSat ödeme, kargo veya komisyon işlemez. Taraflar kendi aralarında anlaşır; platform yalnızca ilan ve eşleşme altyapısı sağlar.", language)}
        </Text>
      </View>
      {/* Search + suggestions */}
      <View style={{ gap: 6 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: query ? colors.primary : colors.line, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 14 }}>
          <MaterialCommunityIcons name="magnify" size={20} color={colors.primary} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={translateCopy("Ne satıyorsun? iPhone, koltuk, araba, arsa…", language)}
            placeholderTextColor={colors.subtle}
            style={{ color: colors.ink, flex: 1, fontSize: 14.5, minHeight: 50, paddingVertical: 10 }}
          />
          {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
        </View>
        {suggestions.length ? (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 12, borderWidth: 1, overflow: "hidden" }}>
            {suggestions.map((s) => (
              <Pressable key={s.labels.join(">")} onPress={() => { onChange(s.path); setQuery(""); }} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : "transparent", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 11 })}>
                <MaterialCommunityIcons name="tag-arrow-right-outline" size={18} color={colors.primary} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{translateCopy(s.labels[s.labels.length - 1], language)}</Text>
                  <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>{s.labels.map((l) => translateCopy(l, language)).join(" › ")}</Text>
                </View>
                <MaterialCommunityIcons name="arrow-right" size={16} color={colors.muted} />
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* Breadcrumb */}
      {previewPath.length ? (
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
          <MaterialCommunityIcons name="map-marker-path" size={16} color={colors.muted} />
          {previewPath.map((p, i) => (
            <View key={p.key} style={{ alignItems: "center", flexDirection: "row", gap: 4 }}>
              {i > 0 ? <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} /> : null}
              <Pressable onPress={() => !finalized && goTo(i)}>
                <Text style={{ color: i === previewPath.length - 1 ? colors.primaryDark : colors.muted, fontSize: 12.5, fontWeight: i === previewPath.length - 1 ? "900" : "700" }}>{translateCopy(p.label, language)}</Text>
              </Pressable>
            </View>
          ))}
          {finalized ? (
            <Pressable onPress={() => onChange([])} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 999, flexDirection: "row", gap: 4, marginLeft: 8, paddingHorizontal: 10, paddingVertical: 4 }}>
              <MaterialCommunityIcons name="pencil-outline" size={13} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "800" }}>{translateCopy("Değiştir", language)}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {!finalized ? (
        <View style={{ alignItems: "flex-start", flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {/* Pane 1: top categories — mobilde bir üst kategori seçilince gizlenir (dar ekranda alt kategoriye odak). */}
          {isWideWeb || !top ? (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 230, flexGrow: 1, maxWidth: isWideWeb ? 280 : undefined, overflow: "hidden", width: isWideWeb ? undefined : "100%" }}>
            <Text style={{ backgroundColor: colors.surfaceAlt, color: colors.muted, fontSize: 11.5, fontWeight: "900", letterSpacing: 0.4, paddingHorizontal: 14, paddingVertical: 9, textTransform: "uppercase" }}>{translateCopy("Ana Kategori", language)}</Text>
            <ScrollView style={{ maxHeight: isWideWeb ? 420 : 320 }}>
              {categoryTree.map((n) => {
                const on = top?.key === n.key;
                return (
                  <Pressable key={n.key} onPress={() => pickTop(n)} style={{ alignItems: "center", backgroundColor: on ? colors.primarySoft : "transparent", borderLeftColor: on ? colors.primary : "transparent", borderLeftWidth: 3, flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 11 }}>
                    {n.image ? <View style={{ borderRadius: 8, height: 30, overflow: "hidden", width: 30 }}><SafeRemoteImage uri={n.image} style={{ height: "100%", width: "100%" }} contentFit="cover" /></View> : null}
                    <Text numberOfLines={1} style={{ color: on ? colors.primaryDark : colors.ink, flex: 1, fontSize: 13.5, fontWeight: on ? "900" : "700" }}>{translateCopy(n.label, language)}</Text>
                    <MaterialCommunityIcons name="chevron-right" size={17} color={on ? colors.primary : colors.subtle} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
          ) : null}

          {/* Pane 2: current level children */}
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 230, flexGrow: 1.4, minWidth: 0, overflow: "hidden", width: isWideWeb ? undefined : "100%" }}>
            <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 9 }}>
              {!isWideWeb && top ? (
                <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Üst kategoriye dön", language)} onPress={() => setTrail([])} hitSlop={8}>
                  <MaterialCommunityIcons name="chevron-left" size={18} color={colors.primaryDark} />
                </Pressable>
              ) : null}
              <Text style={{ color: colors.muted, flex: 1, fontSize: 11.5, fontWeight: "900", letterSpacing: 0.4, textTransform: "uppercase" }}>
                {current ? `${translateCopy(current.label, language)} — ${translateCopy("Alt Kategori", language)}` : translateCopy("Önce ana kategori seçin", language)}
              </Text>
            </View>
            <ScrollView style={{ maxHeight: isWideWeb ? 420 : 360 }}>
              {!current ? (
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", padding: 16 }}>{translateCopy("Soldan bir ana kategori seçerek başlayın ya da yukarıdan arayın.", language)}</Text>
              ) : midItems.length === 0 ? (
                <View style={{ gap: 10, padding: 16 }}>
                  <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "700" }}>{translateCopy("Bu bir son kategori. Seçerek devam edebilirsin.", language)}</Text>
                  <Pressable onPress={selectCurrent} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 11 }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>“{translateCopy(current.label, language)}” {translateCopy("ile devam et", language)}</Text>
                  </Pressable>
                </View>
              ) : (
                midItems.map((n) => (
                  <Pressable key={n.key} onPress={() => pickChild(n)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : "transparent", borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 11 })}>
                    <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "700" }}>{translateCopy(n.label, language)}</Text>
                    {n.children && n.children.length ? <MaterialCommunityIcons name="chevron-right" size={17} color={colors.subtle} /> : <MaterialCommunityIcons name="checkbox-blank-circle-outline" size={15} color={colors.subtle} />}
                  </Pressable>
                ))
              )}
            </ScrollView>
          </View>

          {/* Pane 3: summary */}
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 220, flexGrow: 1, gap: 10, maxWidth: isWideWeb ? 300 : undefined, padding: 16, width: isWideWeb ? undefined : "100%" }}>
            <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900" }}>{translateCopy("Seçim özeti", language)}</Text>
            {previewPath.length ? (
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{previewPath.map((p) => translateCopy(p.label, language)).join(" › ")}</Text>
            ) : (
              <Text style={{ color: colors.subtle, fontSize: 12.5, fontWeight: "600" }}>{translateCopy("Henüz kategori seçilmedi.", language)}</Text>
            )}
            {trail.length >= 2 ? (
              <Pressable onPress={selectCurrent} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 7, justifyContent: "center", paddingVertical: 11 }}>
                <MaterialCommunityIcons name="check" size={16} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Bu kategoriyi seç", language)}</Text>
              </Pressable>
            ) : null}
            {requiredLabels.length ? (
              <View style={{ backgroundColor: colors.primarySoft, borderRadius: 10, gap: 4, marginTop: 2, padding: 11 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 11.5, fontWeight: "900" }}>{translateCopy("Bu kategori için gerekenler:", language)}</Text>
                <Text numberOfLines={4} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{requiredLabels.join(", ")}{translateCopy(", fotoğraf, fiyat, konum, komisyon.", language)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : (
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 14, borderWidth: 1, flexDirection: "row", gap: 12, padding: 14 }}>
          <MaterialCommunityIcons name="check-decagram" size={24} color={colors.primaryDark} />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{translateCopy("Kategori seçildi", language)}</Text>
            <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600" }}>{translateCopy("Bu kategori için form aşağıda buna göre hazırlandı:", language)} {requiredLabels.slice(0, 4).join(", ")}…</Text>
          </View>
        </View>
      )}
    </View>
  );
}
