import { MaterialCommunityIcons } from "@/components/icons";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { resolveFormKey, suggestCategories, type CategoryNode } from "@/lib/category-tree";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { getRecentCategories, pushRecentCategory, subscribeRecentCategories, type RecentCategory } from "@/lib/recent-categories";
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
  // Dalda "seç" yalnızca kendi ÖZGÜL formu varsa açık kalır. Jenerik forma
  // ("alisverisGenel") düşen bir dalda (Elektronik/Ev…) alt kategorileri olan
  // düğümde durmak yanlış form verir → kullanıcı yaprağa inmeli.
  const currentFormKey = trail.length ? resolveFormKey(trail) : "";
  const hasChildren = !!(current?.children && current.children.length);
  const canFinalizeHere = trail.length >= 2 && (!hasChildren || currentFormKey !== "alisverisGenel");

  // SON KULLANILAN KATEGORİLER: aynı satıcı çoğunlukla aynı kategoride tekrar ilan
  // veriyor; 4594 yapraklı ağacı her seferinde gezmesin diye çip olarak sunulur.
  const [recents, setRecents] = useState<RecentCategory[]>([]);
  useEffect(() => { setRecents(getRecentCategories()); return subscribeRecentCategories(setRecents); }, []);

  /** Seçim kesinleşince hem forma geç hem "son kullanılan"a yaz. */
  const finalize = (path: CategoryNode[]) => {
    pushRecentCategory({ slugs: path.map((n) => n.slug), labels: path.map((n) => n.label) });
    onChange(path);
  };
  /** Çipten seçim: kayıtlı slug yolunu ağaçta yeniden çöz (ağaç değişmişse sessizce atla). */
  const pickRecent = (rc: RecentCategory) => {
    const path: CategoryNode[] = [];
    let level = categoryTree;
    for (const slug of rc.slugs) {
      const hit = level.find((n) => n.slug === slug || n.key === slug);
      if (!hit) return;
      path.push(hit);
      level = hit.children ?? [];
    }
    if (path.length) finalize(path);
  };


  const pickTop = (n: CategoryNode) => { setTrail([n]); setQuery(""); };
  const pickChild = (n: CategoryNode) => {
    const next = [...trail, n];
    if (n.children && n.children.length) setTrail(next);
    else finalize(next); // leaf → finalize
  };
  const selectCurrent = () => { if (trail.length >= 2) finalize(trail); };
  const goTo = (idx: number) => setTrail(trail.slice(0, idx + 1));

  const previewPath = finalized ? value : trail;

  return (
    <View style={{ gap: 12 }}>
      {/* Arama */}
      <View style={{ gap: 6 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: query ? colors.primary : colors.line, borderRadius: 11, borderWidth: 1, flexDirection: "row", gap: 9, paddingHorizontal: 13 }}>
          <MaterialCommunityIcons name="magnify" size={19} color={colors.subtle} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder={translateCopy("Ne satıyorsun? iPhone, koltuk, araba, arsa…", language)}
            placeholderTextColor={colors.subtle}
            style={{ color: colors.ink, flex: 1, fontSize: 14.5, minHeight: 46, paddingVertical: 9 }}
          />
          {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><MaterialCommunityIcons name="close-circle" size={17} color={colors.muted} /></Pressable> : null}
        </View>
        {suggestions.length ? (
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 11, borderWidth: 1, overflow: "hidden" }}>
            {suggestions.map((s) => (
              <Pressable key={s.labels.join(">")} onPress={() => { finalize(s.path); setQuery(""); }} style={({ pressed }) => ({ backgroundColor: pressed ? colors.surfaceAlt : "transparent", borderBottomColor: colors.line, borderBottomWidth: 1, paddingHorizontal: 13, paddingVertical: 10 })}>
                <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{translateCopy(s.labels[s.labels.length - 1], language)}</Text>
                <Text numberOfLines={1} style={{ color: colors.subtle, fontSize: 11.5, fontWeight: "600" }}>{s.labels.map((l) => translateCopy(l, language)).join(" › ")}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {/* Seçilen yol (breadcrumb) — sade metin */}
      {previewPath.length ? (
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 3 }}>
          {previewPath.map((p, i) => (
            <View key={p.key} style={{ alignItems: "center", flexDirection: "row", gap: 3 }}>
              {i > 0 ? <Text style={{ color: colors.subtle, fontSize: 12 }}>›</Text> : null}
              <Pressable onPress={() => !finalized && goTo(i)}>
                <Text style={{ color: i === previewPath.length - 1 ? colors.primaryDark : colors.muted, fontSize: 12.5, fontWeight: i === previewPath.length - 1 ? "900" : "700" }}>{translateCopy(p.label, language)}</Text>
              </Pressable>
            </View>
          ))}
          {finalized ? (
            <Pressable onPress={() => onChange([])} hitSlop={6} style={{ marginLeft: 8 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "800" }}>{translateCopy("Değiştir", language)}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {/* Son kullanılan — tekrar ilan veren satıcı 4594 yapraklı ağacı gezmesin (sade, sayısız) */}
      {!finalized && !top && !query.trim() && recents.length ? (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          {recents.slice(0, 6).map((rc) => (
            <Pressable key={rc.slugs.join(">")} onPress={() => pickRecent(rc)} style={({ pressed }) => ({ backgroundColor: pressed ? colors.primarySoft : colors.surfaceAlt, borderColor: colors.line, borderRadius: 999, borderWidth: 1, minHeight: 34, justifyContent: "center", paddingHorizontal: 12 })}>
              <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 12, fontWeight: "700", maxWidth: 200 }}>{rc.labels[rc.labels.length - 1]}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {!finalized ? (
        <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 12 }}>
          {/* Sütun 1: ana kategoriler (mobilde üst seçilince gizlenir) */}
          {isWideWeb || !top ? (
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexBasis: 240, flexGrow: 1, maxWidth: isWideWeb ? 300 : undefined, overflow: "hidden", width: isWideWeb ? undefined : "100%" }}>
              <ScrollView nestedScrollEnabled style={{ maxHeight: isWideWeb ? 440 : 400 }}>
                {categoryTree.map((n, i) => {
                  const on = top?.key === n.key;
                  return (
                    <Pressable key={n.key} onPress={() => pickTop(n)} style={{ alignItems: "center", backgroundColor: on ? colors.primarySoft : "transparent", borderTopColor: colors.line, borderTopWidth: i === 0 ? 0 : 1, flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 13 }}>
                      <Text numberOfLines={1} style={{ color: on ? colors.primaryDark : colors.ink, flex: 1, fontSize: 14, fontWeight: on ? "900" : "600" }}>{translateCopy(n.label, language)}</Text>
                      <MaterialCommunityIcons name="chevron-right" size={18} color={on ? colors.primary : colors.subtle} />
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}

          {/* Sütun 2: alt kategoriler */}
          {top ? (
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexBasis: 240, flexGrow: 1.6, minWidth: 0, overflow: "hidden", width: isWideWeb ? undefined : "100%" }}>
              {!isWideWeb ? (
                // GERİ = BİR SEVİYE YUKARI (Sahibinden-mobil paritesi). Eskiden setTrail([]) ile
                // KÖKE atıyor + hep top.label gösteriyordu → derinde (Vasıta>Otomobil>BMW) "‹ Vasıta"
                // deyip tek dokunuşta en başa fırlatıyordu. Şimdi mevcut seviyeyi gösterir, bir üste döner.
                <Pressable onPress={() => setTrail(trail.slice(0, -1))} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 11 }}>
                  <MaterialCommunityIcons name="chevron-left" size={18} color={colors.primaryDark} />
                  <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy(trail.length > 1 ? current.label : "Tüm kategoriler", language)}</Text>
                </Pressable>
              ) : null}
              <ScrollView nestedScrollEnabled style={{ maxHeight: isWideWeb ? 440 : 420 }}>
                {canFinalizeHere ? (
                  <Pressable onPress={selectCurrent} style={{ alignItems: "center", backgroundColor: colors.primarySoft, flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 13 }}>
                    <MaterialCommunityIcons name="check-circle" size={18} color={colors.primary} />
                    <Text style={{ color: colors.primaryDark, flex: 1, fontSize: 13.5, fontWeight: "900" }}>“{translateCopy(current.label, language)}” {translateCopy("ile devam et", language)}</Text>
                  </Pressable>
                ) : null}
                {midItems.length === 0 && !canFinalizeHere ? (
                  <View style={{ gap: 10, padding: 16 }}>
                    <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600" }}>{translateCopy("Bu bir son kategori. Seçerek devam edebilirsin.", language)}</Text>
                    <Pressable onPress={selectCurrent} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 12 }}>
                      <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>“{translateCopy(current.label, language)}” {translateCopy("ile devam et", language)}</Text>
                    </Pressable>
                  </View>
                ) : (
                  midItems.map((n, i) => (
                    <Pressable key={n.key} onPress={() => pickChild(n)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : "transparent", borderTopColor: colors.line, borderTopWidth: (i === 0 && !canFinalizeHere) ? 0 : 1, flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 13 })}>
                      <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "600" }}>{translateCopy(n.label, language)}</Text>
                      {n.children && n.children.length ? <MaterialCommunityIcons name="chevron-right" size={18} color={colors.subtle} /> : null}
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </View>
          ) : !isWideWeb ? null : (
            <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 12, borderWidth: 1, flexBasis: 240, flexGrow: 1.6, padding: 20 }}>
              <Text style={{ color: colors.subtle, fontSize: 13, fontWeight: "600" }}>{translateCopy("Soldan bir ana kategori seç.", language)}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={{ alignItems: "center", backgroundColor: colors.successSoft, borderColor: colors.success, borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 10, padding: 13 }}>
          <MaterialCommunityIcons name="check-circle" size={20} color={colors.success} />
          <Text style={{ color: colors.ink, flex: 1, fontSize: 13.5, fontWeight: "800" }}>{translateCopy("Kategori seçildi. Form aşağıda hazır.", language)}</Text>
        </View>
      )}
    </View>
  );
}
