import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Accordion } from "@/components/accordion";
import { Mascot } from "@/components/brand/Mascot";
import { colors } from "@/components/colors";
import { ContentPageView } from "@/components/content-page-view";
import { HowItWorksStrip } from "@/components/how-it-works-strip";
import { WebTrustStrip, WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;
type Role = {
  title: string;
  subtitle: string;
  icon: IconName;
  tint: string;
  accent: string;
  steps: Array<{ icon: IconName; title: string; body: string }>;
  footer: string;
};

const ROLES: Role[] = [
  {
    title: "İlan Sahibi",
    subtitle: "Ürününüzü yükleyin, ortaklarınız kazandırsın.",
    icon: "storefront-outline",
    tint: colors.primarySoft,
    accent: colors.primaryDark,
    steps: [
      { icon: "store-plus-outline", title: "Ücretsiz İlan Oluşturun", body: "Ürün veya hizmetinizi, fotoğraflarınızı ve fiyatınızı ekleyin." },
      { icon: "percent", title: "Komisyon Belirleyin (isteğe bağlı)", body: "Satış ortağı için yüzde (%) veya sabit (₺) komisyon belirleyin — ya da komisyonsuz normal ilan verin." },
      { icon: "check-decagram-outline", title: "Ortak Taleplerini Onaylayın", body: "Ortak olmak isteyenlerin talebini inceleyin, uygun gördüklerinizi kabul edin." },
      { icon: "handshake-outline", title: "Şartları Birlikte Belirleyin", body: "Ortağınızla karşılıklı anlaşın; ürünü nasıl tanıtacağınıza platform karışmaz." },
      { icon: "cash-check", title: "Satışta Komisyonu Ödeyin", body: "Ortak satış getirdiğinde, anlaştığınız komisyonu doğrudan ona ödersiniz. Kayıt panelde tutulur." }
    ],
    footer: "Komisyonu siz belirlersiniz; komisyonsuz normal ilan da verebilirsiniz."
  },
  {
    title: "Satış Ortağı",
    subtitle: "Kendi ürünün olmadan, kendi yönteminle kazan.",
    icon: "account-group-outline",
    tint: colors.infoSoft,
    accent: colors.info,
    steps: [
      { icon: "magnify", title: "Komisyonlu İlanları İnceleyin", body: "Komisyon sunulan ilanları görün, kitlenize uygun ürünü seçin." },
      { icon: "account-plus-outline", title: "Ortak Ol Talebi Gönderin", body: "Beğendiğiniz ilana 'Ortak Ol' talebi gönderin veya satıcıyla mesajlaşın." },
      { icon: "handshake-outline", title: "Onay Alın, Anlaşın", body: "Satıcı talebinizi kabul ederse ortak olursunuz; komisyon ve şartları birlikte netleştirirsiniz." },
      { icon: "bullhorn-outline", title: "Kendi Yönteminle Tanıtın", body: "Ürünü sosyal medyanızda, çevrenizde veya müşterilerinize istediğiniz yöntemle tanıtın. Zorunlu link veya takip sistemi yoktur." },
      { icon: "cash-plus", title: "Satışta Komisyonu Alın", body: "Sattığınızda, önceden anlaştığınız komisyonu satıcıdan doğrudan alırsınız. Süreç panelde kayıt altındadır." }
    ],
    footer: "Satış senin yönteminle olur; komisyon karşılıklı anlaşmaya dayanır."
  },
  {
    title: "Alıcı",
    subtitle: "Normal ilan sitesi gibi, güvenle alışveriş.",
    icon: "shopping-outline",
    tint: colors.goldSoft,
    accent: colors.gold,
    steps: [
      { icon: "magnify", title: "Ürünü Keşfedin", body: "Size önerilen ürünleri inceleyin; hiçbir ortaklık sistemi kullanmadan alışveriş yapın." },
      { icon: "message-text-outline", title: "Satıcıyla İletişime Geçin", body: "Satıcıyla mesajlaşarak ürünü netleştirin, dilerseniz pazarlık yapın." },
      { icon: "handshake-outline", title: "Ödeme & Teslimatı Planlayın", body: "Ödeme ve teslimatı satıcıyla kendi aranızda kararlaştırırsınız." },
      { icon: "package-variant-closed", title: "Ürünü Teslim Alın", body: "Anlaştığınız şekilde ürünü teslim alın." },
      { icon: "star-outline", title: "Satıcıyı Değerlendirin", body: "Deneyiminizi puanlayarak topluluğa katkı sağlayın." }
    ],
    footer: "Doğrulanmış satıcılarla güvenli iletişim."
  }
];

const FAQ: Array<{ q: string; a: string }> = [
  { q: "Ortak, ürünü nasıl satar? Link mi kullanılır?", a: "Hayır. OrtakSat'ta zorunlu referans linki, referans kodu veya takip sistemi yoktur. Ortak; ürünü sosyal medyasında, kendi çevresinde veya müşterilerine istediği yöntemle tanıtır. Satış ve komisyon, satıcı ile ortak arasındaki karşılıklı anlaşmaya dayanır — platform satışın nasıl yapıldığına karışmaz." },
  { q: "Komisyon ne zaman ve nasıl ödenir?", a: "Ortak satış getirdiğinde, satıcı satışı kaydeder ve komisyon ortak panelinde görünür. Ödemeyi satıcı, anlaştığınız kanaldan (havale/EFT, elden vb.) doğrudan ortağa yapar. OrtakSat para almaz veya tutmaz; yalnızca kaydı tutar." },
  { q: "Komisyon oranı nasıl belirlenir? Zorunlu mu?", a: "İlanı açan satıcı, ürün başına yüzde (%) veya sabit (₺) komisyonu kendisi belirler. Komisyon zorunlu değildir — satıcı isterse komisyonsuz, normal bir ilan da yayınlayabilir. Ortak, ortak olmadan önce kazancını ilanda görür." },
  { q: "Ortaklık nasıl kurulur?", a: "Satış ortağı, beğendiği ilana 'Ortak Ol' talebi gönderir veya satıcıya mesaj atar. Satıcı uygun gördüğü kişileri kabul eder; iki taraf karşılıklı anlaşarak birlikte çalışmaya başlar." },
  { q: "Alıcı ortaklık sistemini kullanmak zorunda mı?", a: "Hayır. Alıcı; ürünleri inceler, satıcıyla mesajlaşır, pazarlık yapar ve doğrudan satın alır — tıpkı normal bir ilan sitesindeki gibi. Ortaklık sistemi yalnızca satıcı ile satış ortağı arasındadır." },
  { q: "İade & iptal süreçleri nasıl işler?", a: "İade penceresi içinde iade olursa komisyon beklemeye alınır. Ödeme ve teslimat taraflar arasında yapıldığından, iade koşullarını da satıcı ile alıcı kendi aralarında belirler. Kayıt panelde şeffaf biçimde tutulur." }
];

export default function HowItWorksPage() {
  return <ContentPageView slug="nasil-calisir" fallback={<HowItWorksStatic />} />;
}

function HowItWorksStatic() {
  const isWideWeb = useIsWideWeb();
  const { language } = useLanguage();

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, gap: 24, paddingBottom: 0, paddingHorizontal: 20, paddingTop: 16 }} style={{ backgroundColor: colors.background }}>
      <Head><title>{translateCopy("Nasıl Çalışır? — Ortak sat, komisyon kazan | OrtakSat", language)}</title><meta name="description" content={translateCopy("OrtakSat nasıl çalışır: ilan ver, ortak satışa aç, komisyonu belirle. Ortaklar ürününü tanıtır, satışta komisyon kazanır. Aracı platform — ödeme taraflar arasında.", language)} /></Head>
      {/* Hero */}
      <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 20, flexDirection: isWideWeb ? "row" : "column", gap: 24, paddingHorizontal: 32, paddingVertical: 32 }}>
        <View style={{ alignItems: "center", flex: 1, justifyContent: "center", minWidth: 0 }}>
          <Mascot name="laptop" size={240} priority panel panelColor="#FFFFFF" />
        </View>
        <View style={{ alignItems: isWideWeb ? "center" : "flex-start", flex: 1.1, gap: 14, minWidth: 0 }}>
          <Text accessibilityRole="header" {...({ role: "heading", "aria-level": 1 } as Record<string, unknown>)} style={{ color: colors.ink, fontSize: 32, fontWeight: "900", lineHeight: 38, textAlign: isWideWeb ? "center" : "left" }}>{translateCopy("OrtakSat nasıl çalışır?", language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600", lineHeight: 23, maxWidth: 520, textAlign: isWideWeb ? "center" : "left" }}>{translateCopy("OrtakSat, ürününüzü daha fazla kişiye ulaştırmanızı ve komisyonla birlikte kazanmanızı sağlayan güvenli bir ortak satış platformudur.", language)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            <Link href="/create" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingVertical: 13 }}>
                <MaterialCommunityIcons name="store-plus-outline" size={18} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{translateCopy("İlan Ver", language)}</Text>
              </Pressable>
            </Link>
            <Link href="/partner" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderColor: colors.primary, borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingVertical: 13 }}>
                <MaterialCommunityIcons name="handshake-outline" size={18} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>{translateCopy("Ortak Satıcı Ol", language)}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>

      {/* 3 Adımda OrtakSat — ana sayfadan buraya taşındı (gerçek akış + güven + CTA) */}
      <HowItWorksStrip />

      {/* Three roles */}
      <View style={{ gap: 16 }}>
        <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900", textAlign: "center" }}>{translateCopy("Üç rol, tek akış: Daha fazla satış, adil komisyon.", language)}</Text>
        <View style={{ alignItems: "stretch", flexDirection: isWideWeb ? "row" : "column", gap: isWideWeb ? 14 : 16 }}>
          {ROLES.map((role, index) => (
            <View key={role.title} style={{ alignItems: "center", flex: 1, flexDirection: isWideWeb ? "row" : "column", gap: isWideWeb ? 14 : 16, minWidth: 0 }}>
              <RoleColumn role={role} index={index} />
              {isWideWeb && index < ROLES.length - 1 ? <MaterialCommunityIcons name="arrow-right" size={22} color={colors.subtle} /> : null}
            </View>
          ))}
        </View>
      </View>

      <WebTrustStrip />

      {/* FAQ */}
      <View style={{ gap: 12 }}>
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{translateCopy("Sık Sorulan Sorular", language)}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {FAQ.map((item) => (
            <View key={item.q} style={{ flexBasis: 240, flexGrow: 1, minWidth: 0, maxWidth: 720 }}>
              <Accordion title={translateCopy(item.q, language)} icon="comment-question-outline">
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 22 }}>{translateCopy(item.a, language)}</Text>
              </Accordion>
            </View>
          ))}
        </View>
        <Link href="/sss" asChild>
          <Pressable style={{ alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 4, marginTop: 2 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>{translateCopy("Tüm soruları gör", language)}</Text>
            <MaterialCommunityIcons name="arrow-right" size={18} color={colors.primaryDark} />
          </Pressable>
        </Link>
      </View>

      {/* CTA banner */}
      <View style={{ alignItems: "center", backgroundColor: colors.primaryDark, borderRadius: 20, flexDirection: isWideWeb ? "row" : "column", gap: 20, paddingHorizontal: 32, paddingVertical: 28 }}>
        <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
          <View style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 16, height: 64, justifyContent: "center", width: 64 }}>
            <MaterialCommunityIcons name="chart-box-outline" size={32} color="#FFFFFF" />
          </View>
        </View>
        <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "900" }}>{translateCopy("Hemen başlayın, birlikte kazanmaya başlayın!", language)}</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "600" }}>{translateCopy("İlan verin veya ortak satıcı olun; ortakların kitlesiyle ürününüzü yayın.", language)}</Text>
        </View>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          <Link href="/create" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, flexDirection: "row", gap: 8, paddingHorizontal: 22, paddingVertical: 13 }}>
              <MaterialCommunityIcons name="plus-circle-outline" size={18} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>{translateCopy("İlan Ver", language)}</Text>
            </Pressable>
          </Link>
          <Link href="/partner" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 8, paddingHorizontal: 22, paddingVertical: 13 }}>
              <MaterialCommunityIcons name="account-multiple-plus-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{translateCopy("Ortak Satıcı Ol", language)}</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <WebFooter />
    </ScrollView>
  );
}

