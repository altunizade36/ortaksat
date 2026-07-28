import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { type ReactNode } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Accordion } from "@/components/accordion";
import { Mascot } from "@/components/brand/Mascot";
import { colors } from "@/components/colors";
import { ContentPageView } from "@/components/content-page-view";
import { WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

// Platformun GERÇEK akışı, tek yerde 3 sade adım (eski: HowItWorksStrip + 3 rol × 5
// adım tekrarı = metin duvarı. Sadeleştirildi.)
const STEPS: Array<{ n: string; icon: IconName; title: string; body: string; tint: string; color: string }> = [
  { n: "1", icon: "compass-outline", title: "Keşfet veya İlan Ver", body: "Ürünleri keşfet ya da kendi ürününü ücretsiz yayınla.", tint: colors.primarySoft, color: colors.primaryDark },
  { n: "2", icon: "handshake-outline", title: "Ortak Ol & Tanıt", body: "Beğendiğin ürüne ortak ol; kendi yönteminle tanıt. Zorunlu link/takip yok.", tint: colors.violetSoft, color: colors.violet },
  { n: "3", icon: "cash-multiple", title: "Komisyon Kazan", body: "Sattığında anlaştığın komisyonu satıcıdan al — tüm süreç kayıtlı.", tint: colors.goldSoft, color: "#B7791F" }
];

// 3 rol — her biri 3 KISA madde (eski 5 uzun adım yerine).
const ROLES: Array<{ title: string; sub: string; icon: IconName; tint: string; accent: string; points: string[] }> = [
  { title: "İlan Sahibi", sub: "Ürününü yükle, ortakların kazandırsın.", icon: "storefront-outline", tint: colors.primarySoft, accent: colors.primaryDark, points: ["Ücretsiz ilan ver, fiyatını koy", "Komisyonu belirle (isteğe bağlı)", "Ortağı onayla; satışta komisyonu öde"] },
  { title: "Satış Ortağı", sub: "Kendi ürünün olmadan, kendi yönteminle kazan.", icon: "account-group-outline", tint: colors.infoSoft, accent: colors.info, points: ["Komisyonlu ilanı seç, ortak ol", "Kendi yönteminle tanıt (link/takip yok)", "Satışta komisyonunu al"] },
  { title: "Alıcı", sub: "Normal ilan sitesi gibi, güvenle alışveriş.", icon: "shopping-outline", tint: colors.goldSoft, accent: colors.gold, points: ["Ürünleri keşfet, incele", "Satıcıyla anlaş, güvenle satın al", "Deneyimini değerlendir"] }
];

const TRUST = ["Doğrulanmış satıcılar", "Şeffaf komisyon", "Ücretsiz üyelik", "Aracı platform — para tutmaz"];

const FAQ: Array<{ q: string; a: string }> = [
  { q: "Ortak, ürünü nasıl satar? Link mi kullanılır?", a: "Hayır. OrtakSat'ta zorunlu referans linki, referans kodu veya takip sistemi yoktur. Ortak; ürünü sosyal medyasında, kendi çevresinde veya müşterilerine istediği yöntemle tanıtır. Satış ve komisyon, satıcı ile ortak arasındaki karşılıklı anlaşmaya dayanır." },
  { q: "Komisyon ne zaman ve nasıl ödenir?", a: "Ortak satış getirdiğinde, satıcı satışı kaydeder ve komisyon ortak panelinde görünür. Ödemeyi satıcı, anlaştığınız kanaldan doğrudan ortağa yapar. OrtakSat para almaz veya tutmaz; yalnızca kaydı tutar." },
  { q: "Komisyon zorunlu mu?", a: "Hayır. İlanı açan satıcı yüzde (%) veya sabit (₺) komisyonu kendisi belirler; isterse komisyonsuz normal ilan da yayınlar. Ortak, ortak olmadan kazancını ilanda görür." },
  { q: "Alıcı ortaklık sistemini kullanmak zorunda mı?", a: "Hayır. Alıcı ürünleri inceler, satıcıyla mesajlaşır ve doğrudan satın alır — tıpkı normal bir ilan sitesindeki gibi. Ortaklık yalnızca satıcı ile satış ortağı arasındadır." }
];

export default function HowItWorksPage() {
  return <ContentPageView slug="nasil-calisir" fallback={<HowItWorksStatic />} />;
}

function HowItWorksStatic() {
  const isWideWeb = useIsWideWeb();
  const { language } = useLanguage();

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, gap: 20, paddingBottom: 0, paddingHorizontal: 20, paddingTop: 16 }} style={{ backgroundColor: colors.background }}>
      <Head><title>{translateCopy("Nasıl Çalışır? — Ortak sat, komisyon kazan | OrtakSat", language)}</title><meta name="description" content={translateCopy("OrtakSat nasıl çalışır: ilan ver, ortak satışa aç, komisyonu belirle. Ortaklar ürününü tanıtır, satışta komisyon kazanır. Aracı platform — ödeme taraflar arasında.", language)} /></Head>

      {/* ---- Hero: başlık + kısa açıklama + 2 CTA (tek yer) ---- */}
      <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 18, flexDirection: isWideWeb ? "row" : "column", gap: isWideWeb ? 20 : 12, paddingHorizontal: isWideWeb ? 26 : 18, paddingVertical: isWideWeb ? 20 : 16 }}>
        <Mascot name="laptop" size={isWideWeb ? 128 : 96} priority panel panelColor="#FFFFFF" />
        <View style={{ alignItems: isWideWeb ? "flex-start" : "center", flex: 1, gap: 12, minWidth: 0 }}>
          <Text accessibilityRole="header" {...({ role: "heading", "aria-level": 1 } as Record<string, unknown>)} style={{ color: colors.ink, fontSize: isWideWeb ? 27 : 23, fontWeight: "900", lineHeight: isWideWeb ? 32 : 28, textAlign: isWideWeb ? "left" : "center" }}>{translateCopy("OrtakSat nasıl çalışır?", language)}</Text>
          <Text style={{ color: colors.muted, fontSize: 14, fontWeight: "600", lineHeight: 21, maxWidth: 480, textAlign: isWideWeb ? "left" : "center" }}>{translateCopy("Ürününü daha fazla kişiye ulaştır, komisyonla birlikte kazan. Aracı platform — para tutmaz, satış taraflar arasında.", language)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: isWideWeb ? "flex-start" : "center" }}>
            <Link href="/create" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 11, flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingVertical: 11 }}>
                <MaterialCommunityIcons name="store-plus-outline" size={17} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{translateCopy("İlan Ver", language)}</Text>
              </Pressable>
            </Link>
            <Link href="/partner" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderColor: colors.primary, borderRadius: 11, borderWidth: 1.5, flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingVertical: 11 }}>
                <MaterialCommunityIcons name="handshake-outline" size={17} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>{translateCopy("Ortak Satıcı Ol", language)}</Text>
              </Pressable>
            </Link>
          </View>
        </View>
      </View>

      {/* ---- 3 sade adım ---- */}
      <View style={{ gap: 12 }}>
        <SectionTitle>{translateCopy("3 adımda OrtakSat", language)}</SectionTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {STEPS.map((s, i) => (
            <View key={s.n} style={{ alignItems: "center", flexBasis: 220, flexDirection: "row", flexGrow: 1, gap: isWideWeb ? 8 : 0, minWidth: 200 }}>
              <View style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flex: 1, gap: 8, minWidth: 0, padding: 15 }}>
                <View style={{ alignItems: "center", flexDirection: "row", gap: 9 }}>
                  <View style={{ alignItems: "center", backgroundColor: s.tint, borderRadius: 11, height: 36, justifyContent: "center", width: 36 }}>
                    <MaterialCommunityIcons name={s.icon} size={19} color={s.color} />
                  </View>
                  <Text style={{ color: s.color, fontSize: 13, fontWeight: "900" }}>{translateCopy("Adım", language)} {s.n}</Text>
                </View>
                <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "900" }}>{translateCopy(s.title, language)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy(s.body, language)}</Text>
              </View>
              {isWideWeb && i < STEPS.length - 1 ? <MaterialCommunityIcons name="chevron-right" size={20} color={colors.subtle} /> : null}
            </View>
          ))}
        </View>
      </View>

      {/* ---- 3 rol — kompakt (3 kısa madde) ---- */}
      <View style={{ gap: 12 }}>
        <SectionTitle>{translateCopy("Üç rol, tek akış", language)}</SectionTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
          {ROLES.map((role) => (
            <View key={role.title} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 16, borderWidth: 1, flexBasis: 260, flexGrow: 1, gap: 10, minWidth: 240, padding: 16 }}>
              <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
                <View style={{ alignItems: "center", backgroundColor: role.tint, borderRadius: 11, height: 40, justifyContent: "center", width: 40 }}>
                  <MaterialCommunityIcons name={role.icon} size={22} color={role.accent} />
                </View>
                <View style={{ flex: 1, gap: 1, minWidth: 0 }}>
                  <Text style={{ color: role.accent, fontSize: 15.5, fontWeight: "900" }}>{translateCopy(role.title, language)}</Text>
                  <Text numberOfLines={2} style={{ color: colors.muted, fontSize: 11.5, fontWeight: "600", lineHeight: 15 }}>{translateCopy(role.sub, language)}</Text>
                </View>
              </View>
              <View style={{ gap: 7 }}>
                {role.points.map((p) => (
                  <View key={p} style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
                    <MaterialCommunityIcons name="check-circle" size={15} color={role.accent} style={{ marginTop: 1 }} />
                    <Text style={{ color: colors.ink, flex: 1, fontSize: 12.5, fontWeight: "600", lineHeight: 17, minWidth: 0 }}>{translateCopy(p, language)}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* ---- Güven (tek satır kompakt) ---- */}
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
        {TRUST.map((t) => (
          <View key={t} style={{ alignItems: "center", backgroundColor: colors.successSoft, borderRadius: 999, flexDirection: "row", gap: 5, paddingHorizontal: 11, paddingVertical: 6 }}>
            <MaterialCommunityIcons name="check-circle" size={13} color={colors.success} />
            <Text style={{ color: colors.success, fontSize: 11.5, fontWeight: "800" }}>{translateCopy(t, language)}</Text>
          </View>
        ))}
      </View>

      {/* ---- SSS (4 soru + link) ---- */}
      <View style={{ gap: 10 }}>
        <SectionTitle>{translateCopy("Sık Sorulan Sorular", language)}</SectionTitle>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {FAQ.map((item) => (
            <View key={item.q} style={{ flexBasis: 300, flexGrow: 1, maxWidth: 760, minWidth: 0 }}>
              <Accordion title={translateCopy(item.q, language)} icon="comment-question-outline">
                <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "500", lineHeight: 21 }}>{translateCopy(item.a, language)}</Text>
              </Accordion>
            </View>
          ))}
        </View>
        <Link href="/sss" asChild>
          <Pressable style={{ alignItems: "center", alignSelf: "center", flexDirection: "row", gap: 4, marginTop: 2 }}>
            <Text style={{ color: colors.primaryDark, fontSize: 13.5, fontWeight: "900" }}>{translateCopy("Tüm soruları gör", language)}</Text>
            <MaterialCommunityIcons name="arrow-right" size={17} color={colors.primaryDark} />
          </Pressable>
        </Link>
      </View>

      {/* ---- Tek kompakt final CTA ---- */}
      <View style={{ alignItems: "center", backgroundColor: colors.primaryDark, borderRadius: 16, flexDirection: isWideWeb ? "row" : "column", gap: 12, justifyContent: "space-between", paddingHorizontal: isWideWeb ? 22 : 18, paddingVertical: 16 }}>
        <Text style={{ color: "#FFFFFF", flex: isWideWeb ? 1 : undefined, fontSize: 16, fontWeight: "900", textAlign: isWideWeb ? "left" : "center" }}>{translateCopy("Hazırsan başla — birlikte kazan.", language)}</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" }}>
          <Link href="/create" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 11, flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingVertical: 11 }}>
              <MaterialCommunityIcons name="plus-circle-outline" size={17} color={colors.primaryDark} />
              <Text style={{ color: colors.primaryDark, fontSize: 14, fontWeight: "900" }}>{translateCopy("İlan Ver", language)}</Text>
            </Pressable>
          </Link>
          <Link href="/partner" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.14)", borderColor: "rgba(255,255,255,0.5)", borderRadius: 11, borderWidth: 1.5, flexDirection: "row", gap: 7, paddingHorizontal: 18, paddingVertical: 11 }}>
              <MaterialCommunityIcons name="account-multiple-plus-outline" size={17} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "900" }}>{translateCopy("Ortak Ol", language)}</Text>
            </Pressable>
          </Link>
        </View>
      </View>

      <WebFooter />
    </ScrollView>
  );
}

function SectionTitle({ children }: { children: ReactNode }) {
  return <Text style={{ color: colors.ink, fontSize: 18, fontWeight: "900" }}>{children}</Text>;
}
