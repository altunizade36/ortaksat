import { MaterialCommunityIcons } from "@/components/icons";
import { Link, usePathname, useRouter, type Href } from "expo-router";
import { Image } from "expo-image";
import { useState } from "react";
import { Pressable, ScrollView, Text, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { colors } from "@/components/colors";
import { PressLink } from "@/components/ui";
import { GlobalSearchBar } from "@/components/global-search-bar";
import { MobileNavMenu } from "@/components/mobile-nav-menu";
import { HeaderActions } from "@/components/header-actions";
import { BrandMark } from "@/components/brand/brand-mark";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";
import { useStore } from "@/lib/use-store";

type NavItem = { href: Href; label: string; match: (path: string) => boolean; caret?: boolean };

export function AppHeader() {
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const router = useRouter();
  const { language, t } = useLanguage();
  const isWideWeb = useIsWideWeb();
  const isHome = pathname === "/" || pathname === "/index";
  const showBack = !isWideWeb && !isHome;
  // Masaüstünde de alt sayfalarda (ilan detayı, sohbet, mağaza, form ekranları…)
  // geri butonu göster ki kullanıcı tarayıcı geri tuşuna muhtaç kalmasın.
  const showDesktopBack = isWideWeb && !isHome && router.canGoBack();

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
        <MaintenanceBanner />
        {/* Tek temiz üst bar: [geri] · logo · arama · aksiyonlar */}
        <View style={{ alignItems: "center", backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 24, paddingHorizontal: 28, paddingVertical: 12, position: "relative", zIndex: 30 }}>
          {showDesktopBack ? (
            <Pressable
              accessibilityLabel={translateCopy("Geri", language)}
              accessibilityRole="button"
              onPress={goBack}
              style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 5, marginRight: -14, opacity: pressed ? 0.75 : 1, paddingHorizontal: 12, paddingVertical: 9 })}
            >
              <MaterialCommunityIcons name="chevron-left" size={20} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 13, fontWeight: "800" }}>{translateCopy("Geri", language)}</Text>
            </Pressable>
          ) : null}
          <Link href="/" asChild>
            <Pressable accessibilityRole="link" accessibilityLabel={translateCopy("OrtakSat ana sayfa", language)} style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              <BrandMark size={40} />
              <View style={{ gap: 1 }}>
                <Text numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 22, fontWeight: "900" }}>ortaksat</Text>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{t("appSlogan")}</Text>
              </View>
            </Pressable>
          </Link>
          <View style={{ flexShrink: 1, maxWidth: 640, minWidth: 168, width: 640 }}>
            <GlobalSearchBar />
          </View>
          {/* Boşluk: aksiyonları en sağa sabitler (minWidth 0 → dar tablette 3px taşmayı emer) */}
          <View style={{ flex: 1, minWidth: 0 }} />
          <DesktopActions />
        </View>
        {/* İkincil yatay gezinme çubuğu — masaüstünde ana bölümlere tek tıkla erişim.
            Her öğe SABİT yükseklikte (44) ve içeriği ortalı; böylece caret'li
            "Kategoriler" dahil hepsi aynı hizada durur, eşit aralıklı. */}
        <View style={{ backgroundColor: colors.surface, borderBottomColor: colors.line, borderBottomWidth: 1, flexDirection: "row", gap: 6, paddingHorizontal: 22, zIndex: 20 }}>
          {navItems.map((item) => {
            const active = item.match(pathname);
            // Düz Pressable + router.push: Link asChild sarmalayınca Pressable'ın
            // padding'i düşüyordu (öğeler yapışıyordu). Bu yol eşit aralığı garanti eder.
            return (
              <Pressable
                key={item.label}
                accessibilityRole="link"
                onPress={() => router.push(item.href as never)}
                style={({ pressed }) => ({
                  alignItems: "center",
                  borderBottomColor: active ? colors.primary : "transparent",
                  borderBottomWidth: 2,
                  flexDirection: "row",
                  gap: 4,
                  height: 46,
                  justifyContent: "center",
                  opacity: pressed ? 0.7 : 1,
                  paddingHorizontal: 16
                })}
              >
                <Text numberOfLines={1} style={{ color: active ? colors.primaryDark : colors.ink, fontSize: 14, fontWeight: active ? "900" : "700", lineHeight: 18 }}>{translateCopy(item.label, language)}</Text>
                {item.caret ? <MaterialCommunityIcons name="chevron-down" size={16} color={active ? colors.primaryDark : colors.muted} style={{ marginTop: 1 }} /> : null}
              </Pressable>
            );
          })}
          <View style={{ flex: 1, minWidth: 8 }} />
        </View>
      </View>
    );
  }

  // --- Mobile / native header --- (temiz beyaz üst bar; normal web sitesi görünümü)
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderBottomColor: colors.line,
        borderBottomWidth: 1,
        gap: 7,
        paddingBottom: 8,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: insets.top + 6
      }}
    >
      <MaintenanceBanner />
      <View style={{ alignItems: "center", flexDirection: "row", minHeight: 44, overflow: "hidden" }}>
        {showBack ? (
          // 44×44 şeffaf dokunma hedefi (Apple HIG); görsel daire 34px iç View'de.
          <Pressable
            accessibilityLabel={translateCopy("Geri", language)}
            accessibilityRole="button"
            hitSlop={6}
            onPress={goBack}
            style={({ pressed }) => ({ alignItems: "center", justifyContent: "center", marginRight: 4, minHeight: 44, minWidth: 44, opacity: pressed ? 0.7 : 1, zIndex: 2 })}
          >
            <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 34, justifyContent: "center", width: 34 }}>
              <MaterialCommunityIcons name="chevron-left" size={22} color={colors.primaryDark} />
            </View>
          </Pressable>
        ) : null}
        {!showBack ? <View style={{ marginRight: 8, zIndex: 2 }}><MobileNavMenu /></View> : null}
        <Link href="/" asChild>
          <Pressable accessibilityRole="link" accessibilityLabel={translateCopy("OrtakSat ana sayfa", language)} style={{ alignItems: "center", flex: 1, flexDirection: "row", gap: 9, minWidth: 0 }}>
            <BrandMark size={36} />
            {/* flex:1 ŞART: minWidth:0 tek başına RNW'de no-op (View zaten flexShrink:0) →
                kutu max-content kalıyor, 320-375px'te "ortaksat"+slogan header butonlarının
                ALTINA giriyordu (390px'te kıl payı sığdığı için testlerde görünmedi). */}
            <View style={{ flex: 1, gap: 0, minWidth: 0 }}>
              <Text selectable numberOfLines={1} style={{ color: colors.primaryDark, fontSize: 18, fontWeight: "900", letterSpacing: 0 }}>
                ortaksat
              </Text>
              <Text selectable numberOfLines={1} style={{ color: colors.muted, fontSize: 11, fontWeight: "800" }}>
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

