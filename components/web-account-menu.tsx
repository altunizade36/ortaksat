import { useState } from "react";
import { Link, type Href } from "expo-router";
import { Pressable, Text, View } from "react-native";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { colors } from "@/components/colors";
import { useStore } from "@/lib/use-store";
import { translateCopy, useLanguage } from "@/lib/i18n";

type Item = { label: string; href: Href; icon: keyof typeof Icon.glyphMap };
const discover: Item[] = [
  { label: "İlanları keşfet", href: "/explore", icon: "magnify" },
  { label: "Ortak satış fırsatları", href: "/partner", icon: "handshake-outline" },
  { label: "Tüm kategoriler", href: "/kategoriler", icon: "view-grid-outline" },
  { label: "Nasıl çalışır?", href: "/nasil-calisir", icon: "help-circle-outline" },
];
const account: Item[] = [
  { label: "İlanlarım", href: "/seller", icon: "format-list-bulleted" },
  { label: "Favorilerim", href: "/favorites", icon: "heart-outline" },
  { label: "Mesajlarım", href: "/messages", icon: "message-outline" },
  { label: "Bildirimlerim", href: "/notifications", icon: "bell-outline" },
  { label: "Ortaklıklarım", href: { pathname: "/partner", params: { tab: "active" } } as Href, icon: "account-group-outline" },
  { label: "Kazançlarım", href: "/earnings", icon: "cash-multiple" },
  { label: "Hesap ayarları", href: "/account-settings", icon: "cog-outline" },
];
const help: Item[] = [
  { label: "Yardım merkezi", href: "/sss", icon: "lifebuoy" },
  { label: "İletişim", href: "/iletisim", icon: "email-outline" },
  { label: "Hakkımızda", href: "/hakkimizda", icon: "information-outline" },
  { label: "Gizlilik ve KVKK", href: "/kvkk", icon: "shield-outline" },
];
const more: Item[] = [
  { label: "Profilim", href: "/profile", icon: "account-outline" },
  { label: "Tekliflerim", href: "/offers", icon: "tag-outline" },
  { label: "Takip ettiklerin", href: "/following", icon: "storefront-outline" },
  { label: "Hesap güvenliği", href: "/account-security", icon: "shield-lock-outline" },
];

/** Shared mobile-browser navigation: category browsing has its own destination. */
export function WebAccountMenu({ onNavigate }: { onNavigate?: () => void }) {
  const { isAuthenticated, currentUser } = useStore();
  const { language } = useLanguage();
  const [helpOpen, setHelpOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const tr = (text: string) => translateCopy(text, language);
  function item(item: Item) {
    return <Link key={item.label} href={item.href} asChild><Pressable onPress={onNavigate} accessibilityRole="link" accessibilityLabel={tr(item.label)} style={{ minHeight: 49, flexDirection: "row", alignItems: "center", gap: 12, borderBottomWidth: 1, borderBottomColor: colors.line, paddingHorizontal: 12, paddingVertical: 10 }}>
      <Icon name={item.icon} size={21} color={colors.primaryDark}/>
      <Text style={{ flex: 1, minWidth: 0, color: colors.ink, fontSize: 14, fontWeight: "600" }}>{tr(item.label)}</Text>
      <Icon name="chevron-right" size={18} color={colors.muted}/>
    </Pressable></Link>;
  }
  return <View testID="web-account-menu" style={{ padding: 16, gap: 18, width: "100%", maxWidth: 640, alignSelf: "center" }}>
    <View style={{ backgroundColor: colors.primarySoft, borderRadius: 16, padding: 16, gap: 10 }}>
      <Text accessibilityRole="header" numberOfLines={2} style={{ fontSize: 20, fontWeight: "800", color: colors.ink }}>{isAuthenticated ? currentUser.name : tr("OrtakSat’a hoş geldin")}</Text>
      <Text style={{ fontSize: 13, lineHeight: 20, color: colors.muted }}>{tr("İlan ver, satış ortağı bul veya alıcı yönlendirerek komisyon kazan.")}</Text>
      {!isAuthenticated ? <View style={{ flexDirection: "row", gap: 8 }}>{[{ label: "Giriş yap", href: "/auth" }, { label: "Kayıt ol", href: "/auth?mode=register" }].map((entry, index) => <Link key={entry.label} href={entry.href as Href} asChild><Pressable onPress={onNavigate} style={{ flex: 1, minHeight: 44, alignItems: "center", justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: colors.primary, backgroundColor: index ? colors.surface : colors.primary }}><Text style={{ color: index ? colors.primaryDark : "#FFFFFF", fontWeight: "700", fontSize: 14 }}>{tr(entry.label)}</Text></Pressable></Link>)}</View> : null}
    </View>
    <View><Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 7 }}>{tr("KEŞFET VE KAZAN")}</Text>{discover.map(item)}</View>
    {isAuthenticated ? <View><Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700", marginBottom: 7 }}>{tr("HESABIM")}</Text>{account.map(item)}{["admin", "super_admin", "moderator"].includes(currentUser.role ?? "") ? item({ label: "Yönetim paneli", href: "/admin", icon: "shield-crown-outline" }) : null}</View> : null}
    {isAuthenticated ? <View><Pressable accessibilityRole="button" accessibilityLabel={tr("Diğer hesap işlemleri")} accessibilityState={{ expanded: moreOpen }} onPress={() => setMoreOpen(value => !value)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>{tr("Diğer hesap işlemleri")}</Text><Icon name={moreOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.muted}/></Pressable>{moreOpen ? more.map(item) : null}</View> : null}
    <View><Pressable accessibilityRole="button" accessibilityLabel={tr("Yardım ve bilgi")} accessibilityState={{ expanded: helpOpen }} onPress={() => setHelpOpen(value => !value)} style={{ minHeight: 48, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ color: colors.ink, fontSize: 14, fontWeight: "700" }}>{tr("Yardım ve bilgi")}</Text><Icon name={helpOpen ? "chevron-up" : "chevron-down"} size={20} color={colors.muted}/></Pressable>{helpOpen ? help.map(item) : null}</View>
  </View>;
}
