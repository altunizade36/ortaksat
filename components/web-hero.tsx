import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { commissionAmount, money } from "@/lib/format";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { compactNumber } from "@/lib/locale";
import { displayText } from "@/lib/text";
import { useStore } from "@/lib/use-store";

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
  void averageCommission;

  const { language } = useLanguage();
  const { listings } = useStore();
  const openCount = listings.filter((l) => l.status === "active" && l.partnershipMode === "open").length;
  // Pazar henüz boşken sıfır göstermek yerine her zaman doğru değer önermeleri göster.
  const stats: Array<{ icon: IconName; value: string; label: string; tint: [string, string] }> = totalListings === 0
    ? [
        { icon: "store-plus-outline", value: "Ücretsiz", label: "İlan yayınla", tint: [colors.primarySoft, colors.primaryDark] },
        { icon: "handshake-outline", value: "Ortak", label: "Satışta kazanç modeli", tint: [colors.infoSoft, colors.info] },
        { icon: "cash-remove", value: "%0", label: "Platform komisyonu", tint: [colors.violetSoft, colors.violet] },
        { icon: "shield-check", value: "Güvenli", label: "Aracı platform", tint: [colors.goldSoft, colors.gold] }
      ]
    : [
        { icon: "tag-multiple", value: compactNumber(totalListings), label: "Aktif ilan", tint: [colors.primarySoft, colors.primaryDark] },
        { icon: "handshake-outline", value: compactNumber(openCount), label: "Ortak satışa açık", tint: [colors.infoSoft, colors.info] },
        { icon: "map-marker-radius", value: compactNumber(cityCount), label: "Şehir", tint: [colors.violetSoft, colors.violet] },
        { icon: "shield-check", value: "Ücretsiz", label: "İlan & başvuru", tint: [colors.goldSoft, colors.gold] }
      ];

  const featured = listings
    .filter((l) => l.status === "active" && l.image)
    .sort((a, b) => b.favoriteCount - a.favoriteCount)[0] ?? listings[0];

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
          <Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{translateCopy("Ortak satış platformu", language)}</Text>
        </View>

        <Text accessibilityRole="header" {...({ role: "heading", "aria-level": 1 } as Record<string, unknown>)} style={{ color: colors.ink, fontSize: 38, fontWeight: "900", lineHeight: 44 }}>
          {translateCopy("Ürününü ortak satışa aç.", language)}{"\n"}
          <Text style={{ color: colors.primary }}>{translateCopy("Satış yapabilecek kişilerle eşleş.", language)}</Text>
        </Text>
        <Text style={{ color: colors.muted, fontSize: 16, fontWeight: "600", lineHeight: 24, maxWidth: 520 }}>
          {translateCopy("Ürününü paylaş, satış yapabilecek ortaklarla eşleş. Komisyonu taraflar kendi arasında belirler; ödeme ve teslimat kullanıcılar arasında yapılır.", language)}
        </Text>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
          <Link href="/create" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingVertical: 14 }}>
              <MaterialCommunityIcons name="store-plus-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{translateCopy("İlan Ver", language)}</Text>
            </Pressable>
          </Link>
          <Link href="/partner" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderColor: colors.primary, borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingVertical: 14 }}>
              <MaterialCommunityIcons name="handshake-outline" size={18} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>{translateCopy("Ortak Satıcı Ol", language)}</Text>
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
          <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>{translateCopy("Ücretsiz üyelik · Aracı platform · Komisyonu taraflar belirler", language)}</Text>
        </View>
      </View>

      {/* CENTER — featured real listing */}
      <View style={{ alignItems: "center", flex: 0.9, justifyContent: "center", minWidth: 0 }}>
        <Link href={featured ? { pathname: "/listing/[id]", params: { id: featured.id } } : "/explore"} asChild>
          <Pressable style={{ backgroundColor: "#FFFFFF", borderRadius: 24, padding: 18, shadowColor: "#101828", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.12, shadowRadius: 28, width: 250 }}>
            <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.primary, borderRadius: 999, flexDirection: "row", gap: 5, marginBottom: 12, paddingHorizontal: 10, paddingVertical: 5, position: "absolute", zIndex: 2, left: 28, top: 28 }}>
              <MaterialCommunityIcons name="star-four-points" size={12} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "900" }}>{translateCopy("Öne çıkan", language)}</Text>
            </View>
            <View style={{ backgroundColor: colors.primarySoft, borderRadius: 16, height: 160, overflow: "hidden", width: "100%" }}>
              <SafeRemoteImage uri={featured?.image} style={{ height: "100%", width: "100%" }} contentFit="cover" transition={160} />
            </View>
            <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900", marginTop: 12 }}>{featured ? displayText(featured.title) : translateCopy("Öne çıkan ürün", language)}</Text>
            <View style={{ alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{featured ? money(featured.price) : "₺450"}</Text>
              <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "900" }}>{translateCopy("Kazanç", language)} {featured ? money(commissionAmount(featured)) : "₺45"}</Text>
              </View>
            </View>
          </Pressable>
        </Link>
      </View>

      {/* RIGHT — headline stats */}
      <View style={{ flex: 0.95, gap: 12, justifyContent: "center", minWidth: 220 }}>
        {stats.map((stat) => (
          <View key={stat.label} style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 16, flexDirection: "row", gap: 14, paddingHorizontal: 18, paddingVertical: 14 }}>
            <View style={{ alignItems: "center", backgroundColor: stat.tint[0], borderRadius: 12, height: 44, justifyContent: "center", width: 44 }}>
              <MaterialCommunityIcons name={stat.icon} size={22} color={stat.tint[1]} />
            </View>
            <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
              <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 22, fontVariant: ["tabular-nums"], fontWeight: "900" }}>{translateCopy(stat.value, language)}</Text>
              <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>{translateCopy(stat.label, language)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