// Görünür TR/EN dil değiştirici — yabancı ziyaretçi ana sayfada anında bulabilsin.

function MaintenanceBanner() {
  const { language } = useLanguage();
  const { platformSettings, currentUser, isSuspended } = useStore();
  // Askıya alınan kullanıcıya her sayfada net uyarı.
  if (isSuspended) {
    return (
      <View style={{ alignItems: "center", backgroundColor: colors.accent, flexDirection: "row", gap: 8, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 7 }}>
        <MaterialCommunityIcons name="account-cancel-outline" size={15} color="#FFFFFF" />
        <Text style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "800", textAlign: "center" }}>
          {translateCopy("Hesabın askıya alındı. İlan verme, mesajlaşma ve ortaklık işlemleri geçici olarak kapalı. Destek için Yasal & Destek sayfasına bakabilirsin.", language)}
        </Text>
      </View>
    );
  }
  const isStaff = currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin";
  // Admin duyurusu (bakim modundan bagimsiz, ozel metin).
  if (platformSettings.announcementActive && platformSettings.announcement.trim()) {
    return (
      <View style={{ alignItems: "center", backgroundColor: colors.primaryDark, flexDirection: "row", gap: 8, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 7 }}>
        <MaterialCommunityIcons name="bullhorn-outline" size={15} color="#FFFFFF" />
        <Text numberOfLines={2} style={{ color: "#FFFFFF", fontSize: 12.5, fontWeight: "800", textAlign: "center" }}>{platformSettings.announcement.trim()}</Text>
      </View>
    );
  }
  if (!platformSettings.maintenanceMode) return null;
  return (
    <View style={{ alignItems: "center", backgroundColor: isStaff ? colors.goldSoft : colors.accent, flexDirection: "row", gap: 8, justifyContent: "center", paddingHorizontal: 16, paddingVertical: 7 }}>
      <MaterialCommunityIcons name="wrench-outline" size={15} color={isStaff ? colors.gold : "#FFFFFF"} />
      <Text style={{ color: isStaff ? colors.ink : "#FFFFFF", fontSize: 12.5, fontWeight: "800", textAlign: "center" }}>
        {isStaff ? translateCopy("Bakım modu AÇIK — ziyaretçilere bakım uyarısı gösteriliyor.", language) : translateCopy("Sitemiz kısa süreli bakımda. Bazı işlemler geçici olarak sınırlı olabilir.", language)}
      </Text>
    </View>
  );
}

