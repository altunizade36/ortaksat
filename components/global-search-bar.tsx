import { MaterialCommunityIcons } from "@/components/icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { suggestCategories } from "@/lib/category-tree";
import { moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { searchAndRank } from "@/lib/search";
import { clearRecentSearches, getRecentSearches, pushRecentSearch, removeRecentSearch } from "@/lib/recent-searches";
import { displayText } from "@/lib/text";
import { useStore } from "@/lib/use-store";

export function GlobalSearchBar() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const { language, t } = useLanguage();
  const { listings } = useStore();
  const [value, setValue] = useState(params.q ?? "");
  const [focused, setFocused] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setValue(params.q ?? "");
  }, [params.q]);

  const q = value.trim();
  const suggestions = useMemo(() => {
    if (q.length < 2) return { cats: [] as ReturnType<typeof suggestCategories>, products: [] as typeof listings };
    // Yazım-hata toleranslı + alaka sıralı öneriler (fuzzy).
    const products = searchAndRank(listings.filter((l) => l.status === "active"), q).slice(0, 6);
    return { cats: suggestCategories(q, 4), products };
  }, [q, listings]);

  const hasSug = focused && q.length >= 2 && (suggestions.cats.length > 0 || suggestions.products.length > 0);
  // Boş/kısa sorguda ve odaktayken son aramaları göster (hızlı tekrar).
  const showRecents = focused && q.length < 2 && recents.length > 0;

  function submitSearch(query?: string) {
    const finalQ = (query ?? value).trim();
    if (finalQ.length >= 2) pushRecentSearch(finalQ);
    inputRef.current?.blur();
    setFocused(false);
    router.push({ pathname: "/(tabs)/explore", params: finalQ ? { q: finalQ } : undefined });
  }

  return (
    <View style={{ position: "relative", width: "100%", zIndex: hasSug || showRecents ? 1000 : 1 }}>
      <View
        style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderColor: focused ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 10, height: 46, minWidth: 0, paddingLeft: 16, paddingRight: 6, width: "100%" }}
      >
        <MaterialCommunityIcons name="magnify" size={21} color={colors.muted} />
        <TextInput
          ref={inputRef}
          value={value}
          onChangeText={setValue}
          onFocus={() => { setRecents(getRecentSearches()); setFocused(true); }}
          onBlur={() => setTimeout(() => setFocused(false), 180)}
          onSubmitEditing={() => submitSearch()}
          blurOnSubmit
          accessibilityRole="search"
          accessibilityLabel={t("searchPlaceholder")}
          placeholder={t("searchPlaceholder")}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          submitBehavior="submit"
          style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "700", height: 40, minWidth: 0, paddingVertical: 0 }}
        />
        {value ? (
          <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Temizle", language)} onPress={() => { setValue(""); inputRef.current?.focus(); }} hitSlop={8}>
            <MaterialCommunityIcons name="close-circle" size={18} color={colors.muted} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityLabel={translateCopy("Ara", language)}
          accessibilityRole="button"
          onPress={() => submitSearch()}
          style={{ alignItems: "center", backgroundColor: colors.primaryDark, borderRadius: 999, flexDirection: "row", gap: 5, height: 36, paddingHorizontal: 16 }}
        >
          <MaterialCommunityIcons name="magnify" size={17} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Ara", language)}</Text>
        </Pressable>
      </View>

      {hasSug ? (
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, left: 0, overflow: "hidden", position: "absolute", right: 0, shadowColor: "#101828", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.16, shadowRadius: 26, top: 52, zIndex: 1000 }}>
          {suggestions.cats.map((c) => (
            <Pressable key={`c-${c.labels.join(">")}`} onPress={() => submitSearch(c.labels[c.labels.length - 1])} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : "transparent", flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 10 })}>
              <MaterialCommunityIcons name="tag-outline" size={17} color={colors.primary} />
              <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>{c.labels[c.labels.length - 1]}</Text>
              <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700" }} numberOfLines={1}>{c.labels.join(" › ")}</Text>
            </Pressable>
          ))}
          {suggestions.cats.length > 0 && suggestions.products.length > 0 ? <View style={{ backgroundColor: colors.line, height: 1 }} /> : null}
          {suggestions.products.map((l) => (
            <Pressable key={`p-${l.id}`} onPress={() => { inputRef.current?.blur(); setFocused(false); router.push(`/listing/${l.id}`); }} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : "transparent", flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 8 })}>
              <View style={{ backgroundColor: colors.line, borderRadius: 8, height: 38, overflow: "hidden", width: 38 }}>
                <SafeRemoteImage uri={l.image} style={{ height: "100%", width: "100%" }} contentFit="cover" />
              </View>
              <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{displayText(l.title)}</Text>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{displayText(l.category)}</Text>
              </View>
              <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{moneyIn(l.price, l.currency)}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => submitSearch()} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : colors.surface, borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 })}>
            <MaterialCommunityIcons name="magnify" size={16} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "900" }}>“{q}” {translateCopy("için tüm sonuçlar", language)}</Text>
          </Pressable>
        </View>
      ) : null}

      {showRecents ? (
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, left: 0, overflow: "hidden", position: "absolute", right: 0, shadowColor: "#101828", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.16, shadowRadius: 26, top: 52, zIndex: 1000 }}>
          <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 9 }}>
            <MaterialCommunityIcons name="history" size={16} color={colors.muted} />
            <Text style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "800" }}>{translateCopy("Son aramalar", language)}</Text>
            <Pressable onPress={() => { clearRecentSearches(); setRecents([]); }} hitSlop={8}>
              <Text style={{ color: colors.primary, fontSize: 11.5, fontWeight: "800" }}>{translateCopy("Temizle", language)}</Text>
            </Pressable>
          </View>
          {recents.map((r) => (
            <Pressable key={`r-${r}`} onPress={() => submitSearch(r)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : "transparent", flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 10 })}>
              <MaterialCommunityIcons name="magnify" size={16} color={colors.subtle} />
              <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{r}</Text>
              <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Kaldır", language)} onPress={() => { removeRecentSearch(r); setRecents(getRecentSearches()); }} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={16} color={colors.muted} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}
