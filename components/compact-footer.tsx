import { Link, type Href } from "expo-router";
import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";

import { colors } from "@/components/colors";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useMounted } from "@/lib/layout";

const links: Array<{ label: string; href: Href }> = [
  { label: "Hakkımızda", href: "/hakkimizda" },
  { label: "Yardım", href: "/sss" },
  { label: "İletişim", href: "/iletisim" },
  { label: "Gizlilik", href: "/gizlilik-politikasi" },
  { label: "Kullanım Şartları", href: "/kullanim-sartlari" },
  { label: "KVKK", href: "/kvkk" },
  { label: "Hesap Silme", href: "/hesap-silme" as Href }
];

export function CompactFooter() {
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  // Statik web sayfalarında sunucu pencere genişliğini bilemez (0). Genişlik doğrudan stile yazılınca
  // HTML'e "width:0" gömülüyor, hidrasyon bunu düzeltmiyor ve alt bilgi 32px'lik dar bir sütuna çöküyordu
  // (Hakkımızda, KVKK, Gizlilik… tüm bilgi sayfalarında). İlk render sunucuyla aynı ("100%"), ölçü mount sonrası.
  const mounted = useMounted();
  const nestedMobile = Platform.OS !== "web" || !mounted || width < 1000;
  return <View style={{ alignSelf: "center", flexShrink: 0, marginTop: "auto", paddingTop: 14, width: nestedMobile && mounted && width > 0 ? width : "100%" }}>
    <View testID="compact-footer" accessibilityLabel={translateCopy("Bilgi ve yasal bağlantılar", language)} style={{ alignItems: "center", alignSelf: "stretch", backgroundColor: "#F1F4FC", borderTopColor: colors.primary, borderTopWidth: 2, flexGrow: 0, flexShrink: 0, gap: 2, justifyContent: "center", minHeight: nestedMobile ? 112 : 96, paddingHorizontal: 16, paddingVertical: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", maxWidth: 860 }}>
        {links.map((link, index) => <View key={link.href as string} style={{ alignItems: "center", flexDirection: "row" }}>
          {index > 0 ? <Text importantForAccessibility="no" accessibilityElementsHidden style={{ color: "#9AABD0", fontSize: 11 }}>·</Text> : null}
          <Link href={link.href} asChild><Pressable accessibilityRole="link" style={{ justifyContent: "center", minHeight: 36, paddingHorizontal: 9 }}><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "700", textAlign: "center" }}>{translateCopy(link.label, language)}</Text></Pressable></Link>
        </View>)}
      </View>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1, textAlign: "center" }}>© 2026 OrtakSat</Text>
    </View>
  </View>;
}
