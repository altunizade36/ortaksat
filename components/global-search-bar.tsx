import { displayListingTitle } from "@/lib/listing-title";
import { MaterialCommunityIcons } from "@/components/icons";
import { useGlobalSearchParams, useRouter } from "expo-router";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Platform, Pressable, ScrollView, Text, TextInput, View, type ViewProps, type TextInputInstance } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { suggestCategories } from "@/lib/category-tree";
import { moneyIn } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { searchAndRank } from "@/lib/search";
import { metaTrack } from "@/lib/meta-pixel";
import { clearRecentSearches, getRecentSearches, pushRecentSearch, removeRecentSearch } from "@/lib/recent-searches";
import { displayText } from "@/lib/text";
import { useStore } from "@/lib/use-store";

export function GlobalSearchBar() {
  const router = useRouter();
  // This header lives above the nested tab routes; local params belong to its parent.
  const params = useGlobalSearchParams<{ q?: string | string[] }>();
  const routeQuery = (Array.isArray(params.q) ? params.q[0] ?? "" : params.q ?? "").slice(0, 120);
  const { language, t } = useLanguage();
  const { listings } = useStore();
  // Static HTML has no per-visitor query; synchronize after hydration.
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const inputRef = useRef<TextInputInstance>(null);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const suggestionId = useId();
  // RN Web forwards this standard ARIA role; the shared native Role union omits listbox.
  useEffect(() => () => { if (blurTimer.current) clearTimeout(blurTimer.current); }, []);

  useEffect(() => {
    setValue(routeQuery);
    setActiveIndex(-1);
  }, [routeQuery]);

  const q = value.trim();
  const suggestions = useMemo(() => {
    if (q.length < 2) return { cats: [] as ReturnType<typeof suggestCategories>, products: [] as typeof listings };
    // Yazım-hata toleranslı + alaka sıralı öneriler (fuzzy).
    const products = searchAndRank(listings.filter((l) => l.status === "active"), q).slice(0, 6);
    return { cats: suggestCategories(q, 4), products };
  }, [q, listings]);

  const hasSug = focused && q.length >= 2;
  // Boş/kısa sorguda ve odaktayken son aramaları göster (hızlı tekrar).
  const showRecents = focused && q.length < 2 && recents.length > 0;

  const entries = hasSug
    ? [...suggestions.cats.map(c => ({ label: c.labels[c.labels.length - 1], run: () => submitSearch(c.labels[c.labels.length - 1]) })), ...suggestions.products.map(l => ({ label: displayListingTitle(l.title), run: () => openListing(l.id) })), { label: q, run: () => submitSearch() }]
    : showRecents ? recents.map(r => ({ label: r, run: () => submitSearch(r) })) : [];

  useEffect(() => {
    if (Platform.OS === "web" && activeIndex >= 0) {
      document.getElementById(`${suggestionId}-${activeIndex}`)?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex, suggestionId]);

  function closeSuggestions() { setFocused(false); setActiveIndex(-1); }
  function openListing(id: string) {
    inputRef.current?.blur(); closeSuggestions(); router.push(`/listing/${id}`);
  }
  function submitSearch(query?: string) {
    const finalQ = (query ?? value).replace(/\s+/g, " ").trim().slice(0, 120);
    if (finalQ.length >= 2) {
      pushRecentSearch(finalQ);
      // Meta Pixel: arama = niyet sinyali (Search). fbq yoksa no-op.
      metaTrack("Search", { search_string: finalQ });
    }
    inputRef.current?.blur();
    closeSuggestions();
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
          onChangeText={text => { setValue(text); setActiveIndex(-1); setFocused(true); }}
          maxLength={120}
          onFocus={() => { if (blurTimer.current) clearTimeout(blurTimer.current); setRecents(getRecentSearches()); setFocused(true); }}
          onBlur={() => { blurTimer.current = setTimeout(closeSuggestions, 180); }}
          onKeyPress={event => {
            if (Platform.OS !== "web") return;
            const key = event.nativeEvent.key;
            if (key === "Escape") { event.preventDefault(); closeSuggestions(); }
            if ((key === "ArrowDown" || key === "ArrowUp") && entries.length) {
              event.preventDefault();
              setActiveIndex(i => key === "ArrowDown" ? (i + 1) % entries.length : (i <= 0 ? entries.length - 1 : i - 1));
            }
          }}
          {...(Platform.OS === "web" ? {
            role: "combobox" as const,
            "aria-autocomplete": "list" as const,
            "aria-expanded": entries.length > 0,
            "aria-controls": entries.length ? suggestionId : undefined,
            "aria-activedescendant": activeIndex >= 0 && entries[activeIndex] ? `${suggestionId}-${activeIndex}` : undefined,
          } : {})}
          onSubmitEditing={() => { if (activeIndex >= 0 && entries[activeIndex]) entries[activeIndex].run(); else submitSearch(); }}
          blurOnSubmit
          accessibilityLabel={t("searchPlaceholder")}
          placeholder={t("searchPlaceholder")}
          placeholderTextColor={colors.muted}
          returnKeyType="search"
          submitBehavior="submit"
          style={{ color: colors.ink, flex: 1, fontSize: 15, fontWeight: "700", height: 40, minWidth: 0, paddingVertical: 0 }}
        />
        {value ? (
          <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Temizle", language)} onPress={() => { setValue(""); setActiveIndex(-1); inputRef.current?.focus(); }} hitSlop={8}>
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
        <View nativeID={suggestionId} role={"listbox" as ViewProps["role"]} accessibilityLabel={translateCopy("Arama önerileri", language)} style={{ maxHeight: 440, backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, left: 0, overflow: "hidden", position: "absolute", right: 0, shadowColor: "#101828", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.16, shadowRadius: 26, top: 52, zIndex: 1000 }}><ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 440 }}>
          {!suggestions.cats.length && !suggestions.products.length ? <Text style={{ color: colors.muted, fontSize: 13, padding: 14 }}>{translateCopy("Önerilerde eşleşme yok. Tüm ilanlarda arayabilirsin.", language)}</Text> : null}
          {suggestions.cats.map((c, index) => (
            <Pressable nativeID={`${suggestionId}-${index}`} role="option" aria-selected={activeIndex === index} key={`c-${c.labels.join(">")}`} onPress={() => submitSearch(c.labels[c.labels.length - 1])} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed || activeIndex === index ? colors.surfaceAlt : "transparent", flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 10 })}>
              <MaterialCommunityIcons name="tag-outline" size={17} color={colors.primary} />
              <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }} numberOfLines={1}>{c.labels[c.labels.length - 1]}</Text>
              <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "700", maxWidth: "50%", flexShrink: 1 }} numberOfLines={1}>{c.labels.join(" › ")}</Text>
            </Pressable>
          ))}
          {suggestions.cats.length > 0 && suggestions.products.length > 0 ? <View style={{ backgroundColor: colors.line, height: 1 }} /> : null}
          {suggestions.products.map((l, productIndex) => { const index = suggestions.cats.length + productIndex; return (
            <Pressable nativeID={`${suggestionId}-${index}`} role="option" aria-selected={activeIndex === index} key={`p-${l.id}`} onPress={() => openListing(l.id)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed || activeIndex === index ? colors.surfaceAlt : "transparent", flexDirection: "row", gap: 10, paddingHorizontal: 12, paddingVertical: 8 })}>
              <View style={{ backgroundColor: colors.line, borderRadius: 8, height: 38, overflow: "hidden", width: 38 }}>
                <SafeRemoteImage uri={l.image} style={{ height: "100%", width: "100%" }} contentFit="cover" />
              </View>
              <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{displayListingTitle(l.title)}</Text>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{displayText(l.category)}</Text>
              </View>
              <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>{moneyIn(l.price, l.currency)}</Text>
            </Pressable>
          ); })}
          <Pressable nativeID={`${suggestionId}-${entries.length - 1}`} role="option" aria-selected={activeIndex === entries.length - 1} onPress={() => submitSearch()} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed || activeIndex === entries.length - 1 ? colors.surfaceAlt : colors.surface, borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 })}>
            <MaterialCommunityIcons name="magnify" size={16} color={colors.primaryDark} />
            <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "900" }}>“{q}” {translateCopy("için tüm sonuçlar", language)}</Text>
          </Pressable>
        </ScrollView></View>
      ) : null}

      {showRecents ? (
        <View nativeID={suggestionId} role={"listbox" as ViewProps["role"]} accessibilityLabel={translateCopy("Arama önerileri", language)} style={{ maxHeight: 440, backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, left: 0, overflow: "hidden", position: "absolute", right: 0, shadowColor: "#101828", shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.16, shadowRadius: 26, top: 52, zIndex: 1000 }}><ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 440 }}>
          <View style={{ alignItems: "center", borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 8, paddingHorizontal: 14, paddingVertical: 9 }}>
            <MaterialCommunityIcons name="history" size={16} color={colors.muted} />
            <Text style={{ color: colors.muted, flex: 1, fontSize: 12, fontWeight: "800" }}>{translateCopy("Son aramalar", language)}</Text>
            <Pressable onPress={() => { clearRecentSearches(); setRecents([]); setActiveIndex(-1); }} hitSlop={8}>
              <Text style={{ color: colors.primary, fontSize: 11.5, fontWeight: "800" }}>{translateCopy("Temizle", language)}</Text>
            </Pressable>
          </View>
          {recents.map((r, index) => (
            <View key={`r-${r}`} style={{ flexDirection: "row", alignItems: "center" }}><Pressable nativeID={`${suggestionId}-${index}`} role="option" aria-selected={activeIndex === index} onPress={() => submitSearch(r)} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed || activeIndex === index ? colors.surfaceAlt : "transparent", flexDirection: "row", gap: 10, flex: 1, minWidth: 0, paddingHorizontal: 14, paddingVertical: 10 })}>
              <MaterialCommunityIcons name="magnify" size={16} color={colors.subtle} />
              <Text numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{r}</Text>
            </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`${r} — ${translateCopy("Kaldır", language)}`} onPress={() => { removeRecentSearch(r); setRecents(getRecentSearches()); setActiveIndex(-1); inputRef.current?.focus(); }} style={{ minWidth: 44, minHeight: 44, alignItems: "center", justifyContent: "center" }}>
                <MaterialCommunityIcons name="close" size={16} color={colors.muted} />
              </Pressable>
            </View>
          ))}
        </ScrollView></View>
      ) : null}
    </View>
  );
}
