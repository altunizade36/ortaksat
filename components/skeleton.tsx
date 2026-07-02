import { useEffect, useRef } from "react";
import { Animated, View, type ViewStyle } from "react-native";

import { colors } from "@/components/colors";

/** Yumuşak nabız (pulse) animasyonlu iskelet blok. */
export function Skeleton({ style }: { style?: ViewStyle }) {
  const pulse = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 720, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.5, duration: 720, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return <Animated.View style={[{ backgroundColor: colors.surfaceAlt, borderRadius: 8 }, style, { opacity: pulse }]} />;
}

/** Ürün kartı iskeleti (grid yüklenirken). */
export function SkeletonCard({ width }: { width: number }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 9, overflow: "hidden", padding: 10, width }}>
      <Skeleton style={{ borderRadius: 10, height: width * 0.72, width: "100%" }} />
      <Skeleton style={{ height: 12, width: "55%" }} />
      <Skeleton style={{ height: 15, width: "90%" }} />
      <Skeleton style={{ height: 18, width: "45%" }} />
      <Skeleton style={{ borderRadius: 999, height: 22, width: "60%" }} />
      <Skeleton style={{ borderRadius: 10, height: 36, marginTop: 2, width: "100%" }} />
    </View>
  );
}

/** N adet iskelet kartını sarılabilir grid olarak döşer. */
export function SkeletonGrid({ count, cardWidth, gap = 12 }: { count: number; cardWidth: number; gap?: number }) {
  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", gap }}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} width={cardWidth} />
      ))}
    </View>
  );
}
