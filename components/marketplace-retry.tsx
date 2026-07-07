import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";

/**
 * İlk katalog yüklemesi başarısız olduğunda (ağ/sunucu) boş sayfa yerine gösterilen
 * "yeniden dene" durumu. onRetry genelde store.retryMarketplace'tir.
 */
export function MarketplaceRetry({ onRetry }: { onRetry: () => Promise<void> | void }) {
  const { language } = useLanguage();
  const [busy, setBusy] = useState(false);

  async function handle() {
    if (busy) return;
    setBusy(true);
    try { await onRetry(); } finally { setBusy(false); }
  }

  return (
    <View style={{ alignItems: "center", alignSelf: "center", gap: 12, maxWidth: 420, paddingHorizontal: 20, paddingVertical: 40, width: "100%" }}>
      <View style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 999, height: 64, justifyContent: "center", width: 64 }}>
        <MaterialCommunityIcons name="wifi-off" size={30} color={colors.muted} />
      </View>
      <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900", textAlign: "center" }}>
        {translateCopy("İlanlar yüklenemedi", language)}
      </Text>
      <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 19, textAlign: "center" }}>
        {translateCopy("Bağlantında geçici bir sorun olabilir. Lütfen yeniden dene.", language)}
      </Text>
      <Pressable
        onPress={() => void handle()}
        accessibilityRole="button"
        accessibilityLabel={translateCopy("Yeniden dene", language)}
        disabled={busy}
        style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, opacity: pressed || busy ? 0.8 : 1, paddingHorizontal: 22, paddingVertical: 12 })}
      >
        <MaterialCommunityIcons name={busy ? "loading" : "refresh"} size={17} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{translateCopy(busy ? "Yükleniyor…" : "Yeniden dene", language)}</Text>
      </Pressable>
    </View>
  );
}
