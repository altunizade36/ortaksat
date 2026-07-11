import { Image } from "expo-image";
import { View, type ViewStyle } from "react-native";

import { colors } from "@/components/colors";
import { useIsWideWeb } from "@/lib/layout";
import { MASCOT_ALT, mascotSrc, type MascotName } from "@/lib/mascots";

// OrtakSat maskot bileşeni. Görseller şeffaf zeminli; turkuaz alanlarda `panel` ile
// açık bir daire arkalık gösterilir (kullanıcı isteği: maskot beyaz/#F0FDFF daire içinde).
// Masaüstünde 1024, mobilde 512 WebP yüklenir. Aynı ekranda birden çok BÜYÜK maskot gösterme.
export function Mascot({
  name,
  size = 240,
  priority = false,
  panel = false,
  panelColor,
  style
}: {
  name: MascotName;
  size?: number;
  priority?: boolean;
  panel?: boolean;
  panelColor?: string;
  style?: ViewStyle;
}) {
  const wide = useIsWideWeb();
  const img = (
    <Image
      source={{ uri: mascotSrc(name, wide) }}
      style={{ height: size, width: size }}
      contentFit="contain"
      priority={priority ? "high" : "normal"}
      cachePolicy="memory-disk"
      transition={priority ? 0 : { duration: 220, effect: "cross-dissolve" }}
      accessibilityLabel={MASCOT_ALT[name]}
      alt={MASCOT_ALT[name]}
    />
  );
  if (!panel) return <View style={[{ height: size, width: size }, style]}>{img}</View>;
  // Daire arkalık: maskot (tam gövde) önde, dairenin biraz dışına taşar — kırpılmaz.
  const disc = Math.round(size * 0.82);
  return (
    <View style={[{ alignItems: "center", height: size, justifyContent: "center", width: size }, style]}>
      <View
        style={{
          backgroundColor: panelColor ?? "#FFFFFF",
          borderRadius: 999,
          height: disc,
          position: "absolute",
          shadowColor: "#0B3A44",
          shadowOffset: { width: 0, height: 8 },
          shadowOpacity: 0.14,
          shadowRadius: 22,
          width: disc
        }}
      />
      {img}
    </View>
  );
}
