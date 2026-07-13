import { MaterialCommunityIcons } from "@/components/icons";
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
  { icon: "wallet-outline", t: "Sıfır sermaye", b: "Ürün satın almazsın, para yatırmazsın. Yalnızca referans linkini paylaşırsın." },
  { icon: "package-variant-closed-remove", t: "Stok & kargo yok", b: "Depo, paketleme, gönderi derdi yok. Teslimatı satıcı yapar; sen tanıtırsın." },
  { icon: "clock-fast", t: "5 dakikada başla", b: "Kayıt ol, ürün seç, linkini al, paylaş. Bugün ilk linkini oluşturabilirsin." },
  { icon: "cash-multiple", t: "Her satışta komisyon", b: "Linkinden gelen alıcı satın alırsa, satıcının belirlediği komisyon senin olur." },
  { icon: "chart-line", t: "Şeffaf kazanç", b: "Tıklama ve satışların panelinde görünür; hangi paylaşım kazandırdı bilirsin." },
  { icon: "shield-check", t: "Güvenli & dürüst", b: "OrtakSat para tutmaz; komisyonu satıcı doğrudan sana öder. İş birliğini gizleme, güven kazan." }
];

const STEPS: Array<{ icon: IconName; t: string; b: string }> = [
  { icon: "account-plus-outline", t: "1. Ürüne katıl", b: "Beğendiğin ürüne ortak ol; anında ya da satıcı onayıyla linkin açılır." },
  { icon: "link-variant", t: "2. Linkini al", b: "Sana özel referans linki oluşur — tüm satışlar sana bağlanır." },
  { icon: "share-variant-outline", t: "3. Paylaş", b: "Instagram, TikTok, WhatsApp'ta paylaş. Hazır metinleri kopyala, kullan." },
  { icon: "cash-plus", t: "4. Kazan", b: "Satış olunca komisyon panelinde kaydedilir; satıcı doğrudan sana öder." }
];

const FAQ: Array<{ q: string; a: string }> = [
  { q: "Para kazanmak için sermaye gerekir mi?", a: "Hayır. Ortak olmak için ürün satın almana veya para yatırmana gerek yok. Sadece referans linkini paylaşırsın; satış olursa komisyon kazanırsın." },
  { q: "Ne kadar kazanabilirim?", a: "Kazancın kitlene, paylaşım kalitene ve ürünün komisyonuna bağlıdır. Kazanç Hesaplayıcı ile takipçi sayına göre aylık tahmini görebilirsin. OrtakSat kazanç garantisi vermez." },
  { q: "Komisyonu kim öder?", a: "Satıcı öder. OrtakSat para tutmaz; satış sonrası komisyonu satıcı, anlaştığınız kanaldan doğrudan sana gönderir." },
  { q: "Takipçim az, yine de kazanabilir miyim?", a: "Evet. Küçük ama ilgili bir kitle de satış getirebilir. Doğru ürünü seçmek ve dürüst, net anlatmak takipçi sayısından daha önemlidir." },
  { q: "Kaç ürünü aynı anda paylaşabilirim?", a: "İstediğin kadar. Farklı ürünlere ortak olabilir, hepsinin linkini ayrı ayrı paylaşabilirsin." }
];

const faqLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
});

export default function InfluencerLandingPage() {
  const isWideWeb = useIsWideWeb();
  const { language } = useLanguage();
  const title = translateCopy("Sosyal Medyadan Para Kazan — Influencer Ortak Programı | OrtakSat", language);
  const desc = translateCopy("Instagram, TikTok veya WhatsApp hesabınla para kazan. Sıfır sermaye, stok yok, para yatırma yok — ürün seç, referans linkini paylaş, satışta komisyon kazan. Ücretsiz başla.", language);
  const url = "https://www.ortaksat.com/influencer-kazanc";

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
            <MaterialCommunityIcons name="cash-multiple" size={15} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "900" }}>{translateCopy("Sıfır sermaye · stok yok · para yatırma yok", language)}</Text>
          </View>
          <Text style={{ color: "#FFFFFF", fontSize: isWideWeb ? 34 : 26, fontWeight: "900", lineHeight: isWideWeb ? 40 : 31 }}>{translateCopy("Sosyal medya hesabınla para kazan", language)}</Text>
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 15, fontWeight: "600", lineHeight: 23, maxWidth: 640 }}>
            {translateCopy("Ürün seç, sana özel referans linkini paylaş; o linkten satış olursa komisyon senin. Depo, kargo, para yatırma yok — bugün başla.", language)}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Link href="/partner" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, flexDirection: "row", gap: 8, paddingHorizontal: 22, paddingVertical: 13 }}>
                <MaterialCommunityIcons name="handshake-outline" size={18} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>{translateCopy("Ortak Ol", language)}</Text>
              </Pressable>
            </Link>
            <Link href="/ortak-kazanc" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 8, paddingHorizontal: 22, paddingVertical: 13 }}>
                <MaterialCommunityIcons name="calculator-variant-outline" size={18} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{translateCopy("Kazanç Hesapla", language)}</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        {/* Avantajlar */}
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.ink, fontSize: 21, fontWeight: "900" }}>{translateCopy("Neden OrtakSat ortağı olmalısın?", language)}</Text>
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
          <Text style={{ color: colors.ink, fontSize: 21, fontWeight: "900" }}>{translateCopy("4 adımda kazanmaya başla", language)}</Text>
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
            <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "900" }}>{translateCopy("Bugün ilk linkini oluştur", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600" }}>{translateCopy("Ücretsiz kayıt ol, ürün seç, paylaş, kazan.", language)}</Text>
          </View>
          <Link href="/partner" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingVertical: 13 }}>
              <MaterialCommunityIcons name="handshake-outline" size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{translateCopy("Ortak Ol", language)}</Text>
            </Pressable>
          </Link>
        </View>
      </WebContainer>
      <WebFooter />
    </ScrollView>
  );
}
