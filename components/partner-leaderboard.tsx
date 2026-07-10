import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { loadPartnerLeaderboardLive, type PublicLeaderRow } from "@/lib/live-service";
import type { Partnership, Sale, User } from "@/lib/types";

type Rank = { id: string; name: string; avatar: string; rating: number; sales: number; earned: number };

const MEDAL: Record<number, { color: string; icon: "trophy" | "medal" }> = {
  0: { color: "#D4AF37", icon: "trophy" },
  1: { color: "#9AA3AD", icon: "medal" },
  2: { color: "#B87333", icon: "medal" }
};

/**
 * "En Çok Kazandıran Ortaklar" panosu — ortak modelinin sosyal kanıtı.
 * Ortakların (partnerId) getirdiği satış ve kazandırdığı komisyona göre sıralar.
 */
export function PartnerLeaderboard({
  users,
  partnerships,
  sales,
  highlightUserId
}: {
  users: User[];
  partnerships: Partnership[];
  sales: Sale[];
  highlightUserId?: string;
}) {
  const router = useRouter();
  const { language } = useLanguage();
  // Herkese açık liderlik (RLS-bağımsız agregat view). Boşsa istemci-agregasyonuna düşer.
  const [publicRows, setPublicRows] = useState<PublicLeaderRow[]>([]);
  useEffect(() => {
    let alive = true;
    void loadPartnerLeaderboardLive(8).then((rows) => { if (alive) setPublicRows(rows); });
    return () => { alive = false; };
  }, []);

  const ranks = useMemo<Rank[]>(() => {
    if (publicRows.length > 0) {
      return publicRows
        .map((row) => {
          const u = users.find((x) => x.id === row.partnerId);
          return { id: row.partnerId, name: u?.name || row.fullName || "Ortak", avatar: u?.avatar ?? "", rating: u?.rating ?? 0, sales: row.confirmedSales, earned: row.paidEarned };
        })
        .sort((a, b) => b.sales - a.sales || b.earned - a.earned)
        .slice(0, 8);
    }
    // İstemci-agregasyonu (önizleme / henüz veri gelmemişken). Yalnız hak edilen sayılır.
    const psToPartner = new Map(partnerships.map((p) => [p.id, p.partnerId]));
    const EARNED = new Set<Sale["status"]>(["approved", "seller_paid", "paid"]);
    const agg = new Map<string, { sales: number; earned: number }>();
    for (const sale of sales) {
      if (!EARNED.has(sale.status)) continue;
      const partnerId = psToPartner.get(sale.partnershipId);
      if (!partnerId) continue;
      const cur = agg.get(partnerId) ?? { sales: 0, earned: 0 };
      cur.sales += 1;
      cur.earned += sale.commissionAmount;
      agg.set(partnerId, cur);
    }
    return [...agg.entries()]
      .map(([userId, v]) => {
        const user = users.find((u) => u.id === userId);
        return user ? { id: user.id, name: user.name, avatar: user.avatar, rating: user.rating, sales: v.sales, earned: v.earned } : null;
      })
      .filter((r): r is Rank => r !== null)
      .sort((a, b) => b.earned - a.earned || b.sales - a.sales)
      .slice(0, 8);
  }, [publicRows, partnerships, sales, users]);

  if (ranks.length === 0) return null;

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="trophy-variant" size={20} color={colors.gold} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>{translateCopy("En Çok Kazandıran Ortaklar", language)}</Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 17 }}>{translateCopy("Başka satıcıların ürünlerini satarak / alıcı getirerek en çok komisyon kazandıran ortaklar.", language)}</Text>

      {ranks.map((r, i) => {
        const medal = MEDAL[i];
        const isMe = r.id === highlightUserId;
        return (
          <Pressable
            key={r.id}
            onPress={() => router.push({ pathname: "/store/[id]", params: { id: r.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${r.name} ${translateCopy("ortak profilini aç", language)}`}
            style={{ alignItems: "center", backgroundColor: isMe ? colors.primarySoft : colors.surfaceAlt, borderColor: isMe ? colors.primary : "transparent", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 11, padding: 10 }}
          >
            <View style={{ alignItems: "center", justifyContent: "center", width: 26 }}>
              {medal ? <MaterialCommunityIcons name={medal.icon} size={20} color={medal.color} /> : <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "900" }}>{i + 1}</Text>}
            </View>
            {isImageAvatar(r.avatar) ? (
              <Image source={{ uri: r.avatar }} contentFit="cover" style={{ borderRadius: 10, height: 40, width: 40 }} />
            ) : (
              <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, height: 40, justifyContent: "center", width: 40 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{r.avatar || r.name.slice(0, 2)}</Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>{r.name}{isMe ? translateCopy(" (sen)", language) : ""}</Text>
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{r.sales} {translateCopy("satış", language)}{r.rating ? ` · ⭐ ${r.rating}` : ""}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 1 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>{money(r.earned)}</Text>
              <Text style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "700" }}>{translateCopy("kazanç", language)}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

function isImageAvatar(value: string) {
  return value.startsWith("http://") || value.startsWith("https://") || value.startsWith("file:");
}
