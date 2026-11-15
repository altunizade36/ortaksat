import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { listingStrength } from "@/lib/listing-strength";
import type { Listing } from "@/lib/types";

/**
 * İlan gücü kartı (satıcıya, kendi ilanında): yüzde + düzey + en çok kazandıran iki öneri.
 * Puanın nasıl hesaplandığı lib/listing-strength.ts içinde. Renk: yalnız marka mavisi tonları (yeşil/kırmızı yok —
 * puan bir "hata" değil, yönlendirmedir).
 */
export function ListingStrengthCard({ listing, onImprove }: { listing: Listing; onImprove?: () => void }) {
  const strength = useMemo(() => listingStrength(listing), [listing]);
  const top = strength.tips.slice(0, 2);
  return (
    <View testID="listing-strength" style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 10, borderWidth: 1, gap: 7, paddingHorizontal: 10, paddingVertical: 9 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="chart-line" size={15} color={colors.primaryDark} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 12, fontWeight: "800" }}>İlan gücü</Text>
        <Text style={{ color: colors.primaryDark, fontSize: 12, fontVariant: ["tabular-nums"], fontWeight: "900" }}>%{strength.score} · {strength.level}</Text>
      </View>
      <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: strength.score }} style={{ backgroundColor: colors.line, borderRadius: 999, height: 6, overflow: "hidden" }}>
        <View style={{ backgroundColor: colors.primary, borderRadius: 999, height: 6, width: `${Math.max(4, strength.score)}%` }} />
      </View>
      {top.length === 0 ? (
        <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600" }}>İlanın eksiksiz görünüyor.</Text>
      ) : (
        <View style={{ gap: 4 }}>
          {top.map((tip) => (
            <View key={tip.key} style={{ alignItems: "flex-start", flexDirection: "row", gap: 6 }}>
              <Text style={{ color: colors.primary, fontSize: 11, fontVariant: ["tabular-nums"], fontWeight: "900", minWidth: 30 }}>+{tip.points}</Text>
              <Text style={{ color: colors.ink, flex: 1, fontSize: 11.5, fontWeight: "600", lineHeight: 16 }}>{tip.text}</Text>
            </View>
          ))}
          {onImprove ? (
            <Pressable accessibilityRole="button" accessibilityLabel="İlanı güçlendir" hitSlop={6} onPress={onImprove} style={{ alignItems: "center", alignSelf: "flex-start", flexDirection: "row", gap: 4, minHeight: 30 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>İlanı güçlendir</Text>
              <MaterialCommunityIcons name="arrow-right" size={14} color={colors.primaryDark} />
            </Pressable>
          ) : null}
        </View>
      )}
    </View>
  );
}
