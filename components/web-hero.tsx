import { Link } from "expo-router";
import { Pressable, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { useLanguage } from "@/lib/i18n";

/**
 * Web-only desktop landing hero. Rendered above the feed on wide screens to give
 * the marketplace a real "web product" first impression. Native/mobile never
 * mounts this (gated by the caller on Platform/width).
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
  const { t } = useLanguage();
  const stats = [
    { value: `${totalListings}`, label: t("activeListing") },
    { value: `₺${averageCommission}`, label: t("earning") },
    { value: `${cityCount}`, label: t("city") }
  ];

  return (
    <View
      dataSet={{ heroBg: "1", reveal: "1" }}
      style={{
        backgroundColor: colors.primary,
        borderRadius: 22,
        flexDirection: "row",
        gap: 28,
        overflow: "hidden",
        paddingHorizontal: 36,
        paddingVertical: 30
      }}
    >
      <View style={{ flex: 1.3, gap: 14, justifyContent: "center", minWidth: 0 }}>
        <View
          style={{
            alignSelf: "flex-start",
            backgroundColor: "rgba(255,255,255,0.16)",
            borderColor: "rgba(255,255,255,0.28)",
            borderRadius: 999,
            borderWidth: 1,
            paddingHorizontal: 14,
            paddingVertical: 7
          }}
        >
          <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "800", letterSpacing: 0.4 }}>
            {t("marketplaceBadge")}
          </Text>
        </View>

        <Text style={{ color: "#FFFFFF", fontSize: 38, fontWeight: "900", lineHeight: 44 }}>
          {t("heroTitle")}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 16, fontWeight: "600", lineHeight: 23, maxWidth: 540 }}>
          {t("heroBody")}
        </Text>

        <View style={{ flexDirection: "row", gap: 12, marginTop: 6 }}>
          <Link href="/create" asChild>
            <Pressable
              style={{
                alignItems: "center",
                backgroundColor: "#FFFFFF",
                borderRadius: 12,
                flexDirection: "row",
                gap: 8,
                paddingHorizontal: 22,
                paddingVertical: 14
              }}
            >
              <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>{t("createListing")}</Text>
            </Pressable>
          </Link>
          <Link href="/explore" asChild>
            <Pressable
              style={{
                alignItems: "center",
                backgroundColor: "rgba(255,255,255,0.14)",
                borderColor: "rgba(255,255,255,0.45)",
                borderRadius: 12,
                borderWidth: 1,
                flexDirection: "row",
                gap: 8,
                paddingHorizontal: 22,
                paddingVertical: 14
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{t("explore")}</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <View style={{ flex: 1, gap: 10, justifyContent: "center", minWidth: 220 }}>
        {stats.map((stat) => (
          <View
            key={stat.label}
            style={{
              backgroundColor: "rgba(255,255,255,0.12)",
              borderColor: "rgba(255,255,255,0.22)",
              borderRadius: 14,
              borderWidth: 1,
              flexDirection: "row",
              alignItems: "center",
              gap: 14,
              paddingHorizontal: 18,
              paddingVertical: 12
            }}
          >
            <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "900", fontVariant: ["tabular-nums"] }}>
              {stat.value}
            </Text>
            <Text style={{ color: "rgba(255,255,255,0.88)", fontSize: 14, fontWeight: "700", flex: 1 }}>
              {stat.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}
