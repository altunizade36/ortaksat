import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Pressable, TextInput, View } from "react-native";

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
        backgroundColor: colors.surface,
        borderColor: colors.primary,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: "row",
        gap: 8,
        height: 40,
        paddingLeft: 13,
        paddingRight: 14,
        shadowColor: "#101828",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 9,
        minWidth: 0,
        width: "100%"
      }}
    >
      <Pressable accessibilityLabel={translateCopy("Ara", language)} accessibilityRole="button" hitSlop={8} onPress={submitSearch}>
        <MaterialCommunityIcons name="magnify" size={21} color={colors.primary} />
      </Pressable>
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
          height: 36,
          paddingVertical: 0
        }}
      />
    </Pressable>
  );
}
