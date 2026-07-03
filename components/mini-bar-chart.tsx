import { Text, View } from "react-native";

import { colors } from "@/components/colors";

export type BarPoint = { label: string; value: number; sub?: string };

/**
 * Tek serili, zaman-serisi büyüklük grafiği (ör. son N gün talep).
 * Tek hue (marka yeşili) — efsane gerekmez; ince çubuk + yuvarlak uç + baseline.
 * dataviz: magnitude-over-time, sequential single-hue, recessive axis.
 */
export function MiniBarChart({
  data,
  height = 96,
  color = colors.primary,
  title,
  totalLabel
}: {
  data: BarPoint[];
  height?: number;
  color?: string;
  title?: string;
  totalLabel?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, gap: 10, padding: 14 }}>
      {title ? (
        <View style={{ alignItems: "flex-end", flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "900" }}>{title}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{totalLabel ?? `Toplam ${total}`}</Text>
        </View>
      ) : null}

      {/* Grafik alanı — baseline'a oturan çubuklar */}
      <View style={{ flexDirection: "row", gap: 2, height, alignItems: "flex-end" }}>
        {data.map((d, i) => {
          const h = d.value > 0 ? Math.max(3, Math.round((d.value / max) * (height - 16))) : 2;
          const peak = d.value === max && d.value > 0;
          return (
            <View key={i} style={{ alignItems: "center", flex: 1, gap: 3, justifyContent: "flex-end" }}>
              {peak ? <Text style={{ color: colors.primaryDark, fontSize: 9.5, fontWeight: "900" }}>{d.value}</Text> : null}
              <View
                accessibilityLabel={`${d.label}: ${d.value}`}
                style={{
                  backgroundColor: d.value > 0 ? color : colors.line,
                  borderTopLeftRadius: 4,
                  borderTopRightRadius: 4,
                  height: h,
                  opacity: d.value > 0 ? 1 : 0.5,
                  width: "100%"
                }}
              />
            </View>
          );
        })}
      </View>

      {/* Recessive eksen etiketleri (ilk / orta / son) */}
      <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
        <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: "700" }}>{data[0]?.label}</Text>
        <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: "700" }}>{data[Math.floor(data.length / 2)]?.label}</Text>
        <Text style={{ color: colors.subtle, fontSize: 10, fontWeight: "700" }}>{data[data.length - 1]?.label}</Text>
      </View>
    </View>
  );
}
