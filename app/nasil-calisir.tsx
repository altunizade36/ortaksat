import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Accordion } from "@/components/accordion";
import { colors } from "@/components/colors";
import { ContentPageView } from "@/components/content-page-view";
import { WebTrustStrip, WebFooter } from "@/components/web-landing";
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
      { icon: "store-plus-outline", title: "İlan Oluşturun", body: "Ürün bilgilerinizi, fotoğraflarınızı ve fiyatınızı ekleyin." },
      { icon: "percent", title: "Komisyon Belirleyin", body: "Ortak satıcılar için komisyon oranınızı ayarlayın." },
      { icon: "check-decagram-outline", title: "Talepleri Onaylayın", body: "Ortak satıcı başvurularını inceleyin ve onaylayın." },
      { icon: "chart-line", title: "Performansı Takip Edin", body: "Satışları, kazançları ve istatistikleri panelinizden takip edin." },
      { icon: "cash-check", title: "Satış Tamamlandığında Kazanın", body: "Satış gerçekleştiğinde komisyonunuz otomatik hesabınıza yansır." }
    ],
    footer: "Komisyonlar satış gerçekleştiğinde otomatik hesaplanır."
  },
  {
    title: "Ortak Satıcı",
    subtitle: "Paylaş, tanıt, kazan!",
    icon: "account-group-outline",
    tint: colors.infoSoft,
    accent: colors.info,
    steps: [
      { icon: "account-plus-outline", title: "Ortaklık Talebi Gönderin", body: "Beğendiğiniz ilanlara ortak satıcı olarak başvuru yapın." },
      { icon: "link-variant", title: "Onay Alın ve Linkinizi Oluşturun", body: "Onaylandıktan sonra size özel paylaşım linkiniz oluşur." },
      { icon: "share-variant-outline", title: "Linkinizi Paylaşın", body: "Linkinizi sosyal medya, WhatsApp veya dilediğiniz kanallarda paylaşın." },
      { icon: "account-arrow-right-outline", title: "Alıcıyı Getirin", body: "Alıcı linkiniz üzerinden ürüne ulaşır ve satın alır." },
      { icon: "cash-plus", title: "Komisyon Kazanın", body: "Satış tamamlandığında komisyonun panelde kayda geçer; satıcı, anlaştığınız kanaldan doğrudan sana öder." }
    ],
    footer: "Ne kadar çok satış, o kadar çok kazanç!"
  },
  {
    title: "Alıcı",
    subtitle: "Güvenli alışveriş yapın.",
    icon: "shopping-outline",
    tint: colors.goldSoft,
    accent: colors.gold,
    steps: [
      { icon: "magnify", title: "Ürünü Keşfedin", body: "Size önerilen veya link ile gelen ürünü inceleyin." },
      { icon: "message-text-outline", title: "Satıcıyla İletişime Geçin", body: "Talep oluşturun; satıcıyla mesajlaşarak ürünü netleştirin." },
      { icon: "handshake-outline", title: "Ödeme & Teslimatı Planlayın", body: "Ödeme ve teslimatı satıcıyla kendi aranızda kararlaştırırsınız." },
      { icon: "package-variant-closed", title: "Ürünü Teslim Alın", body: "Anlaştığınız şekilde ürünü teslim alın." },
      { icon: "star-outline", title: "Satıcıyı Değerlendirin", body: "Deneyiminizi puanlayarak topluluğa katkı sağlayın." }
    ],
    footer: "Doğrulanmış satıcılarla güvenli iletişim."
  }
];

const FAQ: Array<{ q: string; a: string }> = [
  { q: "Komisyon ne zaman ve nasıl ödenir?", a: "Komisyon, satışı satıcı onayladığında ortak panelinde “onaylandı” olarak görünür. Ödemeyi satıcı, anlaştığınız kanaldan (havale/EFT, elden vb.) doğrudan sana yapar. Ortaksat para almaz veya tutmaz; yalnızca kaydı tutar." },
  { q: "Komisyon oranı nasıl belirlenir?", a: "İlanı açan satıcı, ürün başına yüzde (%) veya sabit (₺) komisyonu kendisi belirler. Ortak, paylaşmadan önce kazancını ilanda görür." },
  { q: "Ortak satıcı taleplerini nasıl yönetirim?", a: "Satıcı panelinden gelen ortaklık başvurularını inceleyip onaylayabilir veya reddedebilirsin. Onaylı ortağa özel referans linki oluşur." },
  { q: "Ödeme yöntemleri nelerdir?", a: "İlk sürümde ödeme ve teslimat alıcı ile satıcı arasında yapılır; komisyon şartı ve süreç sistemde kayıt altına alınır." },
  { q: "İade & iptal süreçleri nasıl işler?", a: "İade penceresi içinde iade olursa komisyon beklemeye alınır. Tüm adımlar panelden şeffaf biçimde takip edilir." }
];

export default function HowItWorksPage() {
  return <ContentPageView slug="nasil-calisir" fallback={<HowItWorksStatic />} />;
}

