import { WebAccountMenu } from "@/components/web-account-menu";
import { MaterialCommunityIcons } from "@/components/icons";
import { useRouter, type Href } from "expo-router";
import { useState } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { MobileBrand } from "@/components/mobile-brand";
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
  const { isAuthenticated, currentUser, messages, notifications, offers, signOut } = useStore();
  const [open, setOpen] = useState(false);

  const unreadMsg = messages.filter((m) => m.receiverId === currentUser.id && !m.read).length;
  const unreadNotif = notifications.filter((n) => n.userId === currentUser.id && !n.read).length;
  // Bekleyen teklif (satıcı karşı-teklif verdi, sıra bende) — masaüstü menüyle aynı rozet.
  const pendingOffers = offers.filter((o) => o.buyerId === currentUser.id && o.status === "countered").length;
  const badgeTotal = unreadMsg + unreadNotif + pendingOffers;

  function go(href: Href) {
    setOpen(false);
    router.push(href);
  }

  return (
    <>
      {/* 44×44 şeffaf dokunma hedefi; görsel daire 38px iç View'de (hitSlop web'de yetersiz). */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${translateCopy("Menü", language)}${badgeTotal > 0 ? ` — ${badgeTotal} ${translateCopy("okunmamış", language)}` : ""}`}
        hitSlop={6}
        onPress={() => setOpen(true)}
        style={({ pressed }) => ({ alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44, opacity: pressed ? 0.7 : 1 })}
      >
        <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 999, borderWidth: 1, height: 38, justifyContent: "center", width: 38 }}>
          <MaterialCommunityIcons name="menu" size={22} color={colors.primaryDark} />
          {/* Okunmamış mesaj/bildirim rozeti: mobilde tek bakışta görünsün (masaüstü
              header ikonlarındaki rozetin karşılığı; hamburger'da saklı kalmasın). */}
          {badgeTotal > 0 ? (
            <View style={{ alignItems: "center", backgroundColor: colors.accent, borderColor: "#FFFFFF", borderRadius: 999, borderWidth: 1.5, height: 16, justifyContent: "center", minWidth: 16, paddingHorizontal: 3, position: "absolute", right: -5, top: -5 }}>
              <Text style={{ color: "#FFFFFF", fontSize: 9, fontWeight: "900" }}>{badgeTotal > 9 ? "9+" : badgeTotal}</Text>
            </View>
          ) : null}
        </View>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={{ backgroundColor: "rgba(16,24,40,0.5)", flex: 1, flexDirection: "row" }}>
          <View style={{ backgroundColor: colors.background, maxWidth: 340, paddingTop: insets.top + 10, width: "86%" }}>
            {/* Başlık */}
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10, paddingBottom: 12, paddingHorizontal: 16 }}>
              {/* Gerçek marka logosu (eskiden jenerik vektör "handshake" ikonuydu). */}
              <MobileBrand size={21} />
              <View style={{ flex: 1, minWidth: 0 }}>

                <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "700" }}>{isAuthenticated ? currentUser.name : translateCopy("Ortak satışla kazan", language)}</Text>
              </View>
              <Pressable accessibilityLabel={translateCopy("Kapat", language)} hitSlop={6} onPress={() => setOpen(false)} style={{ alignItems: "center", justifyContent: "center", minHeight: 44, minWidth: 44 }}>
                <MaterialCommunityIcons name="close" size={24} color={colors.muted} />
              </Pressable>
            </View>

            <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
              <WebAccountMenu onNavigate={() => setOpen(false)} />
              {isAuthenticated ? (
                <Row item={{ label: "Çıkış Yap", href: "/", icon: "logout" }} danger onPress={() => { setOpen(false); void signOut(); router.replace("/"); }} />
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
  // İkon çipi — masaüstü Hesabım menüsüyle görsel tutarlılık (tek sistem hissi).
  const chipBg = danger ? colors.accentSoft : colors.primarySoft;
  const iconColor = danger ? colors.accent : colors.primaryDark;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={translateCopy(item.label, language)}
      onPress={onPress}
      style={({ pressed }) => ({ alignItems: "center", backgroundColor: pressed ? colors.surfaceAlt : "transparent", flexDirection: "row", gap: 12, paddingHorizontal: 14, paddingVertical: 11 })}
    >
      <View style={{ alignItems: "center", backgroundColor: chipBg, borderRadius: 9, height: 34, justifyContent: "center", width: 34 }}>
        <MaterialCommunityIcons name={item.icon} size={19} color={iconColor} />
      </View>
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
