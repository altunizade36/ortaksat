import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { Pressable, ScrollView, Text, View } from "react-native";

import { Accordion } from "@/components/accordion";
import { colors } from "@/components/colors";
import { WebContainer } from "@/components/web-container";
import { WebFooter } from "@/components/web-landing";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const BENEFITS: Array<{ icon: IconName; t: string; b: string }> = [
  { icon: "cash-remove", t: "Ücretsiz listeleme", b: "İlan açmak, komisyon belirlemek ve ortak toplamak tamamen ücretsiz. Aidat veya üyelik yok." },
  { icon: "account-group", t: "Bedava satış ordusu", b: "Onlarca ortak (influencer/sosyal medya kullanıcısı) ürününü kendi takipçisiyle paylaşır — sen tek kuruş reklam vermeden." },
  { icon: "shield-check", t: "Risksiz model", b: "Komisyonu yalnızca satış gerçekleşince, kendi belirlediğin oranda ödersin. Önden maliyet yok." },
  { icon: "tune", t: "Kontrol sende", b: "Komisyon oranını, ortaklık türünü (anında/onaylı) ve stok limitini sen belirlersin." },
  { icon: "chart-line", t: "Şeffaf takip", b: "İlanına kaç ortak katıldı, kaç tıklama ve talep geldi — panelinden canlı görürsün." },
  { icon: "handshake-outline", t: "Aracı platform", b: "OrtakSat para tutmaz, kargo yapmaz. Ödeme ve teslimatı alıcıyla kendi aranızda yaparsınız." }
];

const STEPS: Array<{ icon: IconName; t: string; b: string }> = [
  { icon: "store-plus-outline", t: "1. Ürününü ekle", b: "Fotoğraf, fiyat ve açıklamayı gir. 5 dakikada yayında." },
  { icon: "percent", t: "2. Komisyon belirle", b: "Ortağa satış başına vereceğin yüzde veya sabit tutarı ayarla." },
  { icon: "share-variant-outline", t: "3. Ortaklar paylaşsın", b: "Onaylı ortaklar sana özel referans linkiyle ürünü tanıtır." },
  { icon: "cash-check", t: "4. Satışta öde", b: "Alıcı gelir, satış olur; komisyonu anlaştığın kanaldan doğrudan ortağa ödersin." }
];

const FAQ: Array<{ q: string; a: string }> = [
  { q: "İlan vermek ücretli mi?", a: "Hayır. OrtakSat'ta ilan açmak, komisyon belirlemek ve ortak toplamak ücretsizdir. Platform üyelik veya aidat almaz." },
  { q: "Komisyonu ne zaman öderim?", a: "Yalnızca satış gerçekleştiğinde. Komisyon oranını sen belirlersin ve ödemeyi satış sonrası, anlaştığın kanaldan doğrudan ortağa yaparsın. OrtakSat para tutmaz." },
  { q: "Ortaklar ürünümü nasıl satıyor?", a: "Onayladığın ortaklara ürüne özel bir referans linki oluşur. Ortak bu linki sosyal medyada, WhatsApp'ta paylaşır; alıcı linkten gelir ve seninle iletişime geçer." },
  { q: "Kargo ve ödemeyi OrtakSat mı yapıyor?", a: "Hayır. OrtakSat bir aracı ilan ve eşleşme platformudur; ödeme ve teslimatı alıcıyla kendi aranızda yaparsınız." },
  { q: "Hangi ürünler ortak satışa uygun?", a: "Fotoğrafla anlaşılan, fiyatı ve teslimatı net, stoğu güvenilir ürünler en iyi çalışır. Emlak, araç, elektronik, giyim, ev ürünleri ve daha fazlası uygundur." }
];

const faqLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
});

