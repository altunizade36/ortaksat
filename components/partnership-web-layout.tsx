import type { ReactNode } from "react";
import { ScrollView, Text, View, Pressable } from "react-native";
import { Stack, useRouter } from "expo-router";
import { WebFooter } from "@/components/web-landing";
import { colors } from "@/components/colors";
import { PAGE_MAX_WIDTH } from "@/components/web-container";
import { MaterialCommunityIcons as Icon } from "@/components/icons";

/** Desktop presentation; catalogue and account actions remain in the shared hub. */
export function PartnershipWebLayout({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <Stack.Screen options={{ headerShown: true }} />
    <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
      <View testID="partnership-web-layout" style={{ width: "100%", maxWidth: PAGE_MAX_WIDTH, alignSelf: "center", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 24, flex: 1 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 18, marginBottom: 12, backgroundColor: colors.primarySoft, borderColor: colors.line, borderWidth: 1, borderRadius: 14, paddingHorizontal: 18, paddingVertical: 14 }}>
          <View style={{ flex: 1, gap: 3, minWidth: 0 }}>
            <Text accessibilityRole="header" aria-level={1} style={{ color: colors.ink, fontSize: 25, lineHeight: 31, fontWeight: "900" }}>{title}</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, lineHeight: 19, maxWidth: 760 }}>İlanları keşfet, satıcıyla anlaş; tamamlanan satıştan komisyon kazan.</Text>
          </View>
          <Pressable accessibilityRole="link" accessibilityLabel="Satış ortaklığı nasıl çalışır?" onPress={() => router.push("/nasil-calisir")} style={({ pressed }) => ({ flexDirection: "row", gap: 7, alignItems: "center", minHeight: 40, paddingHorizontal: 14, borderWidth: 1, borderColor: colors.primary, borderRadius: 10, backgroundColor: pressed ? colors.primarySoft : colors.surface })}>
            <Icon name="help-circle-outline" size={18} color={colors.primaryDark}/><Text style={{ color: colors.primaryDark, fontWeight: "800", fontSize: 13 }}>Nasıl çalışır?</Text>
          </Pressable>
        </View>
        {children}
      </View>
      <WebFooter />
    </ScrollView>
  </View>;
}
