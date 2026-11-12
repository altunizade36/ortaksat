import { Pressable, Text, View } from "react-native";
import { colors } from "./colors";
import { translateCopy, useLanguage } from "@/lib/i18n";

export function RetryNotice({ message, onRetry, busy = false }: { message: string; onRetry: () => void; busy?: boolean }) {
  const { language } = useLanguage();
  return <View style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderWidth: 1, borderRadius: 12, padding: 14, gap: 10, minWidth: 0 }}>
    <Text accessibilityRole="alert" style={{ color: colors.ink, fontSize: 13, lineHeight: 20 }}>{translateCopy(message, language)}</Text>
    <Pressable accessibilityRole="button" disabled={busy} onPress={onRetry} style={{ alignSelf: "flex-start", minHeight: 44, justifyContent: "center", borderRadius: 8, backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, opacity: busy ? .6 : 1 }}>
      <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "700" }}>{translateCopy(busy ? "Yükleniyor…" : "Tekrar Dene", language)}</Text>
    </Pressable>
  </View>;
}
