import type { ReactNode } from "react";
import { Link, type Href } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";
import { MaterialCommunityIcons as Icon } from "@/components/icons";
import { colors } from "@/components/colors";
import { Seo } from "@/components/seo";
import { WebFooter } from "@/components/web-landing";
import { MobileBottomNav, MobileScreen } from "@/components/mobile/ui";
import { isMobileApp } from "@/lib/mobile-app";
import { translateCopy, useLanguage } from "@/lib/i18n";

export function InformationPage({ title, intro, path, seoTitle, icon = "information-outline", children }: {
  title: string; intro: string; path: string;
  seoTitle?: string; icon?: keyof typeof Icon.glyphMap; children: ReactNode;
}) {
  const { language } = useLanguage();
  const t = (text: string) => translateCopy(text, language);
  const content = <View style={{ width: "100%", alignSelf: "center", maxWidth: 960, gap: 18, paddingTop: 12, paddingHorizontal: isMobileApp ? 0 : 16, paddingBottom: 22 }}>
    <Seo title={seoTitle || `${title} | OrtakSat`} description={intro} path={path} />
    <View style={{ borderRadius: 20, padding: 22, backgroundColor: "#EAEFFA", borderWidth: 1, borderColor: "#CBD6EF", gap: 12 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 9 }}><Icon name={icon} size={25} color={colors.primaryDark} /><Text style={{ color: colors.primaryDark, fontSize: 11, fontWeight: "800", letterSpacing: 1 }}>{t("BİLGİ VE DESTEK")}</Text></View>
      <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 28, fontWeight: "900", lineHeight: 35 }}>{t(title)}</Text>
      <Text style={{ color: colors.muted, fontSize: 14, lineHeight: 22 }}>{t(intro)}</Text>
    </View>
    {children}
    <View style={{ paddingTop: 12, borderTopWidth: 1, borderColor: colors.line, gap: 10 }}><Text style={{ color: colors.muted, fontSize: 12, fontWeight: "700" }}>{t("İlgili sayfalar")}</Text><View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>{[
      ["Hakkımızda", "/hakkimizda"], ["Yardım", "/sss"], ["İletişim", "/iletisim"], ["Gizlilik", "/gizlilik-politikasi"], ["Kullanım Şartları", "/kullanim-sartlari"], ["KVKK", "/kvkk"]
    ].filter(([, href]) => href !== path).map(([label, href]) => <Link href={href as Href} key={href} asChild><Pressable accessibilityRole="link" style={{ minHeight: 44, paddingHorizontal: 12, justifyContent: "center", borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: "white" }}><Text style={{ color: colors.primaryDark, fontSize: 12 }}>{t(label)}</Text></Pressable></Link>)}</View></View>
  </View>;
  return isMobileApp ? <MobileScreen title={title} bottom={<MobileBottomNav />}>{content}</MobileScreen> : <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">{content}<WebFooter /></ScrollView>;
}
