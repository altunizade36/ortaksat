import { MaterialCommunityIcons } from "@/components/icons";
import { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";

import { colors } from "./colors";
import { translateCopy, useLanguage } from "@/lib/i18n";

const LABELS: Record<number, string> = {
  1: "Çok kötü",
  2: "Kötü",
  3: "Orta",
  4: "İyi",
  5: "Mükemmel"
};

/**
 * 1–5 yıldız puanlama girişi. Tüm platformlarda (web + native) aynı çalışır.
 * ÖNEMLİ: Eski kod yalnız 3-4-5 sunuyordu → 1-2 yıldız verilemiyor, tüm puanlar
 * yapay şişiyordu. Bu bileşen gerçek 1-5 aralığını sunar ve aralık dışına ÇIKAMAZ.
 *
 * Fare: üzerine gelince önizleme, tıkla. Dokunmatik: her yıldız en az 40×40 hedef.
 * Klavye (web): Tab ile odaklan, ←/→ (veya ↓/↑) ile azalt/artır, 1–5 tuşlarıyla doğrudan
 * seç, Home/End ile 1/5. Ekran okuyucu: radiogroup + radio (seçili yıldız "checked").
 */
export function StarRatingInput({
  value,
  onChange,
  size = 34,
  showLabel = true,
  disabled = false,
  align = "flex-start"
}: {
  value: number;
  onChange: (rating: number) => void;
  size?: number;
  showLabel?: boolean;
  disabled?: boolean;
  align?: "flex-start" | "center";
}) {
  const { language } = useLanguage();
  const [hover, setHover] = useState(0);
  const current = Number.isFinite(value) ? Math.min(5, Math.max(0, Math.round(value))) : 0;
  const active = disabled ? current : hover || current;
  const target = Math.max(40, size + 6);
  const set = (next: number) => { if (!disabled) onChange(Math.min(5, Math.max(1, Math.round(next)))); };

  // Web klavye desteği. RN-web View klavye olaylarını DOM'a iletir; native'de bu prop yok sayılır.
  const keyboard = Platform.OS === "web" && !disabled ? {
    onKeyDown: (event: { key?: string; preventDefault?: () => void; currentTarget?: unknown }) => {
      const key = event.key ?? "";
      let next = 0;
      if (key === "ArrowRight" || key === "ArrowUp") next = Math.min(5, current + 1);
      else if (key === "ArrowLeft" || key === "ArrowDown") next = Math.max(1, current - 1);
      else if (key === "Home") next = 1;
      else if (key === "End") next = 5;
      else if (/^[1-5]$/.test(key)) next = Number(key);
      if (!next) return;
      event.preventDefault?.();
      set(next);
      // Odak seçilen yıldıza taşınsın (radiogroup beklentisi).
      try {
        const root = event.currentTarget as { querySelectorAll?: (q: string) => ArrayLike<{ focus?: () => void }> } | undefined;
        root?.querySelectorAll?.('[role="radio"]')[next - 1]?.focus?.();
      } catch { /* odak taşınamadıysa değer yine de değişti */ }
    }
  } : null;

  return (
    <View style={{ alignItems: align, gap: 4 }}>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel={translateCopy("Puan", language)}
        style={{ alignItems: "center", flexDirection: "row" }}
        {...(keyboard as object | null)}
      >
        {[1, 2, 3, 4, 5].map((star) => (
          <Pressable
            key={star}
            accessibilityRole="radio"
            accessibilityLabel={`${star} yıldız`}
            accessibilityState={{ checked: star === current, disabled }}
            aria-checked={star === current}
            disabled={disabled}
            onPress={() => set(star)}
            onHoverIn={() => setHover(star)}
            onHoverOut={() => setHover(0)}
            style={({ pressed }) => ({ alignItems: "center", height: target, justifyContent: "center", opacity: disabled ? 0.5 : pressed ? 0.6 : 1, width: target })}
          >
            <MaterialCommunityIcons
              name={star <= active ? "star" : "star-outline"}
              size={size}
              color={star <= active ? colors.gold : colors.subtle}
            />
          </Pressable>
        ))}
      </View>
      {showLabel ? (
        <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
          {current ? `${current}/5 · ${translateCopy(LABELS[current], language)}` : translateCopy("Puan vermek için yıldıza dokun", language)}
        </Text>
      ) : null}
    </View>
  );
}
