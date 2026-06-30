import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { colors } from "@/components/colors";

/**
 * Markalı hata ekranı. Hem expo-router ErrorBoundary fallback'i (render
 * sırasında bir hata fırlatılırsa) hem de manuel "bir şeyler ters gitti"
 * durumları için kullanılır. Kullanıcı asla boş beyaz ekran görmez.
 */
export function ErrorScreen({
  title = "Bir şeyler ters gitti",
  body = "Beklenmeyen bir hata oluştu. İnternet bağlantını kontrol edip tekrar deneyebilirsin.",
  detail,
  onRetry,
  retryLabel = "Tekrar dene"
}: {
  title?: string;
  body?: string;
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <ScrollView
      contentContainerStyle={{ alignItems: "center", backgroundColor: colors.background, flexGrow: 1, justifyContent: "center", padding: 24 }}
      style={{ backgroundColor: colors.background }}
    >
      <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 20, borderWidth: 1, gap: 14, maxWidth: 440, padding: 30, width: "100%" }}>
        <View style={{ alignItems: "center", backgroundColor: colors.accentSoft, borderRadius: 999, height: 64, justifyContent: "center", width: 64 }}>
          <MaterialCommunityIcons name="alert-circle-outline" size={32} color={colors.accent} />
        </View>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900", textAlign: "center" }}>{title}</Text>
        <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 20, textAlign: "center" }}>{body}</Text>
        {detail ? (
          <Text style={{ color: colors.subtle, fontSize: 11, fontWeight: "600", textAlign: "center" }} numberOfLines={3}>
            {detail}
          </Text>
        ) : null}
        {onRetry ? (
          <Pressable
            onPress={onRetry}
            style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 13, width: "100%" }}
          >
            <MaterialCommunityIcons name="refresh" size={18} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{retryLabel}</Text>
          </Pressable>
        ) : null}
        <Link href="/" asChild>
          <Pressable style={{ alignItems: "center", paddingVertical: 4 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>Ana sayfaya dön →</Text>
          </Pressable>
        </Link>
      </View>
    </ScrollView>
  );
}

/** expo-router bir route segmentinde render hatası yakalarsa bunu gösterir. */
export function RouteErrorBoundary({ error, retry }: { error: Error; retry: () => Promise<void> }) {
  return (
    <ErrorScreen
      detail={__DEV__ ? error?.message : undefined}
      onRetry={() => {
        void retry();
      }}
    />
  );
}
