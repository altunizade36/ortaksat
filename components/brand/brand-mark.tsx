import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import { Animated, View } from "react-native";

// Ekranda 36-56px → 128px WebP (7kB); büyük PNG her sayfada inmesin.
const brandHead = require("../../assets/brand-head.webp");

// Header marka ikonu: OrtakSat LOGOSU (turkuaz halka + tokalaşma), hafif salınımla.
// Şeffaf zeminli — header'ın beyaz zeminine temiz oturur. 36–56px kullan.
// NOT: Maskot (kedi) ayrı bir sistemdir → components/brand/Mascot + lib/mascots.ts.
export function BrandMark({ size = 40 }: { size?: number }) {
  const float = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { duration: 1900, toValue: 1, useNativeDriver: true }),
        Animated.timing(float, { duration: 1900, toValue: 0, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);
  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -2.5] });
  return (
    <View style={{ alignItems: "center", height: size, justifyContent: "center", width: size }}>
      <Animated.View style={{ transform: [{ translateY }] }}>
        <Image
          source={brandHead}
          contentFit="contain"
          style={{ height: size, width: size }}
          accessibilityLabel="OrtakSat logosu"
          alt="OrtakSat logosu"
        />
      </Animated.View>
    </View>
  );
}
