import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { money } from "@/lib/format";
import type { Partnership, Sale, User } from "@/lib/types";

type Rank = { user: User; sales: number; earned: number };

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

  const ranks = useMemo<Rank[]>(() => {
    const psToPartner = new Map(partnerships.map((p) => [p.id, p.partnerId]));
    // Yalnızca gerçekten hak edilen komisyon "kazanç" sayılır; iptal/anlaşmazlık/
    // iade-bekleyen/onay-bekleyen satışlar dahil edilmez (önceden hepsi sayılıyordu).
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
        return user ? { user, sales: v.sales, earned: v.earned } : null;
      })
      .filter((r): r is Rank => r !== null)
      .sort((a, b) => b.earned - a.earned || b.sales - a.sales)
      .slice(0, 8);
  }, [partnerships, sales, users]);

  if (ranks.length === 0) return null;

  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 10, padding: 16 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <MaterialCommunityIcons name="trophy-variant" size={20} color={colors.gold} />
        <Text style={{ color: colors.ink, flex: 1, fontSize: 16, fontWeight: "900" }}>En Çok Kazandıran Ortaklar</Text>
      </View>
      <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 17 }}>Başka satıcıların ürünlerini satarak / alıcı getirerek en çok komisyon kazandıran ortaklar.</Text>

      {ranks.map((r, i) => {
        const medal = MEDAL[i];
        const isMe = r.user.id === highlightUserId;
        return (
          <Pressable
            key={r.user.id}
            onPress={() => router.push({ pathname: "/store/[id]", params: { id: r.user.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${r.user.name} ortak profilini aç`}
            style={{ alignItems: "center", backgroundColor: isMe ? colors.primarySoft : colors.surfaceAlt, borderColor: isMe ? colors.primary : "transparent", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 11, padding: 10 }}
          >
            <View style={{ alignItems: "center", justifyContent: "center", width: 26 }}>
              {medal ? <MaterialCommunityIcons name={medal.icon} size={20} color={medal.color} /> : <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "900" }}>{i + 1}</Text>}
            </View>
            {isImageAvatar(r.user.avatar) ? (
              <Image source={{ uri: r.user.avatar }} contentFit="cover" style={{ borderRadius: 10, height: 40, width: 40 }} />
            ) : (
              <View style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, height: 40, justifyContent: "center", width: 40 }}>
                <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{r.user.avatar || r.user.name.slice(0, 2)}</Text>
              </View>
            )}
            <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14, fontWeight: "800" }}>{r.user.name}{isMe ? " (sen)" : ""}</Text>
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{r.sales} satış · ⭐ {r.user.rating}</Text>
            </View>
            <View style={{ alignItems: "flex-end", gap: 1 }}>
              <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>{money(r.earned)}</Text>
              <Text style={{ color: colors.subtle, fontSize: 10.5, fontWeight: "700" }}>kazanç</Text>
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
