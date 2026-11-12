import { Text, View } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { translateCopy } from "@/lib/i18n";
import type { RatingStats } from "@/lib/reviews";

/**
 * Değerlendirme özeti — ortalama + yıldızlar + adet + 5★→1★ dağılım barları.
 *
 * TEK kaynak: ilan detayı, mağaza, ortak vitrini ve native aynı bileşeni kullanır.
 * Ortalama ve adet HER ZAMAN `stats`'tan (yani gösterilen/sayılan yorumlardan) gelir;
 * profildeki saklı `rating` alanı buraya verilmez — yoksa "4.8 · 0 yorum" gibi listeyle
 * çelişen bir özet çıkabiliyordu.
 */
export function RatingSummary({ stats, language = "tr" }: { stats: RatingStats; language?: "tr" | "en" }) {
  if (!stats.count) return null;
  const rounded = Math.round(stats.average);
  return (
    <View
      accessibilityLabel={`${translateCopy("Ortalama puan", language)} ${stats.average.toFixed(1)} / 5, ${stats.count} ${translateCopy("değerlendirme", language)}`}
      style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexDirection: "row", gap: 10, padding: 14 }}
    >
      <View style={{ alignItems: "center", justifyContent: "center", width: 98 }}>
        <Text style={{ color: colors.ink, fontSize: 34, fontWeight: "900", lineHeight: 40 }}>{stats.average.toFixed(1)}</Text>
        <View style={{ flexDirection: "row", gap: 1 }}>
          {[1, 2, 3, 4, 5].map((n) => (
            <MaterialCommunityIcons key={n} name={n <= rounded ? "star" : "star-outline"} size={14} color={colors.gold} />
          ))}
        </View>
        <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700", marginTop: 3 }}>
          {stats.count} {translateCopy("değerlendirme", language)}
        </Text>
      </View>
      <View style={{ flex: 1, gap: 5, justifyContent: "center", minWidth: 0 }}>
        {[5, 4, 3, 2, 1].map((star) => {
          const count = stats.dist[star - 1];
          const pct = Math.round((count / stats.count) * 100);
          return (
            <View key={star} style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
              <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "800", textAlign: "center", width: 10 }}>{star}</Text>
              <MaterialCommunityIcons name="star" size={12} color={colors.gold} />
              <View style={{ backgroundColor: colors.line, borderRadius: 999, flex: 1, height: 8, minWidth: 0, overflow: "hidden" }}>
                <View style={{ backgroundColor: colors.gold, borderRadius: 999, height: 8, width: `${pct}%` }} />
              </View>
              <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700", textAlign: "right", width: 30 }}>{count}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}
