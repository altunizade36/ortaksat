import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Text, View } from "react-native";

import { colors } from "@/components/colors";
import { money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import type { Sale } from "@/lib/types";

// Satış-temelli ortak seviyeleri (motivasyon). "Başarılı satış" = en az onaylanan
// (approved/seller_paid/paid) komisyon. Her seviye bir sonrakine ilerleme çubuğu gösterir.
const TIERS: Array<{ key: string; label: string; min: number; icon: keyof typeof MaterialCommunityIcons.glyphMap; color: string; tint: string }> = [
  { key: "start", label: "Başlangıç", min: 0, icon: "sprout-outline", color: colors.muted, tint: colors.surfaceAlt },
  { key: "bronze", label: "Bronz Ortak", min: 1, icon: "medal-outline", color: "#A9631B", tint: "#F6E9DA" },
  { key: "silver", label: "Gümüş Ortak", min: 5, icon: "medal", color: "#6B7280", tint: "#EEF1F5" },
  { key: "gold", label: "Altın Ortak", min: 20, icon: "trophy-outline", color: "#B7791F", tint: colors.goldSoft },
  { key: "diamond", label: "Elmas Ortak", min: 50, icon: "diamond-stone", color: "#2563C9", tint: "#E4EDFB" }
];

const CONFIRMED: Sale["status"][] = ["approved", "seller_paid", "paid"];

// Onaylı satış SAYISINDAN seviye (Sale[] elde olmayan herkese-açık yüzeyler için, ör. ortak vitrini).
export function tierFromCount(count: number) {
  let idx = 0;
  for (let i = 0; i < TIERS.length; i += 1) if (count >= TIERS[i].min) idx = i;
  return TIERS[idx];
}

export function PartnerTier({ sales }: { sales: Sale[] }) {
  const { language } = useLanguage();
  const confirmed = sales.filter((s) => CONFIRMED.includes(s.status));
  const count = confirmed.length;
  const earned = confirmed.reduce((sum, s) => sum + s.commissionAmount, 0);
  let idx = 0;
  for (let i = 0; i < TIERS.length; i += 1) if (count >= TIERS[i].min) idx = i;
  const tier = TIERS[idx];
  const next = TIERS[idx + 1];
  const span = next ? next.min - tier.min : 1;
  const done = next ? Math.min(1, Math.max(0, (count - tier.min) / span)) : 1;
  const remaining = next ? Math.max(0, next.min - count) : 0;

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
        <View style={{ alignItems: "center", backgroundColor: tier.tint, borderRadius: 14, height: 52, justifyContent: "center", width: 52 }}>
          <MaterialCommunityIcons name={tier.icon} size={28} color={tier.color} />
        </View>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{translateCopy(tier.label, language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{count} {translateCopy("başarılı satış", language)} · {money(earned)} {translateCopy("kazanç", language)}</Text>
        </View>
      </View>
      {next ? (
        <View style={{ gap: 6 }}>
          <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 8, overflow: "hidden" }}>
            <View style={{ backgroundColor: tier.color, height: 8, width: `${Math.round(done * 100)}%` }} />
          </View>
          <Text style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>
            {translateCopy(next.label, language)} {translateCopy("için", language)} {remaining} {translateCopy("satış daha", language)}
          </Text>
        </View>
      ) : (
        <Text style={{ color: tier.color, fontSize: 12, fontWeight: "800" }}>{translateCopy("En üst seviyedesin — teşekkürler!", language)}</Text>
      )}
    </View>
  );
}
