import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { Link, usePathname, useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/components/colors";
import { GlobalSearchBar } from "@/components/global-search-bar";
import { HeaderActions } from "@/components/header-actions";
import { Brand3DMark } from "@/components/three-d-showcase";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { useStore } from "@/lib/use-store";

const mascot = require("../assets/mascot.png");

type NavItem = { href: Href; label: string; match: (path: string) => boolean; caret?: boolean };

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { language, t } = useLanguage();
  const isWideWeb = useIsWideWeb();
  const showBack = !isWideWeb && pathname !== "/" && pathname !== "/index";

  const navItems: NavItem[] = [
    { href: "/", label: "Ana Sayfa", match: (p) => p === "/" || p === "/index" },
    { href: "/explore", label: "Keşfet", match: (p) => p.startsWith("/explore") },
    { href: "/create", label: "İlan Ver", match: (p) => p.startsWith("/create") },
    { href: "/partner", label: "Ortak Satış", match: (p) => p.startsWith("/partner") },
    { href: "/kategoriler", label: "Kategoriler", match: (p) => p.startsWith("/kategoriler"), caret: true },
    { href: "/nasil-calisir", label: "Nasıl Çalışır?", match: (p) => p.startsWith("/nasil-calisir") },
    { href: "/blog", label: "Blog", match: (p) => p.startsWith("/blog") }
  ];

  function goBack() {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace("/");
  }

  if (isWideWeb) {
    return (
      <View>
        <DesktopTopBar />

        {/* HEADER: logo · search · actions */}
        <View style={{ alignItems: "center", backgroundColor: colors.surface, flexDirection: "row", gap: 28, paddingHorizontal: 32, paddingVertical: 14, position: "relative", zIndex: 30 }}>
          <Link href="/" asChild>
            <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              <Brand3DMark size={38} />
              <View style={{ gap: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 22, fontWeight: "900" }}>ortaksat</Text>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{t("appSlogan")}</Text>
              </View>
            </Pressable>
          </Link>
          <View style={{ flexShrink: 1, maxWidth: 640, minWidth: 220, width: 640 }}>
            <GlobalSearchBar />
          </View>
          {/* Boşluk: aksiyonları en sağa sabitler */}
          <View style={{ flex: 1, minWidth: 16 }} />
          <DesktopActions />
        </View>

        {/* NAV BAR: tabs + primary CTAs */}
        <View style={{ alignItems: "center", backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, borderTopColor: colors.line, borderTopWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 32, paddingVertical: 8, position: "relative", zIndex: 1 }}>
          {navItems.map((item) => {
            const active = item.match(pathname);
            return (
              <Link key={item.label} href={item.href} asChild>
                <Pressable style={{ alignItems: "center", backgroundColor: active ? colors.primarySoft : "transparent", borderRadius: 999, flexDirection: "row", gap: 3, paddingHorizontal: 14, paddingVertical: 9 }}>
                  <Text numberOfLines={1} style={{ color: active ? colors.primaryDark : colors.ink, fontSize: 14, fontWeight: active ? "900" : "700" }}>{item.label}</Text>
                  {item.caret ? <MaterialCommunityIcons name="chevron-down" size={16} color={colors.muted} /> : null}
                </Pressable>
              </Link>
            );
          })}
          <View style={{ flex: 1 }} />
          <Link href="/create" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 9 }}>
              <MaterialCommunityIcons name="store-plus-outline" size={16} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>İlan Ver</Text>
            </Pressable>
          </Link>
          <Link href="/partner" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.primary, borderRadius: 10, borderWidth: 1.5, flexDirection: "row", gap: 6, paddingHorizontal: 16, paddingVertical: 8 }}>
              <MaterialCommunityIcons name="handshake-outline" size={16} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "900" }}>Ortak Satıcı Ol</Text>
            </Pressable>
          </Link>
        </View>
      </View>
    );
  }

  // --- Mobile / native header ---
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
        <Link href="/" asChild>
          <Pressable style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: 10, minWidth: 0 }}>
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
        <HeaderActions />
      </View>
      <GlobalSearchBar />
    </View>
  );
}

