import { MaterialCommunityIcons } from "@/components/icons";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BrandMark } from "@/components/brand/brand-mark";
import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useStore } from "@/lib/use-store";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type NavItem = { label: string; href: Href; icon: IconName; badge?: number };

/**
 * Mobil web üst-menü (hamburger). Alt tab bar yerine geçer; sitenin tüm ana
 * bölümlerine buradan erişilir — daha "web sitesi" gibi bir gezinme.
 */
export function MobileNavMenu() {
  const { language } = useLanguage();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated, currentUser, messages, notifications, signOut } = useStore();
  const [open, setOpen] = useState(false);

  const unreadMsg = messages.filter((m) => m.receiverId === currentUser.id && !m.read).length;
  const unreadNotif = notifications.filter((n) => n.userId === currentUser.id && !n.read).length;

  const primary: NavItem[] = [
    { label: "Ana Sayfa", href: "/", icon: "home-outline" },
    { label: "Keşfet", href: "/explore", icon: "play-box-multiple-outline" },
    { label: "Kategoriler", href: "/kategoriler", icon: "shape-outline" },
    { label: "İlan Ver", href: "/create", icon: "store-plus-outline" },
    { label: "Ortak Satış Fırsatları", href: "/partner", icon: "handshake-outline" }
  ];
  const account: NavItem[] = [
    { label: "Favorilerim", href: "/favorites", icon: "heart-outline" },
    { label: "Takip Ettiklerin", href: "/following", icon: "storefront-check-outline" },
    { label: "Tekliflerim", href: "/offers", icon: "tag-outline" },
    { label: "Mesajlar", href: "/(tabs)/messages", icon: "message-text-outline", badge: unreadMsg },
    { label: "Bildirimler", href: "/(tabs)/notifications-tab", icon: "bell-outline", badge: unreadNotif },
    { label: "Satıcı Panelim", href: "/(tabs)/seller", icon: "storefront-outline" },
    { label: "Profilim", href: "/(tabs)/profile", icon: "account-circle-outline" },
    { label: "Menü & Ayarlar", href: "/(tabs)/menu", icon: "cog-outline" }
  ];

  function go(href: Href) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${translateCopy("Menü", language)}${unreadMsg + unreadNotif > 0 ? ` — ${unreadMsg + unreadNotif} ${translateCopy("okunmamış", language)}` : ""}`}
        hitSlop={10}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 38, justifyContent: "center", opacity: pressed ? 0.7 : 1, width: 38 })}
      >
        <MaterialCommunityIcons name="menu" size={22} color={colors.primaryDark} />
        {/* Okunmamış mesaj/bildirim rozeti: mobilde tek bakışta görünsün (masaüstü
            header ikonlarındaki rozetin karşılığı; hamburger'da saklı kalmasın). */}
        {unreadMsg + unreadNotif > 0 ? (
          <View style={{ alignItems: "center", backgroundColor: colors.accent, borderColor: "#FFFFFF", borderRadius: 999, borderWidth: 1.5, height: 16, justifyContent: "center", minWidth: 16, paddingHorizontal: 3, position: "absolute", right: -5, top: -5 }}>
            <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "900" }}>{unreadMsg + unreadNotif > 9 ? "9+" : unreadMsg + unreadNotif}</Text>
          </View>
        ) : null}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ backgroundColor: "rgba(16,24,40,0.5)", flex: 1, flexDirection: "row" }}>
          <View style={{ backgroundColor: colors.background, maxWidth: 340, paddingTop: insets.top + 10, width: "86%" }}>
            {/* Başlık */}
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10, paddingBottom: 12, paddingHorizontal: 16 }}>
              {/* Gerçek marka logosu (eskiden jenerik vektör "handshake" ikonuydu). */}
              <BrandMark size={40} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: colors.primaryDark, fontSize: 18, fontWeight: "900" }}>ortaksat</Text>
                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{isAuthenticated ? currentUser.name : translateCopy("Ortak satışla kazan", language)}</Text>
              </View>
              <Pressable accessibilityLabel={translateCopy("Kapat", language)} hitSlop={10} onPress={() => setOpen(false)} style={{ alignItems: "center", height: 36, justifyContent: "center", width: 36 }}>
                <MaterialCommunityIcons name="close" size={24} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
              <View style={{ backgroundColor: colors.line, height: 1, marginBottom: 6 }} />
              {primary.map((item) => <Row key={item.label} item={item} onPress={() => go(item.href)} />)}
              <View style={{ backgroundColor: colors.line, height: 1, marginVertical: 6 }} />
              {account.map((item) => <Row key={item.label} item={item} onPress={() => go(item.href)} />)}
              <View style={{ backgroundColor: colors.line, height: 1, marginVertical: 6 }} />
              {isAuthenticated ? (
                <Row item={{ label: "Çıkış Yap", href: "/", icon: "logout" }} danger onPress={() => { setOpen(false); void signOut(); }} />
              ) : (
                <Row item={{ label: "Giriş Yap / Kayıt Ol", href: "/auth", icon: "login" }} accent onPress={() => go("/auth")} />
              )}
            </ScrollView>
          </View>

          {/* Sağ boşluğa dokununca kapat */}
          <Pressable accessibilityLabel={translateCopy("Menüyü kapat", language)} onPress={() => setOpen(false)} style={{ flex: 1 }} />
        </View>
      </Modal>
    </>
  );
}

function Row({ item, onPress, danger, accent }: { item: NavItem; onPress: () => void; danger?: boolean; accent?: boolean }) {
  const { language } = useLanguage();
  const color = danger ? colors.accent : accent ? colors.primaryDark : colors.ink;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={translateCopy(item.label, language)}
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : "transparent", flexDirection: "row", gap: 13, paddingHorizontal: 16, paddingVertical: 13 })}
    >
      <MaterialCommunityIcons name={item.icon} size={21} color={danger ? colors.accent : colors.primary} />
      <Text style={{ color, flex: 1, fontSize: 14.5, fontWeight: "800" }}>{translateCopy(item.label, language)}</Text>
      {item.badge && item.badge > 0 ? (
        <View style={{ alignItems: "center", backgroundColor: colors.accent, borderRadius: 999, minWidth: 20, paddingHorizontal: 6, paddingVertical: 1 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 11, fontWeight: "900" }}>{item.badge > 9 ? "9+" : item.badge}</Text>
        </View>
      ) : (
        <MaterialCommunityIcons name="chevron-right" size={18} color={colors.subtle} />
      )}
    </Pressable>
  );
}