function DesktopActions() {
  const { language } = useLanguage();
  const { currentUser, isAuthenticated, messages, notifications } = useStore();
  const unreadMessages = messages.filter((m) => m.receiverId === currentUser.id && !m.read).length;
  const unreadNotifications = notifications.filter((n) => n.userId === currentUser.id && !n.read).length;

  // Girişsizken belirgin "Giriş / Kayıt ol" butonu göster (kullanıcı giriş
  // noktasını kolayca bulsun). Girişliyken hesap ikonları + Hesabım menüsü.
  if (!isAuthenticated) {
    // Sahibinden mantığı: sade "Giriş yap | Kayıt ol" metin linkleri + EN BELİRGİN
    // "Ücretsiz İlan Ver" butonu (arz tarafının #1 CTA'sı). Butona basınca /create'e
    // gider; anonim form doldurulur, kapı yalnız Yayınla anında (kayıt/giriş) çıkar.
    return (
      <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
        <PressLink href="/auth" accessibilityLabel={translateCopy("Giriş yap", language)} pressedOpacity={0.7} style={{ paddingHorizontal: 3, paddingVertical: 8 }}>
          <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy("Giriş yap", language)}</Text>
        </PressLink>
        <View style={{ backgroundColor: colors.line, height: 16, width: 1 }} />
        <PressLink href="/auth" accessibilityLabel={translateCopy("Kayıt ol", language)} pressedOpacity={0.7} style={{ paddingHorizontal: 3, paddingVertical: 8 }}>
          <Text numberOfLines={1} style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy("Kayıt ol", language)}</Text>
        </PressLink>
        <PressLink href="/create" accessibilityLabel={translateCopy("Ücretsiz İlan Ver", language)} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 14, paddingVertical: 10 }}>
          <MaterialCommunityIcons name="plus-box" size={18} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Ücretsiz İlan Ver", language)}</Text>
        </PressLink>
      </View>
    );
  }

  const items: Array<{ icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; href: Href; badge?: number }> = [
    { icon: "plus-box-outline", label: "İlan Ver", href: "/create" },
    { icon: "heart-outline", label: "Favorilerim", href: "/favorites" },
    { icon: "message-text-outline", label: "Mesajlar", href: "/messages", badge: unreadMessages },
    { icon: "bell-outline", label: "Bildirimler", href: "/notifications-tab", badge: unreadNotifications }
  ];

  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 18 }}>
      {items.map((item) => (
        <Link key={item.label} href={item.href} asChild>
          {/* Dokunma hedefi: ikonun kendisi 22px → kutu 20x21px oluyordu (44px erişilebilirlik
              hedefinin çok altında) ve bunlar HER ekranda duran en çok kullanılan kontroller.
              minWidth/minHeight 44 + hitSlop ile hedef büyütüldü (görsel boyut değişmiyor). */}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={translateCopy(item.label, language)}
            hitSlop={10}
            style={{ alignItems: "center", gap: 2, justifyContent: "center", minHeight: 44, minWidth: 44 }}
          >
            <View>
              <MaterialCommunityIcons name={item.icon} size={22} color={colors.primaryDark} />
              {item.badge ? (
                <View style={{ alignItems: "center", backgroundColor: colors.accent, borderColor: "#FFFFFF", borderRadius: 999, borderWidth: 1, minWidth: 16, paddingHorizontal: 3, position: "absolute", right: -8, top: -6 }}>
                  <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "900" }}>{item.badge > 9 ? "9+" : item.badge}</Text>
                </View>
              ) : null}
            </View>
            <Text style={{ color: colors.muted, fontSize: 11, fontWeight: "700" }}>{translateCopy(item.label, language)}</Text>
          </Pressable>
        </Link>
      ))}
      <AccountMenu />
    </View>
  );
}

