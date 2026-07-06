import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link, Stack } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";

export default function NotFoundScreen() {
  const { language } = useLanguage();
  return (
    <>
      <Stack.Screen options={{ title: translateCopy("Sayfa bulunamadı", language) }} />
      <ScrollView
        contentContainerStyle={{ alignItems: "center", backgroundColor: colors.background, flexGrow: 1, justifyContent: "center", padding: 24 }}
        style={{ backgroundColor: colors.background }}
      >
        <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, gap: 14, maxWidth: 440, padding: 30, width: "100%" }}>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 64, justifyContent: "center", width: 64 }}>
            <MaterialCommunityIcons name="compass-off-outline" size={32} color={colors.primaryDark} />
          </View>
          <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900", textAlign: "center" }}>{translateCopy("404 — Sayfa bulunamadı", language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20, textAlign: "center" }}>
            {translateCopy("Aradığın sayfa taşınmış veya hiç var olmamış olabilir. Aşağıdan keşfetmeye devam edebilirsin.", language)}
          </Text>
          <Link href="/" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 13, width: "100%" }}>
              <MaterialCommunityIcons name="home-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{translateCopy("Ana sayfaya dön", language)}</Text>
            </Pressable>
          </Link>
          <Link href="/(tabs)/explore" asChild>
            <Pressable style={{ alignItems: "center", paddingVertical: 4 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("İlanları keşfet →", language)}</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </>
  );
}