function DesktopActions() {
  const { currentUser, messages, notifications } = useStore();
  const unreadMessages = messages.filter((m) => m.receiverId === currentUser.id && !m.read).length;
  const unreadNotifications = notifications.filter((n) => n.userId === currentUser.id && !n.read).length;

  const items: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; href: Href; badge?: number }> = [
    { icon: "heart-outline", label: "Favorilerim", href: "/favorites" },
    { icon: "message-text-outline", label: "Mesajlar", href: "/messages", badge: unreadMessages },
    { icon: "bell-outline", label: "Bildirim", href: "/notifications-tab", badge: unreadNotifications }
  ];

  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 18 }}>
      {items.map((item) => (
        <Link key={item.label} href={item.href} asChild>
          <Pressable style={{ alignItems: "center", gap: 2 }}>
            <View>
              <MaterialCommunityIcons name={item.icon} size={22} color={colors.primaryDark} />
              {item.badge ? (
                <View style={{ alignItems: "center", backgroundColor: colors.accent, borderColor: "#FFFFFF", borderRadius: 999, borderWidth: 1, minWidth: 16, paddingHorizontal: 3, position: "absolute", right: -8, top: -6 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "900" }}>{item.badge > 9 ? "9+" : item.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{item.label}</Text>
          </Pressable>
        </Link>
      ))}
      <AccountMenu />
    </View>
  );
}

type AccountItem = { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; href: Href; tint?: string; color?: string };

function AccountMenu() {
  const [open, setOpen] = useState(false);
  const { isAuthenticated, currentUser } = useStore();

  // Gruplanmış menü: hesap · yönetim · oturum. Her grup arasında ince ayraç.
  const groups: AccountItem[][] = [
    [
      { icon: "account-circle-outline", label: "Profilim", href: "/profile" },
      { icon: "view-list-outline", label: "İlanlarım", href: "/seller" },
      { icon: "handshake-outline", label: "Ortak Satışlarım", href: "/partner" },
      { icon: "cash-multiple", label: "Kazançlarım", href: "/earnings" },
      { icon: "heart-outline", label: "Favorilerim", href: "/favorites" },
      { icon: "message-text-outline", label: "Mesajlarım", href: "/messages" }
    ],
    [
      { icon: "shield-check-outline", label: "Güven Merkezi", href: "/trust" },
      { icon: "cog-outline", label: "Ayarlar", href: "/profile-edit" },
      { icon: "shield-crown-outline", label: "Yönetim Paneli", href: "/admin" },
      { icon: "file-document-outline", label: "Yasal & Destek", href: "/legal" }
    ]
  ];

  return (
    <View style={{ position: "relative", zIndex: open ? 1000 : 1 }}>
      <Pressable onPress={() => setOpen((o) => !o)} style={{ alignItems: "center", backgroundColor: open ? colors.primarySoft : colors.surface, borderColor: open ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 12, paddingVertical: 7 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 26, justifyContent: "center", width: 26 }}>
          <MaterialCommunityIcons name="account" size={17} color={colors.primaryDark} />
        </View>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>Hesabım</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
      </Pressable>
      {open ? (
        <>
          <Pressable onPress={() => setOpen(false)} style={{ bottom: -3000, left: -3000, position: "absolute", right: -3000, top: -3000, zIndex: 900 }} />
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, overflow: "hidden", position: "absolute", right: 0, shadowColor: "#101828", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.18, shadowRadius: 30, top: 50, width: 268, zIndex: 1000 }}>
            {/* Başlık */}
            <View style={{ alignItems: "center", backgroundColor: colors.primaryDark, flexDirection: "row", gap: 11, paddingHorizontal: 15, paddingVertical: 13 }}>
              <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 999, height: 40, justifyContent: "center", width: 40 }}>
                <MaterialCommunityIcons name="account" size={22} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{isAuthenticated ? currentUser.name : "Hesabım"}</Text>
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.72)", fontSize: 11.5, fontWeight: "700" }}>{isAuthenticated ? "Hesabını yönet" : "Giriş yapmadın"}</Text>
              </View>
            </View>

            {groups.map((group, gi) => (
              <View key={gi} style={{ borderTopColor: colors.line, borderTopWidth: gi === 0 ? 0 : 1, paddingVertical: 5 }}>
                {group.map((item) => (
                  <Link key={item.label} href={item.href} asChild>
                    <Pressable onPress={() => setOpen(false)} style={({ pressed }) => ({ backgroundColor: pressed ? colors.primarySoft : "transparent", paddingHorizontal: 13, paddingVertical: 9 })}>
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 11 }}>
                        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 30, justifyContent: "center", width: 30 }}>
                          <MaterialCommunityIcons name={item.icon} size={16} color={colors.primaryDark} />
                        </View>
                        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "700" }}>{item.label}</Text>
                      </View>
                    </Pressable>
                  </Link>
                ))}
              </View>
            ))}

            {/* Oturum aksiyonu */}
            <View style={{ borderTopColor: colors.line, borderTopWidth: 1, padding: 10 }}>
              <Link href="/auth" asChild>
                <Pressable onPress={() => setOpen(false)} style={({ pressed }) => ({ backgroundColor: pressed ? colors.primaryDark : colors.primary, borderRadius: 10, paddingVertical: 11 })}>
                  <View style={{ alignItems: "center", flexDirection: "row", gap: 8, justifyContent: "center" }}>
                    <MaterialCommunityIcons name={isAuthenticated ? "account-cog-outline" : "login"} size={17} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{isAuthenticated ? "Hesap ayarları" : "Giriş / Kayıt ol"}</Text>
                  </View>
                </Pressable>
              </Link>
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

function DesktopTopBar() {
  const trust: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string }> = [
    { icon: "shield-check", label: "Komisyon kayıt altında" },
    { icon: "swap-horizontal", label: "Şeffaf süreç" },
    { icon: "account-check", label: "Doğrulanmış satıcılar" },
    { icon: "message-text-outline", label: "İlan üzerinden iletişim" }
  ];
  const right: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; href: Href }> = [
    { icon: "lifebuoy", label: "Yardım", href: "/legal" },
    { icon: "package-variant-closed", label: "İlan Takibi", href: "/partner" }
  ];
  return (
    <View style={{ alignItems: "center", backgroundColor: colors.primaryDark, flexDirection: "row", gap: 20, paddingHorizontal: 32, paddingVertical: 7 }}>
      {trust.map((item) => (
        <View key={item.label} style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
          <MaterialCommunityIcons name={item.icon} size={13} color="rgba(255,255,255,0.85)" />
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" }}>{item.label}</Text>
        </View>
      ))}
      <View style={{ flex: 1 }} />
      {right.map((item) => (
        <Link key={item.label} href={item.href} asChild>
          <Pressable style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
            <MaterialCommunityIcons name={item.icon} size={13} color="rgba(255,255,255,0.85)" />
            <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" }}>{item.label}</Text>
          </Pressable>
        </Link>
      ))}
      <View style={{ alignItems: "center", flexDirection: "row", gap: 5 }}>
        <MaterialCommunityIcons name="web" size={13} color="rgba(255,255,255,0.85)" />
        <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "600" }}>Türkçe / ₺</Text>
        <MaterialCommunityIcons name="chevron-down" size={14} color="rgba(255,255,255,0.7)" />
      </View>
    </View>
  );
}
