import { Image } from "expo-image";
import { Text, View } from "react-native";

import { colors } from "@/components/colors";
import { Brand3DMark } from "@/components/three-d-showcase";
import { useLanguage } from "@/lib/i18n";

const mascot = require("../assets/mascot.png");

export function BrandHeader() {
  const { t } = useLanguage();

  return (
    <View
      style={{
        alignItems: "center",
        backgroundColor: colors.surface,
        borderColor: colors.line,
        borderRadius: 8,
        borderWidth: 1,
        flexDirection: "row",
        gap: 12,
        minHeight: 92,
        overflow: "hidden",
        padding: 12,
        paddingRight: 92
      }}
    >
      <Brand3DMark size={58} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text selectable style={{ color: colors.ink, fontSize: 28, fontWeight: "900", letterSpacing: 0, lineHeight: 32 }}>
          ortaksat
        </Text>
        <Text selectable numberOfLines={2} style={{ color: colors.muted, fontSize: 13, fontWeight: "700", lineHeight: 18 }}>
          {t("appSlogan")}
        </Text>
      </View>
      <View
        style={{
          bottom: -15,
          opacity: 0.12,
          position: "absolute",
          right: -8
        }}
      >
        <Image source={mascot} contentFit="contain" style={{ height: 118, width: 118 }} />
      </View>
    </View>
  );
}