type AccountItem = { icon: keyof typeof MaterialCommunityIcons.glyphMap; label: string; href: Href; tint?: string; color?: string; badge?: number };

function AccountMenu() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const { language } = useLanguage();
  const { height: winHeight } = useWindowDimensions();
  const { isAuthenticated, currentUser, messages, notifications, signOut } = useStore();
  const avatarIsImage = isAuthenticated && (currentUser.avatar?.startsWith("http") || currentUser.avatar?.startsWith("file"));
  const unreadMessages = messages.filter((m) => m.receiverId === currentUser.id && !m.read).length;
  const unreadNotifications = notifications.filter((n) => n.userId === currentUser.id && !n.read).length;
  const hasUnread = unreadMessages + unreadNotifications > 0;

  async function handleSignOut() {
    setOpen(false);
    await signOut();
    router.replace("/");
  }

  // Gruplanmış menü: hesap · yönetim · oturum. Her grup arasında ince ayraç.
  const groups: AccountItem[][] = [
    [
      { icon: "account-circle-outline", label: "Profilim", href: "/profile" },
      { icon: "view-list-outline", label: "İlanlarım", href: "/seller" },
      { icon: "handshake-outline", label: "Ortak Satışlarım", href: "/partner" },
      { icon: "cash-multiple", label: "Kazançlarım", href: "/earnings" },
      { icon: "heart-outline", label: "Favorilerim", href: "/favorites" },
      { icon: "storefront-check-outline", label: "Takip Ettiklerin", href: "/following" as Href },
      { icon: "message-text-outline", label: "Mesajlarım", href: "/messages", badge: unreadMessages }
    ],
    [
      { icon: "shield-check-outline", label: "Güven Merkezi", href: "/trust" },
      { icon: "cog-outline", label: "Ayarlar", href: "/profile-edit" },
      // "Yönetim Paneli" yalnızca staff'a; önceden HERKESE görünüyordu.
      ...(currentUser.role === "admin" || currentUser.role === "moderator" || currentUser.role === "super_admin"
        ? [{ icon: "shield-crown-outline", label: "Yönetim Paneli", href: "/admin" } as AccountItem]
        : []),
      { icon: "file-document-outline", label: "Yasal & Destek", href: "/legal" }
    ]
  ];

  return (
    <View style={{ position: "relative", zIndex: open ? 1000 : 1 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={translateCopy("Hesabım", language)} accessibilityState={{ expanded: open }} onPress={() => setOpen((o) => !o)} style={{ alignItems: "center", backgroundColor: open ? colors.primarySoft : colors.surface, borderColor: open ? colors.primary : colors.line, borderRadius: 999, borderWidth: 1, flexDirection: "row", gap: 7, paddingHorizontal: 12, paddingVertical: 7 }}>
        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 999, height: 26, justifyContent: "center", width: 26 }}>
          <MaterialCommunityIcons name="account" size={17} color={colors.primaryDark} />
          {hasUnread && !open ? <View style={{ backgroundColor: colors.accent, borderColor: "#FFFFFF", borderRadius: 999, borderWidth: 1, height: 10, position: "absolute", right: -2, top: -2, width: 10 }} /> : null}
        </View>
        <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{translateCopy("Hesabım", language)}</Text>
        <MaterialCommunityIcons name={open ? "chevron-up" : "chevron-down"} size={16} color={colors.muted} />
      </Pressable>
      {open ? (
        <>
          <Pressable accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden onPress={() => setOpen(false)} style={{ bottom: -3000, left: -3000, position: "absolute", right: -3000, top: -3000, zIndex: 900 }} />
          <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, maxHeight: Math.min(winHeight - 66, 640), overflow: "hidden", position: "absolute", right: 0, shadowColor: "#101828", shadowOffset: { width: 0, height: 16 }, shadowOpacity: 0.18, shadowRadius: 30, top: 50, width: 268, zIndex: 1000 }}>
            {/* Başlık */}
            <View style={{ alignItems: "center", backgroundColor: colors.primaryDark, flexDirection: "row", gap: 11, paddingHorizontal: 15, paddingVertical: 13 }}>
              <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 999, height: 40, justifyContent: "center", overflow: "hidden", width: 40 }}>
                {avatarIsImage ? (
                  <Image source={{ uri: currentUser.avatar }} contentFit="cover" style={{ height: 40, width: 40 }} />
                ) : isAuthenticated && currentUser.avatar && currentUser.avatar.length <= 3 ? (
                  <Text style={{ color: "#FFFFFF", fontSize: 17, fontWeight: "900" }}>{currentUser.avatar}</Text>
                ) : (
                  <MaterialCommunityIcons name="account" size={22} color="#FFFFFF" />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{isAuthenticated ? currentUser.name : translateCopy("Hesabım", language)}</Text>
                <Text numberOfLines={1} style={{ color: "rgba(255,255,255,0.72)", fontSize: 11.5, fontWeight: "700" }}>{isAuthenticated ? translateCopy("Hesabını yönet", language) : translateCopy("Giriş yapmadın", language)}</Text>
              </View>
            </View>

            {/* Öğeler kayan alanda: uzun menü (admin) viewport'u aşınca içeride kaydırılır
                → alttaki öğeler "takılı kalmaz/inmiyor" sorunu çözülür. Başlık + çıkış sabit. */}
            <ScrollView style={{ flexShrink: 1 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 2 }} keyboardShouldPersistTaps="handled">
            {groups.map((group, gi) => (
              <View key={gi} style={{ borderTopColor: colors.line, borderTopWidth: gi === 0 ? 0 : 1, paddingVertical: 5 }}>
                {group.map((item) => (
                  <Link key={item.label} href={item.href} asChild>
                    <Pressable
                      onPress={() => setOpen(false)}
                      style={(st) => {
                        const s = st as { pressed: boolean; hovered?: boolean };
                        return { backgroundColor: s.hovered || s.pressed ? colors.surfaceAlt : "transparent", paddingHorizontal: 13, paddingVertical: 9 };
                      }}
                    >
                      <View style={{ alignItems: "center", flexDirection: "row", gap: 11 }}>
                        <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 8, height: 30, justifyContent: "center", width: 30 }}>
                          <MaterialCommunityIcons name={item.icon} size={16} color={colors.primaryDark} />
                        </View>
                        <Text style={{ color: colors.ink, flex: 1, fontSize: 13, fontWeight: "700" }}>{translateCopy(item.label, language)}</Text>
                        {item.badge ? (
                          <View style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 999, justifyContent: "center", minWidth: 18, paddingHorizontal: 5, paddingVertical: 1 }}>
                            <Text style={{ color: "#FFFFFF", fontSize: 10, fontWeight: "900" }}>{item.badge > 9 ? "9+" : item.badge}</Text>
                          </View>
                        ) : null}
                      </View>
                    </Pressable>
                  </Link>
                ))}
              </View>
            ))}
            </ScrollView>

            {/* Oturum aksiyonu: girişliyse Çıkış Yap, değilse Giriş / Kayıt ol */}
            <View style={{ borderTopColor: colors.line, borderTopWidth: 1, padding: 10 }}>
              {isAuthenticated ? (
                <Pressable onPress={() => void handleSignOut()} style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.accentSoft : colors.surface, borderColor: colors.accent, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 })}>
                  <MaterialCommunityIcons name="logout" size={17} color={colors.accent} />
                  <Text style={{ color: colors.accent, fontSize: 13, fontWeight: "900" }}>{translateCopy("Çıkış Yap", language)}</Text>
                </Pressable>
              ) : (
                <Link href="/auth" asChild>
                  <Pressable onPress={() => setOpen(false)} style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 10, flexDirection: "row", gap: 8, justifyContent: "center", paddingVertical: 11 }}>
                    <MaterialCommunityIcons name="login" size={17} color="#FFFFFF" />
                    <Text style={{ color: "#FFFFFF", fontSize: 13, fontWeight: "900" }}>{translateCopy("Giriş / Kayıt ol", language)}</Text>
                  </Pressable>
                </Link>
              )}
            </View>
          </View>
        </>
      ) : null}
    </View>
  );
}

