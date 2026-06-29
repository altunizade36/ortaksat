import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link, usePathname, useRouter, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/components/colors";
import { GlobalSearchBar } from "@/components/global-search-bar";
import { HeaderActions } from "@/components/header-actions";
import { Brand3DMark } from "@/components/three-d-showcase";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";

const mascot = require("../assets/mascot.png");

type NavItem = { href: Href; label: string; match: (path: string) => boolean };

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { language, t } = useLanguage();
  const isWideWeb = useIsWideWeb();
  const showBack = !isWideWeb && pathname !== "/" && pathname !== "/index";

  const navItems: NavItem[] = [
    { href: "/", label: t("home"), match: (p) => p === "/" || p === "/index" },
    { href: "/explore", label: t("explore"), match: (p) => p.startsWith("/explore") },
    { href: "/create", label: t("createListing"), match: (p) => p.startsWith("/create") },
    { href: "/partner", label: t("partnerSales"), match: (p) => p.startsWith("/partner") },
    { href: "/menu", label: t("menu"), match: (p) => p.startsWith("/menu") }
  ];

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  }

  return (
    <>
    {isWideWeb ? <TrustTopBar /> : null}
    <View
      style={{
        backgroundColor: colors.primarySoft,
        borderBottomColor: "rgba(0,134,111,0.12)",
        borderBottomWidth: 1,
        gap: 7,
        paddingBottom: isWideWeb ? 12 : 8,
        paddingLeft: isWideWeb ? 32 : 12,
        paddingRight: isWideWeb ? 32 : 12,
        paddingTop: insets.top + (isWideWeb ? 14 : 6)
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
        <Link href="/" asChild>
          <Pressable style={{ alignItems: "center", flex: isWideWeb ? 0 : 1, flexDirection: "row", gap: 10, minWidth: 0 }}>
            <Brand3DMark size={40} />
            <View style={{ gap: 1, minWidth: 0 }}>
              <Text selectable numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 21, fontWeight: "900", letterSpacing: 0 }}>
                ortaksat
              </Text>
              <Text selectable numberOfLines={1} style={{ color: colors.muted, fontSize: 12, fontWeight: "800" }}>
                {t("appSlogan")}
              </Text>
            </View>
          </Pressable>
        </Link>
        {isWideWeb ? (
          <View style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: 6, justifyContent: "center", minWidth: 0 }}>
            {navItems.map((item) => {
              const active = item.match(pathname);
              return (
                <Link key={item.label} href={item.href} asChild>
                  <Pressable
                    style={{
                      backgroundColor: active ? colors.primary : "transparent",
                      borderRadius: 999,
                      paddingHorizontal: 16,
                      paddingVertical: 9
                    }}
                  >
                    <Text numberOfLines={1} style={{ color: active ? "#FFFFFF" : colors.primaryDark, fontSize: 14, fontWeight: "800" }}>
                      {item.label}
                    </Text>
                  </Pressable>
                </Link>
              );
            })}
          </View>
        ) : null}
        <HeaderActions />
      </View>
      <GlobalSearchBar />
    </View>
    </>
  );
}

function TrustTopBar() {
  const items: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }> = [
    { icon: "shield-check", label: "Komisyon kayıt altında" },
    { icon: "swap-horizontal", label: "Şeffaf süreç" },
    { icon: "account-check", label: "Doğrulanmış satıcılar" },
    { icon: "whatsapp", label: "WhatsApp destek" }
  ];
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.primaryDark, flexDirection: "row", flexWrap: "wrap", gap: 24, justifyContent: "center", paddingHorizontal: 32, paddingVertical: 8 }}>
      {items.map((item) => (
        <View key={item.label} style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
          <MaterialCommunityIcons name={item.icon} size={14} color="rgba(255,255,255,0.9)" />
          <Text style={{ color: "rgba(255,255,255,0.92)", fontSize: 12, fontWeight: "700" }}>{item.label}</Text>
        </View>
      ))}
    </View>
  );
}
