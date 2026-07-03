import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { colors } from "@/components/colors";
import { useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";

type TabKey = "index" | "explore" | "create-action" | "partner" | "menu";

const tabIcons: Record<TabKey, keyof typeof MaterialCommunityIcons.glyphMap> = {
  index: "home-outline",
  explore: "play-box-multiple-outline",
  "create-action": "store-plus-outline",
  partner: "handshake-outline",
  menu: "menu"
};

const activeIcons: Record<TabKey, keyof typeof MaterialCommunityIcons.glyphMap> = {
  index: "home",
  explore: "play-box-multiple",
  "create-action": "store-plus",
  partner: "handshake",
  menu: "menu"
};

function tabIcon(name: TabKey) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => {
    if (name === "create-action") {
      return (
        <View
          style={{
            alignItems: "center",
            backgroundColor: focused ? colors.primaryDark : colors.primary,
            borderColor: "#FFFFFF",
            borderRadius: 22,
            borderWidth: 5,
            height: 58,
            justifyContent: "center",
            marginBottom: 8,
            shadowColor: colors.primaryDark,
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.22,
            shadowRadius: 16,
            width: 58
          }}
        >
          <MaterialCommunityIcons name={focused ? activeIcons[name] : tabIcons[name]} size={25} color="#FFFFFF" />
        </View>
      );
    }

    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: focused ? colors.primarySoft : "transparent",
          borderRadius: 999,
          height: 34,
          justifyContent: "center",
          width: 42
        }}
      >
        <MaterialCommunityIcons name={focused ? activeIcons[name] : tabIcons[name]} size={22} color={String(color)} />
      </View>
    );
  };
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  // On desktop web the bottom tab bar is hidden in favor of the header nav.
  const isWideWeb = useIsWideWeb();

  return (
    <Tabs
      screenOptions={{
        header: () => <AppHeader />,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.primary,
        tabBarBadgeStyle: {
          backgroundColor: colors.accent,
          color: "#FFFFFF",
          fontSize: 10,
          fontWeight: "900"
        },
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: colors.ink,
        tabBarItemStyle: {
          height: 66,
          paddingTop: 5
        },
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "900",
          lineHeight: 12,
          marginTop: 2
        },
        tabBarStyle: isWideWeb ? { display: "none" } : {
          backgroundColor: colors.surface,
          borderColor: "rgba(16,24,40,0.08)",
          borderRadius: 26,
          borderTopWidth: 1,
          borderWidth: 1,
          bottom: Math.max(insets.bottom, 10),
          height: 74,
          left: 12,
          paddingBottom: 8,
          paddingTop: 8,
          position: "absolute",
          right: 12,
          shadowColor: "#101828",
          shadowOffset: { width: 0, height: 14 },
          shadowOpacity: 0.15,
          shadowRadius: 22
        }
      }}
    >
      <Tabs.Screen name="index" options={{ title: t("home"), tabBarLabel: t("home"), tabBarIcon: tabIcon("index") }} />
      <Tabs.Screen name="explore" options={{ title: t("explore"), tabBarLabel: t("explore"), tabBarIcon: tabIcon("explore") }} />
      <Tabs.Screen name="create-action" options={{ title: t("createListing"), tabBarLabel: () => null, tabBarIcon: tabIcon("create-action") }} />
      <Tabs.Screen name="partner" options={{ title: t("partnerSales"), tabBarLabel: t("partnerSales"), tabBarIcon: tabIcon("partner") }} />
      <Tabs.Screen name="menu" options={{ title: t("menu"), tabBarLabel: t("menu"), tabBarIcon: tabIcon("menu") }} />
      <Tabs.Screen name="notifications-tab" options={{ href: null }} />
      <Tabs.Screen name="explore-feed/[id]" options={{ href: null, headerShown: false, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="seller" options={{ href: null }} />
      <Tabs.Screen name="trust-action" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
