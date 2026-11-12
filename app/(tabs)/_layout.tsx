import { isMobileApp } from "@/lib/mobile-app";
import { MobileBottomNav } from "@/components/mobile/ui";
import { MaterialCommunityIcons } from "@/components/icons";
import { LinearGradient } from "expo-linear-gradient";
import { Tabs } from "expo-router";
import type { ColorValue } from "react-native";
import { Platform, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppHeader } from "@/components/app-header";
import { colors } from "@/components/colors";
import { haptic } from "@/lib/haptics";
import { useLanguage } from "@/lib/i18n";

type TabKey = "index" | "explore" | "create-action" | "partner" | "menu";

const tabIcons: Record<TabKey, keyof typeof MaterialCommunityIcons.glyphMap> = {
  index: "home-outline",
  explore: "compass-outline",
  "create-action": "store-plus-outline",
  partner: "account-group-outline",
  menu: "menu"
};

const activeIcons: Record<TabKey, keyof typeof MaterialCommunityIcons.glyphMap> = {
  index: "home",
  explore: "compass-outline",
  "create-action": "store-plus",
  partner: "account-group",
  menu: "menu"
};

function tabIcon(name: TabKey) {
  return ({ color, focused }: { color: ColorValue; focused: boolean }) => {
    // Merkez "İlan Ver" — premium yükseltilmiş gradient FAB (bar'ın üstüne taşar).
    if (name === "create-action") {
      return (
        <View style={{ alignItems: "center", height: 58, justifyContent: "center", marginBottom: 22, width: 58 }}>
          <LinearGradient
            colors={focused ? ["#075BEB", "#0645C9"] : ["#0645C9", "#09275E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              alignItems: "center",
              borderColor: colors.surface,
              borderRadius: 999,
              borderWidth: 4,
              height: 58,
              justifyContent: "center",
              shadowColor: "#0645C9",
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.4,
              shadowRadius: 14,
              width: 58,
              ...(Platform.OS === "android" ? { elevation: 10 } : null)
            }}
          >
            <MaterialCommunityIcons name="plus" size={30} color="#FFFFFF" />
          </LinearGradient>
        </View>
      );
    }

    // Diğer sekmeler — aktifken yumuşak turkuaz hap arkalık + dolu ikon.
    return (
      <View
        style={{
          alignItems: "center",
          backgroundColor: "transparent",
          borderRadius: 999,
          height: 34,
          justifyContent: "center",
          width: 46
        }}
      >
        <MaterialCommunityIcons name={focused ? activeIcons[name] : tabIcons[name]} size={focused ? 23 : 22} color={String(color)} />
      </View>
    );
  };
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();
  // Web'de (masaüstü VE mobil tarayıcı) alt tab bar GİZLİ — normal web sitesi gibi üstteki
  // header + hamburger menü ile gezinilir. Alt bar yalnız native mobil uygulamada kalır.

  return (
    <Tabs
      backBehavior="fullHistory"
      tabBar={isMobileApp ? ({ state }) => <MobileBottomNav active={({ index: "home", explore: "explore", "create-action": "create", partner: "partner", seller: "menu", profile: "menu", messages: "menu", menu: "menu" } as Record<string, string>)[state.routes[state.index].name] || "menu"} /> : undefined}
      screenOptions={{
        header: () => <AppHeader />,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: "#0645C9",
        tabBarBadgeStyle: {
          backgroundColor: colors.accent,
          color: "#FFFFFF",
          fontSize: 10,
          fontWeight: "900"
        },
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: colors.subtle,
        tabBarItemStyle: {
          height: 61,
          paddingTop: 6
        },
        tabBarLabelPosition: "below-icon",
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          letterSpacing: 0.1,
          lineHeight: 12,
          marginTop: 3
        },
        tabBarStyle: Platform.OS === "web" ? { display: "none" } : {
          backgroundColor: "#FFFFFF",
          borderColor: "#E8EDF1",
          borderTopLeftRadius: 22,
          borderTopRightRadius: 22,
          borderTopWidth: 1,
          bottom: 0,
          height: 70 + insets.bottom,
          left: 0,
          paddingBottom: Math.max(insets.bottom, 8),
          paddingTop: 9,
          position: "absolute",
          right: 0,
          shadowColor: "#001449",
          shadowOffset: { width: 0, height: 12 },
          shadowOpacity: 0.16,
          shadowRadius: 24,
          ...(Platform.OS === "android" ? { elevation: 12 } : null)
        }
      }}
    >
      <Tabs.Screen name="index" options={{ headerShown: !isMobileApp, title: t("home"), tabBarLabel: t("home"), tabBarIcon: tabIcon("index") }} listeners={{ tabPress: () => haptic.selection() }} />
      <Tabs.Screen name="explore" options={{ headerShown: !isMobileApp, title: t("explore"), tabBarLabel: t("explore"), tabBarIcon: tabIcon("explore") }} listeners={{ tabPress: () => haptic.selection() }} />
      <Tabs.Screen name="create-action" options={{ title: t("createListing"), tabBarLabel: t("createListing"), tabBarIcon: tabIcon("create-action") }} listeners={{ tabPress: () => haptic.selection() }} />
      <Tabs.Screen name="partner" options={{ title: t("partnerSales"), tabBarLabel: t("partnerSales"), tabBarIcon: tabIcon("partner") }} listeners={{ tabPress: () => haptic.selection() }} />
      <Tabs.Screen name="menu" options={{ title: t("menu"), tabBarLabel: t("menu"), tabBarIcon: tabIcon("menu") }} listeners={{ tabPress: () => haptic.selection() }} />
      <Tabs.Screen name="notifications-tab" options={{ href: null }} />
      <Tabs.Screen name="explore-feed/[id]" options={{ href: null, headerShown: false, tabBarStyle: { display: "none" } }} />
      <Tabs.Screen name="seller" options={{ href: null }} />
      <Tabs.Screen name="trust-action" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null, headerShown: !isMobileApp }} />
      <Tabs.Screen name="profile" options={{ href: null }} />
    </Tabs>
  );
}
