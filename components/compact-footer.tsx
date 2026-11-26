import { Link, type Href } from "expo-router";
import { Platform, Pressable, Text, View, useWindowDimensions } from "react-native";

import { AppStoreFooterRow } from "@/components/app-store-link";
import { colors } from "@/components/colors";
import { openCookiePreferences } from "@/lib/cookie-consent";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useMounted } from "@/lib/layout";
import { isMobileApp } from "@/lib/mobile-app";

const links: Array<{ label: string; href: Href }> = [
  { label: "Hakkımızda", href: "/hakkimizda" },
  { label: "Kurumsal", href: "/kurumsal" as Href },
  { label: "Yardım", href: "/sss" },
  { label: "İletişim", href: "/iletisim" },
  { label: "Gizlilik", href: "/gizlilik-politikasi" },
  { label: "Kullanım Şartları", href: "/kullanim-sartlari" },
  { label: "KVKK", href: "/kvkk" },
  { label: "Çerez Politikası", href: "/cerez-politikasi" },
  { label: "Sözleşmeler", href: "/legal" },
  { label: "Hesap Silme", href: "/hesap-silme" as Href }
];
// "Çerez Tercihleri" bağlantı değil düğmedir: tercih panelini açar (rıza her an geri alınabilmeli). Yalnız web.
const showCookiePreferences = Platform.OS === "web" && !isMobileApp;

export function CompactFooter() {
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  // Statik web sayfalarında sunucu pencere genişliğini bilemez (0). Genişlik doğrudan stile yazılınca
  // HTML'e "width:0" gömülüyor, hidrasyon bunu düzeltmiyor ve alt bilgi 32px'lik dar bir sütuna çöküyordu
  // (Hakkımızda, KVKK, Gizlilik… tüm bilgi sayfalarında). İlk render sunucuyla aynı ("100%"), ölçü mount sonrası.
  const mounted = useMounted();
  const nestedMobile = Platform.OS !== "web" || !mounted || width < 1000;
  // UYGULAMA: site alt bilgisi (Hakkımızda · KVKK · … · © 2026) çizilmez — uygulamada web sayfası izlenimi veriyordu.
  // Aynı bağlantılar Menü → "Yasal ve Destek" altında; mağaza incelemesi için gereken hesap silme Hesap Ayarları'nda.
  if (isMobileApp) return null;
  return <View style={{ alignSelf: "center", flexShrink: 0, marginTop: "auto", paddingTop: 14, width: nestedMobile && mounted && width > 0 ? width : "100%" }}>
    <View testID="compact-footer" accessibilityLabel={translateCopy("Bilgi ve yasal bağlantılar", language)} style={{ alignItems: "center", alignSelf: "stretch", backgroundColor: "#F1F4FC", borderTopColor: colors.primary, borderTopWidth: 2, flexGrow: 0, flexShrink: 0, gap: 2, justifyContent: "center", minHeight: nestedMobile ? 132 : 112, paddingHorizontal: 16, paddingVertical: 10 }}>
      {/* Uygulama bağlantısı: sunucu anahtarı kapalıyken hiçbir şey çizmez (bkz. components/app-store-link.tsx). */}
      <AppStoreFooterRow compact={nestedMobile} />
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", maxWidth: 860 }}>
        {links.map((link, index) => <View key={link.href as string} style={{ alignItems: "center", flexDirection: "row" }}>
          {index > 0 ? <Text importantForAccessibility="no" accessibilityElementsHidden style={{ color: "#9AABD0", fontSize: 11 }}>·</Text> : null}
          <Link href={link.href} asChild><Pressable accessibilityRole="link" style={{ justifyContent: "center", minHeight: 36, paddingHorizontal: 9 }}><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "700", textAlign: "center" }}>{translateCopy(link.label, language)}</Text></Pressable></Link>
        </View>)}
        {showCookiePreferences ? <View style={{ alignItems: "center", flexDirection: "row" }}>
          <Text importantForAccessibility="no" accessibilityElementsHidden style={{ color: "#9AABD0", fontSize: 11 }}>·</Text>
          <Pressable testID="footer-cookie-preferences" accessibilityRole="button" onPress={openCookiePreferences} style={{ justifyContent: "center", minHeight: 36, paddingHorizontal: 9 }}><Text style={{ color: colors.primaryDark, fontSize: 12, fontWeight: "700", textAlign: "center" }}>{translateCopy("Çerez Tercihleri", language)}</Text></Pressable>
        </View> : null}
      </View>
      {/* Aracı platform bilgilendirmesi (kendi metnimiz): ilan içeriğinin sorumlusu ve para akışı tek cümlede. */}
      <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 4, maxWidth: 760, textAlign: "center" }}>{translateCopy("OrtakSat aracı bir ilan platformudur. İlanların içeriğinden ve doğruluğundan ilanı veren kullanıcı sorumludur; satış, ödeme ve teslimat taraflar arasında gerçekleşir.", language)}</Text>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 1, textAlign: "center" }}>© 2026 OrtakSat</Text>
    </View>
  </View>;
}
