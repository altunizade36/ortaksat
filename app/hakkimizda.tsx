import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import { ScrollView, Text, View } from "react-native";

import { ContentPageView } from "@/components/content-page-view";
import { colors } from "@/components/colors";
import { Seo } from "@/components/seo";
import { WebFooter } from "@/components/web-landing";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

export default function AboutScreen() {
  return <ContentPageView slug="hakkimizda" fallback={<AboutScreenStatic />} />;
}

function AboutScreenStatic() {
  const { language } = useLanguage();
  const isWideWeb = useIsWideWeb();
  const t = (s: string) => translateCopy(s, language);

  const highlights = [
    { icon: "shield-check-outline" as IconName, label: "Aracı platform" },
    { icon: "cash-remove" as IconName, label: "Para tutmaz" },
    { icon: "chart-line-variant" as IconName, label: "Sonuç-bazlı komisyon" },
    { icon: "gift-outline" as IconName, label: "Ücretsiz üyelik" }
  ];

  const sections: Array<{ icon: IconName; tint: string; color: string; heading: string; body: string }> = [
    {
      icon: "storefront-outline", tint: colors.primarySoft, color: colors.primaryDark,
      heading: "Ne yapıyoruz?",
      body: "Satıcılar ilanlarını açar ve isterse satış ortağı için komisyon belirler; ortaklar beğendikleri ürünü kendi yöntemleriyle kendi çevrelerine tanıtır. Bir satış gerçekleştiğinde ortak, satıcıyla anlaştığı komisyonu kazanır. Platform satışın nasıl yapıldığına karışmaz; zorunlu link veya takip sistemi yoktur. Talep, satış ve komisyon süreçleri tek panelde şeffaf biçimde takip edilir."
    },
    {
      icon: "account-group-outline", tint: colors.violetSoft, color: colors.violet,
      heading: "Kimler için?",
      body: "Emlakçıdan telefoncuya, bilgisayarcıdan inşaatçıya, bisiklet satıcısından moda butiğine kadar ürün veya hizmet satan herkes ortaksat'ta ilan açabilir; sosyal medyası ve çevresi güçlü olan herkes ortak olup komisyon kazanabilir."
    },
    {
      icon: "rocket-launch-outline", tint: colors.goldSoft, color: colors.gold,
      heading: "Neden OrtakSat?",
      body: "Tek bir ürünü ortak ağına taşıyarak erişimini büyütürsün. Reklam bütçesi yerine sonuç bazlı komisyon ödersin: sadece satış olduğunda ödeme yaparsın."
    }
  ];

  const roles: Array<{ icon: IconName; tint: string; color: string; title: string; sub: string }> = [
    { icon: "store-plus-outline", tint: colors.primarySoft, color: colors.primaryDark, title: "Satıcı", sub: "Ürününü ücretsiz yükler, komisyonu belirler; ortaklar satar." },
    { icon: "handshake-outline", tint: colors.violetSoft, color: colors.violet, title: "Ortak", sub: "Beğendiği ürünü kendi yöntemiyle tanıtır; satışta komisyon kazanır." },
    { icon: "cart-check", tint: colors.successSoft, color: colors.success, title: "Alıcı", sub: "Normal ilan sitesi gibi keşfeder; satıcıyla güvenle anlaşır." }
  ];

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
      <Seo title="Hakkımızda — OrtakSat ortak satış pazaryeri" description="OrtakSat, ürününü ortaklarla birlikte satmanı sağlayan komisyonlu ortak satış pazarıdır. Aracı platform; para tutmaz, sonuç-bazlı komisyon, ücretsiz üyelik." path="/hakkimizda" />
      <View style={{ alignSelf: "center", gap: 16, maxWidth: 940, paddingHorizontal: isWideWeb ? 20 : 14, paddingTop: 16, width: "100%" }}>
        {/* Breadcrumb */}
        <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
          <Link href="/" asChild><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>{t("Ana Sayfa")}</Text></Link>
          <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} />
          <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{t("Hakkımızda")}</Text>
        </View>

        {/* Hero */}
        <View style={{ backgroundColor: colors.primaryDark, borderRadius: 18, gap: 12, overflow: "hidden", padding: isWideWeb ? 26 : 18 }}>
          <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 5 }}>
            <MaterialCommunityIcons name="information-outline" size={14} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "900" }}>{t("Hakkımızda")}</Text>
          </View>
          <Text style={{ color: "#FFFFFF", fontSize: isWideWeb ? 30 : 23, fontWeight: "900", lineHeight: isWideWeb ? 36 : 29 }}>{t("Ortaklarla birlikte satış, sonuç bazlı komisyon.")}</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14.5, fontWeight: "600", lineHeight: 21, maxWidth: 620 }}>{t("ortaksat, ürününü ortaklarla birlikte satmanı sağlayan komisyonlu ortak satış pazarıdır.")}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 2 }}>
            {highlights.map((h) => (
              <View key={h.label} style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 11, paddingVertical: 6 }}>
                <MaterialCommunityIcons name={h.icon} size={14} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "800" }}>{t(h.label)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Bölümler */}
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 14 }}>
          {sections.map((s) => (
            <View key={s.heading} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 280, flexGrow: 1, gap: 10, minWidth: 0, padding: isWideWeb ? 20 : 16 }}>
              <View style={{ alignItems: "center", backgroundColor: s.tint, borderRadius: 12, height: 44, justifyContent: "center", width: 44 }}>
                <MaterialCommunityIcons name={s.icon} size={23} color={s.color} />
              </View>
              <Text style={{ color: colors.ink, fontSize: 16, fontWeight: "900" }}>{t(s.heading)}</Text>
              <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "500", lineHeight: 20 }}>{t(s.body)}</Text>
            </View>
          ))}
        </View>

        {/* Üç rol, tek akış */}
        <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, gap: 14, padding: isWideWeb ? 22 : 16 }}>
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <Text style={{ color: colors.ink, flex: 1, fontSize: 18, fontWeight: "900" }}>{t("Üç rol, tek akış")}</Text>
            <Link href="/nasil-calisir" asChild><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{t("Nasıl çalışır?")} →</Text></Link>
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {roles.map((r) => (
              <View key={r.title} style={{ backgroundColor: colors.surfaceAlt, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 220, flexGrow: 1, gap: 8, minWidth: 0, padding: 15 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
                  <View style={{ alignItems: "center", backgroundColor: r.tint, borderRadius: 10, height: 36, justifyContent: "center", width: 36 }}>
                    <MaterialCommunityIcons name={r.icon} size={19} color={r.color} />
                  </View>
                  <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{t(r.title)}</Text>
                </View>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{t(r.sub)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* İletişim */}
        <View style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 16, borderWidth: 1, gap: 10, padding: isWideWeb ? 20 : 16 }}>
          <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
            <MaterialCommunityIcons name="lifebuoy" size={22} color={colors.primaryDark} />
            <Text style={{ color: colors.ink, flex: 1, fontSize: 17, fontWeight: "900" }}>{t("İletişim & Destek")}</Text>
          </View>
          <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "500", lineHeight: 20 }}>{t("Şikayet, bilgi, yasal/KVKK başvurusu ve destek talepleri için bize e-posta ile ulaşabilirsin. OrtakSat bir aracı platformdur; çağrı merkezi/telefon hattı işletmez. Genellikle 1–3 iş günü içinde dönüş yapılır.")}</Text>
          <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}>
            <MaterialCommunityIcons name="email-outline" size={18} color={colors.primaryDark} />
            <Text selectable numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "900" }}>{SUPPORT_EMAIL}</Text>
            <Link href="/iletisim" asChild><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{t("İletişim")} →</Text></Link>
          </View>
        </View>
      </View>
      <View style={{ marginTop: 20 }}><WebFooter /></View>
    </ScrollView>
  );
}
