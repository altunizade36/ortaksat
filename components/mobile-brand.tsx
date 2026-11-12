import { Text, View } from "react-native";
import { BrandMark } from "@/components/brand/brand-mark";

export function MobileBrand({ size = 36 }: { size?: number }) {
  return (
    <View accessibilityLabel="OrtakSat" style={{ flexDirection: "row", alignItems: "center" }}>
      <BrandMark size={size * 1.25} />
      <Text style={{ color: "#10192C", fontSize: size, fontWeight: "900", letterSpacing: -1.6, marginLeft: 1 }}>
        rtak<Text style={{ color: "#0645C9" }}>Sat</Text>
      </Text>
    </View>
  );
}
