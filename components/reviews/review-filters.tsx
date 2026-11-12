import { ActivityIndicator, Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { MaterialCommunityIcons } from "@/components/icons";
import { translateCopy } from "@/lib/i18n";
import type { RatingStats, ReviewSort } from "@/lib/reviews";

function Chip({ label, selected, onPress, star }: { label: string; selected: boolean; onPress: () => void; star?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={star ? `${label} yıldız` : label}
      accessibilityState={{ selected }}
      style={({ pressed }) => ({
        alignItems: "center",
        backgroundColor: selected ? colors.primary : colors.surfaceAlt,
        borderColor: selected ? colors.primary : colors.line,
        borderRadius: 999,
        borderWidth: 1,
        flexDirection: "row",
        gap: 3,
        justifyContent: "center",
        minHeight: 40,
        minWidth: 44,
        opacity: pressed ? 0.8 : 1,
        paddingHorizontal: 13
      })}
    >
      <Text style={{ color: selected ? "#FFFFFF" : colors.muted, fontSize: 12.5, fontWeight: "800" }}>{label}</Text>
      {star ? <MaterialCommunityIcons name="star" size={13} color={selected ? "#FFFFFF" : colors.gold} /> : null}
    </Pressable>
  );
}

/** Sıralama: En yeni / En faydalı / En yüksek puan / En düşük puan. */
export function ReviewSortBar({ value, onChange, language = "tr" }: { value: ReviewSort; onChange: (v: ReviewSort) => void; language?: "tr" | "en" }) {
  const options: Array<{ key: ReviewSort; label: string }> = [
    { key: "recent", label: translateCopy("En yeni", language) },
    { key: "helpful", label: translateCopy("En faydalı", language) },
    { key: "high", label: translateCopy("En yüksek puan", language) },
    { key: "low", label: translateCopy("En düşük puan", language) }
  ];
  return (
    <View accessibilityLabel={translateCopy("Yorumları sırala", language)} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      {options.map((o) => <Chip key={o.key} label={o.label} selected={value === o.key} onPress={() => onChange(o.key)} />)}
    </View>
  );
}

/**
 * Sayfalı yorum listesinin altı: "Daha fazla değerlendirme göster" (sıradaki sayfayı EKLER),
 * yükleniyor durumu ve başarısız istek için "Tekrar dene". Gösterecek bir şey yoksa hiç çizilmez.
 */
export function ReviewLoadMore({ hasMore, loading, error, onLoadMore, onRetry, language = "tr" }: {
  hasMore: boolean;
  /** İlk sayfa ya da sıradaki sayfa yükleniyor. */
  loading: boolean;
  error: boolean;
  onLoadMore: () => void;
  /** Başarısız isteği yinele (verilmezse onLoadMore). */
  onRetry?: () => void;
  language?: "tr" | "en";
}) {
  if (loading) {
    return (
      <View testID="reviews-loading" accessibilityRole="progressbar" accessibilityLabel={translateCopy("Değerlendirmeler yükleniyor…", language)} style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center", minHeight: 44 }}>
        <ActivityIndicator size="small" color={colors.primary} />
        <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "700" }}>{translateCopy("Değerlendirmeler yükleniyor…", language)}</Text>
      </View>
    );
  }
  if (!error && !hasMore) return null;
  const label = translateCopy(error ? "Tekrar dene" : "Daha fazla değerlendirme göster", language);
  return (
    <View style={{ alignItems: "center", gap: 8 }}>
      {error ? <Text accessibilityRole="alert" style={{ color: colors.accent, fontSize: 12.5, fontWeight: "700", textAlign: "center" }}>{translateCopy("Değerlendirmeler yüklenemedi.", language)}</Text> : null}
      <Pressable
        testID={error ? "reviews-retry" : "reviews-load-more"}
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={error ? onRetry ?? onLoadMore : onLoadMore}
        style={({ pressed }) => ({ alignItems: "center", alignSelf: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 6, justifyContent: "center", minHeight: 44, opacity: pressed ? 0.8 : 1, paddingHorizontal: 18 })}
      >
        <MaterialCommunityIcons name={error ? "refresh" : "chevron-down"} size={17} color={colors.primaryDark} />
        <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{label}</Text>
      </Pressable>
    </View>
  );
}

/** Yıldıza göre süzme: Tümü / 5★ … 1★. Hiç yorumu olmayan yıldızlar gösterilmez. */
export function ReviewStarFilter({ value, onChange, stats, language = "tr" }: { value: number; onChange: (star: number) => void; stats?: RatingStats | null; language?: "tr" | "en" }) {
  const stars = [5, 4, 3, 2, 1].filter((star) => !stats || stats.dist[star - 1] > 0 || star === value);
  if (stars.length < 2 && !value) return null;
  return (
    <View accessibilityLabel={translateCopy("Puana göre süz", language)} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
      <Chip label={translateCopy("Tümü", language)} selected={!value} onPress={() => onChange(0)} />
      {stars.map((star) => <Chip key={star} star label={String(star)} selected={value === star} onPress={() => onChange(value === star ? 0 : star)} />)}
    </View>
  );
}