function HowItWorksStatic() {
  const isWideWeb = useIsWideWeb();

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, gap: 24, paddingBottom: 0, paddingHorizontal: 20, paddingTop: 16 }} style={{ backgroundColor: colors.background }}>
      {/* Hero */}
      <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 20, flexDirection: isWideWeb ? "row" : "column", gap: 24, paddingHorizontal: 32, paddingVertical: 32 }}>
        <View style={{ alignItems: "center", flex: 1, justifyContent: "center", minWidth: 0 }}>
          <NetworkVisual />
        </View>
        <View style={{ alignItems: isWideWeb ? "center" : "flex-start", flex: 1.1, gap: 14, minWidth: 0 }}>
          <Text style={{ color: colors.ink, fontSize: 32, fontWeight: "900", lineHeight: 38, textAlign: isWideWeb ? "center" : "left" }}>OrtakSat nasıl çalışır?</Text>
          <Text style={{ color: colors.muted, fontSize: 15, fontWeight: "600", lineHeight: 23, maxWidth: 520, textAlign: isWideWeb ? "center" : "left" }}>OrtakSat, ürününüzü daha fazla kişiye ulaştırmanızı ve komisyonla birlikte kazanmanızı sağlayan güvenli bir ortak satış platformudur.</Text>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <Link href="/create" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingVertical: 13 }}>
                <MaterialCommunityIcons name="store-plus-outline" size={18} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>İlan Ver</Text>
              </Pressable>
            </Link>
            <Link href="/partner" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderColor: colors.primary, borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingVertical: 13 }}>
                <MaterialCommunityIcons name="handshake-outline" size={18} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>Ortak Satıcı Ol</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>

      {/* Three roles */}
      <View style={{ gap: 16 }}>
        <Text style={{ color: colors.ink, fontSize: 22, fontWeight: "900", textAlign: "center" }}>Üç rol, tek akış: Daha fazla satış, adil komisyon.</Text>
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
        <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>Sık Sorulan Sorular</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {FAQ.map((item) => (
            <View key={item.q} style={{ flexBasis: 420, flexGrow: 1, maxWidth: 720 }}>
              <Accordion title={item.q} icon="comment-question-outline">
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 22 }}>{item.a}</Text>
              </Accordion>
            </View>
          ))}
        </View>
        <Link href="/sss" asChild>
          <Pressable style={{ alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 4, marginTop: 2 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>Tüm soruları gör</Text>
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
          <Text style={{ color: "#FFFFFF", fontSize: 22, fontWeight: "900" }}>Hemen başlayın, birlikte kazanmaya başlayın!</Text>
          <Text style={{ color: "rgba(255,255,255,0.85)", fontSize: 14, fontWeight: "600" }}>İlan verin veya ortak satıcı olun, milyonlarca kullanıcıya ulaşın.</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 12 }}>
          <Link href="/create" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, flexDirection: "row", gap: 8, paddingHorizontal: 22, paddingVertical: 13 }}>
              <MaterialCommunityIcons name="plus-circle-outline" size={18} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>İlan Ver</Text>
            </Pressable>
          </Link>
          <Link href="/partner" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 8, paddingHorizontal: 22, paddingVertical: 13 }}>
              <MaterialCommunityIcons name="account-multiple-plus-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>Ortak Satıcı Ol</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <WebFooter />
    </ScrollView>
  );
}

function RoleColumn({ role, index }: { role: Role; index: number }) {
  return (
    <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 18, borderWidth: 1, flex: 1, gap: 14, minWidth: 0, padding: 20 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 12 }}>
        <View style={{ alignItems: "center", backgroundColor: role.tint, borderRadius: 12, height: 44, justifyContent: "center", width: 44 }}>
          <MaterialCommunityIcons name={role.icon} size={24} color={role.accent} />
        </View>
        <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
          <Text style={{ color: role.accent, fontSize: 17, fontWeight: "900" }}>{role.title}</Text>
          <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 12, fontWeight: "600" }}>{role.subtitle}</Text>
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
                <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "800" }}>{step.title}</Text>
              </View>
              <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "500", lineHeight: 18 }}>{step.body}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={{ alignItems: "center", backgroundColor: role.tint, borderRadius: 12, flexDirection: "row", gap: 8, marginTop: "auto", paddingHorizontal: 12, paddingVertical: 10 }}>
        <MaterialCommunityIcons name={index === 1 ? "trending-up" : "shield-check"} size={16} color={role.accent} />
        <Text style={{ color: role.accent, flex: 1, fontSize: 12, fontWeight: "800" }}>{role.footer}</Text>
      </View>
    </View>
  );
}

function NetworkVisual() {
  const avatars = [
    { color: colors.info, top: 0, left: 60 },
    { color: colors.accent, top: 40, left: 0 },
    { color: colors.violet, top: 110, left: 30 },
    { color: colors.primary, top: 90, left: 150 }
  ];
  return (
    <View style={{ height: 180, width: 230 }}>
      <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 18, borderWidth: 2, height: 92, justifyContent: "center", left: 70, position: "absolute", top: 44, width: 92 }}>
        <MaterialCommunityIcons name="sofa-single-outline" size={44} color={colors.primary} />
      </View>
      {[
        { icon: "percent" as const, top: 30, left: 175, bg: colors.primary },
        { icon: "chart-line" as const, top: 120, left: 180, bg: colors.primary }
      ].map((b) => (
        <View key={b.icon} style={{ alignItems: "center", backgroundColor: b.bg, borderRadius: 999, height: 30, justifyContent: "center", left: b.left, position: "absolute", top: b.top, width: 30 }}>
          <MaterialCommunityIcons name={b.icon} size={16} color="#FFFFFF" />
        </View>
      ))}
      {avatars.map((a, i) => (
        <View key={i} style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderColor: a.color, borderRadius: 999, borderWidth: 2, height: 40, justifyContent: "center", left: a.left, position: "absolute", top: a.top, width: 40 }}>
          <MaterialCommunityIcons name="account" size={22} color={a.color} />
        </View>
      ))}
    </View>
  );
}