export default function SellerLandingPage() {
  const isWideWeb = useIsWideWeb();
  const { language } = useLanguage();
  const title = translateCopy("Ürününü Komisyonla Sattır — Ücretsiz İlan Ver | OrtakSat", language);
  const desc = translateCopy("OrtakSat'ta ürününü ücretsiz listele, komisyonunu belirle; onlarca ortak senin için satsın. Aidat yok, önden maliyet yok — sadece satışta komisyon ödersin. Ücretsiz satış ordusuyla daha hızlı sat.", language);
  const url = "https://ortaksat.com/satici-ol";

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={{ backgroundColor: colors.background, paddingBottom: 24 }} style={{ backgroundColor: colors.background }}>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        <link rel="canonical" href={url} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={url} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />
      </Head>

      <WebContainer max={1080} padding={16} style={{ gap: 20, paddingTop: 18 }}>
        {/* Hero */}
        <View style={{ backgroundColor: colors.primaryDark, borderRadius: 20, gap: 14, padding: isWideWeb ? 34 : 22 }}>
          <View style={{ alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 999, flexDirection: "row", gap: 6, paddingHorizontal: 12, paddingVertical: 6 }}>
            <MaterialCommunityIcons name="storefront-outline" size={15} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "900" }}>{translateCopy("Satıcılar için", language)}</Text>
          </View>
          <Text style={{ color: "#FFFFFF", fontSize: isWideWeb ? 34 : 26, fontWeight: "900", lineHeight: isWideWeb ? 40 : 31 }}>{translateCopy("Ürününü komisyonla sattır, ücretsiz satış ordusu kur", language)}</Text>
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 15, fontWeight: "600", lineHeight: 23, maxWidth: 640 }}>
            {translateCopy("Ürününü ücretsiz ekle, komisyonunu belirle; onlarca ortak kendi takipçisiyle senin için satsın. Önden maliyet yok — yalnızca satış olursa komisyon ödersin.", language)}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Link href="/create" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, flexDirection: "row", gap: 8, paddingHorizontal: 22, paddingVertical: 13 }}>
                <MaterialCommunityIcons name="plus-circle-outline" size={18} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>{translateCopy("Ücretsiz İlan Ver", language)}</Text>
              </Pressable>
            </Link>
            <Link href="/nasil-calisir" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 8, paddingHorizontal: 22, paddingVertical: 13 }}>
                <MaterialCommunityIcons name="information-outline" size={18} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{translateCopy("Nasıl Çalışır", language)}</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        {/* Avantajlar */}
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.ink, fontSize: 21, fontWeight: "900" }}>{translateCopy("Neden OrtakSat'ta satmalısın?", language)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {BENEFITS.map((c) => (
              <View key={c.t} style={{ backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 14, borderWidth: 1, flexBasis: 320, flexGrow: 1, gap: 6, padding: 16 }}>
                <MaterialCommunityIcons name={c.icon} size={22} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, fontSize: 15, fontWeight: "900" }}>{translateCopy(c.t, language)}</Text>
                <Text style={{ color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 19 }}>{translateCopy(c.b, language)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Adımlar */}
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.ink, fontSize: 21, fontWeight: "900" }}>{translateCopy("4 adımda başla", language)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {STEPS.map((s) => (
              <View key={s.t} style={{ backgroundColor: colors.primarySoft, borderRadius: 14, flexBasis: 230, flexGrow: 1, gap: 6, padding: 16 }}>
                <MaterialCommunityIcons name={s.icon} size={22} color={colors.primaryDark} />
                <Text style={{ color: colors.ink, fontSize: 14.5, fontWeight: "900" }}>{translateCopy(s.t, language)}</Text>
                <Text style={{ color: colors.muted, fontSize: 12.5, fontWeight: "600", lineHeight: 18 }}>{translateCopy(s.b, language)}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* SSS */}
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.ink, fontSize: 20, fontWeight: "900" }}>{translateCopy("Sık sorulan sorular", language)}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
            {FAQ.map((item) => (
              <View key={item.q} style={{ flexBasis: 440, flexGrow: 1, maxWidth: 720 }}>
                <Accordion title={translateCopy(item.q, language)} icon="comment-question-outline">
                  <Text style={{ color: colors.ink, fontSize: 14, fontWeight: "500", lineHeight: 22 }}>{translateCopy(item.a, language)}</Text>
                </Accordion>
              </View>
            ))}
          </View>
        </View>

        {/* CTA */}
        <View style={{ alignItems: isWideWeb ? "center" : "stretch", backgroundColor: colors.primarySoft, borderRadius: 18, flexDirection: isWideWeb ? "row" : "column", gap: 16, padding: 22 }}>
          <View style={{ flex: 1, gap: 4, minWidth: 0 }}>
            <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "900" }}>{translateCopy("Bugün ilk ürününü ekle", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600" }}>{translateCopy("Ücretsiz, 5 dakika. Ortakların satış getirmeye başlasın.", language)}</Text>
          </View>
          <Link href="/create" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingVertical: 13 }}>
              <MaterialCommunityIcons name="store-plus-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{translateCopy("Ücretsiz İlan Ver", language)}</Text>
            </Pressable>
          </Link>
        </View>
      </WebContainer>
      <WebFooter />
    </ScrollView>
  );
}
