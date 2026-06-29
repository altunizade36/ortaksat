import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

/**
 * Web-only desktop landing hero (matches the approved homepage comp):
 * left value proposition + CTAs + social proof, center product/network visual,
 * right column of headline marketplace stats. Mint background, dark text.
 */
export function WebHero({
  totalListings,
  averageCommission,
  cityCount
}: {
  totalListings: number;
  averageCommission: number;
  cityCount: number;
}) {
  const stats: Array<{ icon: IconName; value: string; label: string; tint: [string, string] }> = [
    { icon: "tag-multiple", value: "12.458", label: "Aktif İlan", tint: [colors.primarySoft, colors.primaryDark] },
    { icon: "account-group", value: "8.750", label: "Aktif Ortak Satıcı", tint: [colors.infoSoft, colors.info] },
    { icon: "cash-multiple", value: "₺2.450", label: "Ortalama Komisyon", tint: [colors.goldSoft, colors.gold] },
    { icon: "map-marker-radius", value: "81", label: "Şehirde Hizmet", tint: [colors.violetSoft, colors.violet] }
  ];
  void totalListings;
  void averageCommission;
  void cityCount;

  const avatarColors = [colors.primary, colors.info, colors.gold, colors.violet, colors.accent];

  return (
    <View
      dataSet={{ reveal: "1" }}
      style={{
        backgroundColor: colors.primarySoft,
        borderRadius: 24,
        flexDirection: "row",
        gap: 28,
        overflow: "hidden",
        paddingHorizontal: 36,
        paddingVertical: 36
      }}
    >
      {/* LEFT — value proposition */}
      <View style={{ flex: 1.25, gap: 16, justifyContent: "center", minWidth: 0 }}>
        <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderRadius: 999, flexDirection: "row", gap: 7, paddingHorizontal: 12, paddingVertical: 7 }}>
          <MaterialCommunityIcons name="lightning-bolt" size={14} color={colors.primary} />
          <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>Komisyonla kazanmanın en kolay yolu</Text>
        </View>

        <Text style={{ color: colors.ink, fontSize: 38, fontWeight: "900", lineHeight: 44 }}>
          Satamadığın ürünü ortak satışa aç.{"\n"}
          <Text style={{ color: colors.primary }}>Birlikte kazanalım.</Text>
        </Text>
        <Text style={{ color: colors.muted, fontSize: 16, fontWeight: "600", lineHeight: 24, maxWidth: 520 }}>
          Ürününü paylaş, güvenilir ortaklarla buluştur, satış gerçekleştiğinde komisyon kazan.
        </Text>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
          <Link href="/create" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingVertical: 14 }}>
              <MaterialCommunityIcons name="store-plus-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>İlan Ver</Text>
            </Pressable>
          </Link>
          <Link href="/partner" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderColor: colors.primary, borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingVertical: 14 }}>
              <MaterialCommunityIcons name="handshake-outline" size={18} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>Ortak Satıcı Ol</Text>
            </Pressable>
          </Link>
        </View>

        <View style={{ alignItems: "center", flexDirection: "row", gap: 10, marginTop: 6 }}>
          <View style={{ flexDirection: "row" }}>
            {avatarColors.map((c, i) => (
              <View key={c} style={{ alignItems: "center", backgroundColor: c, borderColor: colors.primarySoft, borderRadius: 999, borderWidth: 2, height: 30, justifyContent: "center", marginLeft: i === 0 ? 0 : -10, width: 30 }}>
                <MaterialCommunityIcons name="account" size={16} color="#FFFFFF" />
              </View>
            ))}
          </View>
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>1.250+ kişi bu hafta kazanç sağladı</Text>
        </View>
      </View>

      {/* CENTER — product / network visual */}
      <View style={{ alignItems: "center", flex: 0.9, justifyContent: "center", minWidth: 0 }}>
        <View style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18, shadowColor: "#101828", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.12, shadowRadius: 28, width: 240 }}>
          <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 999, flexDirection: "row", gap: 5, marginBottom: 12, paddingHorizontal: 10, paddingVertical: 5 }}>
            <MaterialCommunityIcons name="star-four-points" size={12} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "900" }}>Yeni İlan</Text>
          </View>
          <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 16, height: 150, justifyContent: "center", width: "100%" }}>
            <MaterialCommunityIcons name="sofa-single-outline" size={64} color={colors.primary} />
          </View>
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: "900", marginTop: 12 }}>₺450</Text>
          <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primarySoft, borderRadius: 999, marginTop: 6, paddingHorizontal: 10, paddingVertical: 4 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>Kazancın %10</Text>
          </View>
        </View>
      </View>

      {/* RIGHT — headline stats */}
      <View style={{ flex: 0.95, gap: 12, justifyContent: "center", minWidth: 220 }}>
        {stats.map((stat) => (
          <View key={stat.label} style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 16, flexDirection: "row", gap: 14, paddingHorizontal: 18, paddingVertical: 14 }}>
            <View style={{ alignItems: "center", backgroundColor: stat.tint[0], borderRadius: 12, height: 44, justifyContent: "center", width: 44 }}>
              <MaterialCommunityIcons name={stat.icon} size={22} color={stat.tint[1]} />
            </View>
            <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 22, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{stat.value}</Text>
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>{stat.label}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
