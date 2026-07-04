import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { commissionAmount, moneyIn } from "@/lib/format";
import type { Listing } from "@/lib/types";

/** Ortak kazanç hesaplayıcı: "Bu üründen kaç satarsan ne kazanırsın." */
export function EarningsCalculator({ listing, isDemo, onJoin }: { listing: Listing; isDemo: boolean; onJoin: () => void }) {
  const per = commissionAmount(listing);
  const [qty, setQty] = useState(5);
  if (per <= 0) return null;
  const hasBonus = Boolean(listing.bonusAmount && listing.bonusAmount > 0 && listing.bonusQuota && listing.bonusQuota > 0);
  const quota = hasBonus ? (listing.bonusQuota as number) : 0;
  // Bonus "ilk N satışa özel" olduğundan projeksiyona YALNIZCA satış adedi kotayı
  // yakaladığında eklenir; önceden qty=1'de bile tam bonus eklenip kazanç şişiyordu.
  const qualifiesBonus = hasBonus && qty >= quota;
  const bonus = qualifiesBonus ? (listing.bonusAmount as number) : 0;
  const total = per * qty + bonus;

  return (
    <View style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 16, borderWidth: 1, gap: 12, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="calculator-variant-outline" size={20} color={colors.primaryDark} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 15.5, fontWeight: "900" }}>Kazanç Hesapla</Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 17 }}>
        Bu ürünü ortak olarak sat ya da alıcı getir; her satışta <Text style={{ color: colors.primaryDark, fontWeight: "900" }}>{moneyIn(per, listing.currency)}</Text> kazan. Komisyonu satıcı öder.
      </Text>

      <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
        <Text style={{ color: colors.ink, fontSize: 12.5, fontWeight: "800" }}>Satış adedi</Text>
        <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 4, padding: 3 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Azalt" onPress={() => setQty((q) => Math.max(1, q - 1))} style={{ alignItems: "center", backgroundColor: colors.surfaceAlt, borderRadius: 8, height: 32, justifyContent: "center", width: 34 }}>
            <MaterialCommunityIcons name="minus" size={18} color={colors.ink} />
          </Pressable>
          <Text style={{ color: colors.ink, fontSize: 15, fontVariant: ["tabular-nums"], fontWeight: "900", minWidth: 34, textAlign: "center" }}>{qty}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Artır" onPress={() => setQty((q) => Math.min(999, q + 1))} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 8, height: 32, justifyContent: "center", width: 34 }}>
            <MaterialCommunityIcons name="plus" size={18} color="#FFFFFF" />
          </Pressable>
        </View>
      </View>

      {hasBonus ? (
        <View style={{ alignItems: "center", backgroundColor: colors.warningSoft, borderRadius: 10, flexDirection: "row", gap: 8, padding: 10 }}>
          <MaterialCommunityIcons name="rocket-launch" size={17} color={colors.warning} />
          <Text style={{ color: colors.warning, flex: 1, fontSize: 12, fontWeight: "800", lineHeight: 16 }}>
            İlk {listing.bonusQuota} satışa özel <Text style={{ fontWeight: "900" }}>+{moneyIn(bonus, listing.currency)}</Text> başlangıç bonusu — erken ortaklara.
          </Text>
        </View>
      ) : null}

      <View style={{ flexDirection: "row", gap: 6 }}>
        {[5, 10, 25, 50].map((n) => (
          <Pressable key={n} onPress={() => setQty(n)} style={{ backgroundColor: qty === n ? colors.primary : colors.surface, borderColor: qty === n ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flex: 1, paddingVertical: 6 }}>
            <Text style={{ color: qty === n ? "#FFFFFF" : colors.ink, fontSize: 12, fontWeight: "800", textAlign: "center" }}>{n}</Text>
          </Pressable>
        ))}
      </View>

      <View style={{ alignItems: "center", backgroundColor: colors.primaryDark, borderRadius: 12, flexDirection: "row", gap: 10, padding: 14 }}>
        <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "700" }}>{qty} satışta toplam kazancın{qualifiesBonus ? " (bonus dahil)" : hasBonus ? ` · ${quota}+ satışta bonus` : ""}</Text>
          <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 24, fontWeight: "900" }}>{moneyIn(total, listing.currency)}</Text>
        </View>
        <MaterialCommunityIcons name="cash-multiple" size={30} color={colors.gold} />
      </View>

      <Pressable disabled={isDemo} onPress={onJoin} style={{ alignItems: "center", backgroundColor: isDemo ? colors.line : colors.primary, borderRadius: 11, flexDirection: "row", gap: 7, justifyContent: "center", paddingVertical: 12 }}>
        <MaterialCommunityIcons name="handshake-outline" size={17} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{listing.partnershipMode === "open" ? "Hemen Ortak Ol ve Kazan" : "Ortaklık Başvurusu Gönder"}</Text>
      </Pressable>
    </View>
  );
}
