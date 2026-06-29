import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";

export function GlobalSearchBar() {
  const router = useRouter();
  const params = useLocalSearchParams<{ q?: string }>();
  const { language, t } = useLanguage();
  const [value, setValue] = useState(params.q ?? "");
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    setValue(params.q ?? "");
  }, [params.q]);

  function submitSearch() {
    const query = value.trim();
    inputRef.current?.blur();
    router.push({ pathname: "/(tabs)/explore", params: query ? { q: query } : undefined });
  }

  return (
    <Pressable
      accessibilityRole="search"
      onPress={() => inputRef.current?.focus()}
      style={{
        alignItems: "center",
        backgroundColor: colors.surfaceAlt,
        borderColor: colors.line,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: "row",
        gap: 10,
        height: 46,
        paddingLeft: 16,
        paddingRight: 6,
        minWidth: 0,
        width: "100%"
      }}
    >
      <MaterialCommunityIcons name="magnify" size={21} color={colors.muted} />
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={setValue}
        onSubmitEditing={submitSearch}
        blurOnSubmit
        placeholder={t("searchPlaceholder")}
        placeholderTextColor={colors.muted}
        returnKeyType="search"
        submitBehavior="submit"
        style={{
          color: colors.ink,
          flex: 1,
          fontSize: 15,
          fontWeight: "700",
          height: 40,
          paddingVertical: 0
        }}
      />
      <Pressable
        accessibilityLabel={translateCopy("Ara", language)}
        accessibilityRole="button"
        onPress={submitSearch}
        style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, flexDirection: "row", gap: 5, height: 36, paddingHorizontal: 16 }}
      >
        <MaterialCommunityIcons name="magnify" size={17} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Ara", language)}</Text>
      </Pressable>
    </Pressable>
  );
}