function RoleColumn({ role, index }: { role: Role; index: number }) {
  const { language } = useLanguage();
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flex: 1, gap: 14, minWidth: 0, padding: 20 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
        <View style={{ alignItems: "center", backgroundColor: role.tint, borderRadius: 12, height: 44, justifyContent: "center", width: 44 }}>
          <MaterialCommunityIcons name={role.icon} size={24} color={role.accent} />
        </View>
        <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
          <Text style={{ color: role.accent, fontSize: 17, fontWeight: "900" }}>{translateCopy(role.title, language)}</Text>
          <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{translateCopy(role.subtitle, language)}</Text>
        </View>
      </View>
      <View style={{ gap: 12 }}>
        {role.steps.map((step, i) => (
          <View key={step.title} style={{ alignItems: "flex-start", flexDirection: "row", gap: 10 }}>
            <View style={{ alignItems: "center", backgroundColor: role.tint, borderRadius: 999, height: 24, justifyContent: "center", marginTop: 1, width: 24 }}>
              <Text style={{ color: role.accent, fontSize: 12, fontWeight: "900" }}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 6 }}>
                <MaterialCommunityIcons name={step.icon} size={15} color={role.accent} />
                <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{translateCopy(step.title, language)}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "500", lineHeight: 18 }}>{translateCopy(step.body, language)}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ alignItems: "center", backgroundColor: role.tint, borderRadius: 12, flexDirection: "row", gap: 8, marginTop: "auto", paddingHorizontal: 12, paddingVertical: 10 }}>
        <MaterialCommunityIcons name={index === 1 ? "trending-up" : "shield-check"} size={16} color={role.accent} />
        <Text style={{ color: role.accent, flex: 1, fontSize: 12, fontWeight: "800" }}>{translateCopy(role.footer, language)}</Text>
      </View>
    </View>
  );
}

