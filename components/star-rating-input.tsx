import { MaterialCommunityIcons } from "@/components/icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "./colors";

const LABELS: Record<number, string> = {
  1: "Çok kötü",
  2: "Kötü",
  3: "Orta",
  4: "İyi",
  5: "Mükemmel"
};

/**
 * 1–5 dokunmatik yıldız puanlama girişi. Tüm platformlarda (web + native) aynı çalışır.
 * ÖNEMLİ: Eski kod yalnız 3-4-5 sunuyordu → 1-2 yıldız verilemiyor, tüm puanlar
 * yapay şişiyordu. Bu bileşen gerçek 1-5 aralığını dokunmatik yıldızla sunar.
 */
export function StarRatingInput({
  value,
  onChange,
  size = 34,
  showLabel = true
}: {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
  showLabel?: boolean;
}) {
  const [hover, setHover] = useState(0);
  const active = hover || value;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 2 }}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            accessibilityRole="button"
            accessibilityLabel={`${star} yıldız`}
            onPress={() => onChange(star)}
            onHoverIn={() => setHover(star)}
            onHoverOut={() => setHover(0)}
            hitSlop={6}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: 3 })}
          >
            <MaterialCommunityIcons
              name={star <= active ? "star" : "star-outline"}
              size={size}
              color={star <= active ? colors.gold : colors.line}
            />
          </Pressable>
        ))}
      </View>
      {showLabel ? (
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
          {value ? `${value}/5 · ${LABELS[value]}` : "Puan vermek için yıldıza dokun"}
        </Text>
      ) : null}
    </View>
  );
}
