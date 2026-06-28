import { Image } from "expo-image";
import { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

import { colors } from "@/components/colors";
import { SafeRemoteImage } from "@/components/safe-remote-image";
import { commissionAmount, money } from "@/lib/format";
import { useLanguage } from "@/lib/i18n";
import { displayText } from "@/lib/text";
import type { Listing } from "@/lib/types";

const mascot = require("../assets/mascot.png");

export function Brand3DMark({ size = 54 }: { size?: number }) {
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { duration: 1700, toValue: 1, useNativeDriver: true }),
        Animated.timing(float, { duration: 1700, toValue: 0, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const translateY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });
  const rotateZ = float.interpolate({ inputRange: [0, 1], outputRange: ["-2deg", "2deg"] });

  return (
    <View style={{ height: size + 12, justifyContent: "center", width: size + 12 }}>
      <View
        style={{
          backgroundColor: "rgba(0, 95, 79, 0.18)",
          borderRadius: 999,
          bottom: 1,
          height: size * 0.28,
          left: size * 0.18,
          position: "absolute",
          right: size * 0.18,
          transform: [{ scaleX: 1.2 }]
        }}
      />
      <Animated.View
        style={{
          alignItems: "center",
          backgroundColor: colors.surface,
          borderColor: "rgba(255,255,255,0.86)",
          borderRadius: Math.round(size * 0.28),
          borderWidth: 1,
          height: size,
          justifyContent: "center",
          overflow: "hidden",
          shadowColor: colors.primaryDark,
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.22,
          shadowRadius: 18,
          transform: [{ perspective: 420 }, { rotateX: "8deg" }, { rotateY: "-10deg" }, { rotateZ }, { translateY }],
          width: size
        }}
      >
        <View
          style={{
            backgroundColor: "rgba(255,255,255,0.45)",
            borderRadius: 999,
            height: size * 0.6,
            left: -size * 0.22,
            position: "absolute",
            top: -size * 0.3,
            width: size * 0.78
          }}
        />
        <Image source={mascot} contentFit="cover" style={{ height: size + 10, width: size + 10 }} />
      </Animated.View>
    </View>
  );
}

export function Marketplace3DHero({ listings }: { listings: Listing[] }) {
  const { t } = useLanguage();
  const float = useRef(new Animated.Value(0)).current;
  const first = listings[0];
  const second = listings[1] ?? first;
  const third = listings[2] ?? second;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, { duration: 2200, toValue: 1, useNativeDriver: true }),
        Animated.timing(float, { duration: 2200, toValue: 0, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [float]);

  const lift = float.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });
  const tilt = float.interpolate({ inputRange: [0, 1], outputRange: ["-5deg", "-1deg"] });

  return (
    <View
      style={{
        backgroundColor: colors.primaryDark,
        borderColor: "rgba(255,255,255,0.12)",
        borderRadius: 16,
        borderWidth: 1,
        minHeight: 150,
        overflow: "hidden",
        padding: 12,
        shadowColor: colors.primaryDark,
        shadowOffset: { width: 0, height: 18 },
        shadowOpacity: 0.22,
        shadowRadius: 26
      }}
    >
      <View style={{ backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 999, height: 170, position: "absolute", right: -74, top: -62, width: 170 }} />
      <View style={{ backgroundColor: "rgba(223,247,239,0.12)", borderRadius: 999, bottom: -76, height: 150, left: -74, position: "absolute", width: 150 }} />

      <View style={{ flexDirection: "row", gap: 10 }}>
        <View style={{ flex: 1, gap: 6, minWidth: 0 }}>
          <View style={{ alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }}>
            <Text selectable style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "900" }}>
              {t("marketplaceBadge")}
            </Text>
          </View>
          <Text selectable numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 21, fontWeight: "900", lineHeight: 25 }}>
            {t("heroTitle")}
          </Text>
          <Text selectable numberOfLines={2} style={{ color: "#DFF7EF", fontSize: 12, fontWeight: "700", lineHeight: 17 }}>
            {t("heroBody")}
          </Text>
        </View>

        <View style={{ height: 92, width: 120 }}>
          <ProductCard3D listing={third} style={{ left: 0, top: 24, transform: [{ perspective: 420 }, { rotateY: "20deg" }, { rotateZ: "-8deg" }, { scale: 0.62 }] }} />
          <ProductCard3D listing={second} style={{ right: 0, top: 4, transform: [{ perspective: 420 }, { rotateY: "-18deg" }, { rotateZ: "8deg" }, { scale: 0.68 }] }} />
          <Animated.View style={{ position: "absolute", right: 22, top: 25, transform: [{ translateY: lift }, { perspective: 420 }, { rotateX: "7deg" }, { rotateY: tilt }] }}>
            <Brand3DMark size={50} />
          </Animated.View>
        </View>
      </View>

      {first ? (
        <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.1)", borderColor: "rgba(255,255,255,0.13)", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 8, marginTop: 8, minHeight: 48, padding: 7 }}>
          <SafeRemoteImage uri={first.image} style={{ borderRadius: 9, height: 38, width: 38 }} contentFit="cover" />
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text selectable numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>
              {displayText(first.title)}
            </Text>
            <Text selectable numberOfLines={1} style={{ color: "#DFF7EF", fontSize: 11, fontWeight: "800" }}>
              {t("earning")} {money(commissionAmount(first))} / {displayText(first.location)}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function ProductCard3D({ listing, style }: { listing?: Listing; style: object }) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderColor: "rgba(255,255,255,0.8)",
          borderRadius: 13,
          borderWidth: 1,
          height: 92,
          overflow: "hidden",
          position: "absolute",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.22,
          shadowRadius: 18,
          width: 82
        },
        style
      ]}
    >
      {listing ? <SafeRemoteImage uri={listing.image} style={{ height: 62, width: "100%" }} contentFit="cover" /> : <View style={{ backgroundColor: colors.primarySoft, height: 62 }} />}
      <View style={{ gap: 3, padding: 5 }}>
        <View style={{ backgroundColor: colors.line, borderRadius: 999, height: 5, width: "88%" }} />
        <View style={{ backgroundColor: colors.primarySoft, borderRadius: 999, height: 5, width: "54%" }} />
      </View>
    </View>
  );
}
