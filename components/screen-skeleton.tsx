import { ActivityIndicator, View } from "react-native";

import { colors } from "@/components/colors";

/**
 * Hidrasyon-gate iskeleti: SSG ve istemci-ilk render'ında aynı (deterministik)
 * çıktı verir; böylece auth/uygulama sayfalarında React #418 uyuşmazlığı olmaz.
 * useMounted() ile birlikte kullanılır.
 */
export function ScreenSkeleton() {
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.background, flex: 1, justifyContent: "center", minHeight: 360, paddingVertical: 80 }}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
