import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { usePathname, useRouter } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/components/colors";
import { GlobalSearchBar } from "@/components/global-search-bar";
import { HeaderActions } from "@/components/header-actions";
import { Brand3DMark } from "@/components/three-d-showcase";
import { translateCopy, useLanguage } from "@/lib/i18n";

const mascot = require("../assets/mascot.png");

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { language, t } = useLanguage();
  const showBack = pathname !== "/" && pathname !== "/index";

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  }

  return (
    <View
      style={{
        backgroundColor: colors.primarySoft,
        borderBottomColor: "rgba(0,134,111,0.12)",
        borderBottomWidth: 1,
        gap: 7,
        paddingBottom: 8,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: insets.top + 6
      }}
    >
      <View style={{ alignItems: "center", flexDirection: "row", minHeight: 48, overflow: "hidden" }}>
        <Image source={mascot} contentFit="contain" style={{ height: 72, opacity: 0.09, position: "absolute", right: -14, top: -8, width: 72 }} />
        {showBack ? (
          <Pressable
            accessibilityLabel={translateCopy("Geri", language)}
            accessibilityRole="button"
            hitSlop={10}
            onPress={goBack}
            style={({ pressed }) => ({
              alignItems: "center",
              backgroundColor: colors.surface,
              borderColor: colors.line,
              borderRadius: 999,
              borderWidth: 1,
              height: 38,
              justifyContent: "center",
              marginRight: 8,
              opacity: pressed ? 0.7 : 1,
              width: 38,
              zIndex: 2
            })}
          >
            <MaterialCommunityIcons name="chevron-left" size={26} color={colors.primaryDark} />
          </Pressable>
        ) : null}
        <View style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: 10, minWidth: 0 }}>
          <Brand3DMark size={40} />
          <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
            <Text selectable numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 21, fontWeight: "900", letterSpacing: 0 }}>
              ortaksat
            </Text>
            <Text selectable numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
              {t("appSlogan")}
            </Text>
          </View>
        </View>
        <HeaderActions />
      </View>
      <GlobalSearchBar />
    </View>
  );
}
