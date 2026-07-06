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
  { icon: "eye-check-outline", t: "Şeffaf", b: "Satıcı puanı, doğrulama rozeti ve gerçek ürün fotoğrafı. Kime yazdığını görerek karar ver." },
  { icon: "message-text-outline", t: "Doğrudan iletişim", b: "Arada aracı yok; ürünü satıcıyla doğrudan konuşur, sorularını sorarsın." },
  { icon: "cash-remove", t: "Sana ek ücret yok", b: "Komisyonu satıcı öder. Alıcı olarak platforma hiçbir ücret ödemezsin." },
  { icon: "shield-check", t: "Güvenli", b: "Güvenli alışveriş rehberi, dolandırıcılık uyarıları ve şüpheli durumu bildir seçeneği." }
];

const STEPS: Array<{ icon: IconName; t: string; b: string }> = [
  { icon: "magnify", t: "1. Keşfet", b: "Kategori ve şehre göre ilanları incele; sana önerilen veya bir ortağın linkinden gelen ürünü aç." },
  { icon: "message-reply-text-outline", t: "2. Satıcıyla konuş", b: "İlan üzerinden satıcıya yaz; ürünü, fiyatı ve teslimatı netleştir." },
  { icon: "handshake-outline", t: "3. Anlaş & al", b: "Ödeme ve teslimatı satıcıyla kendi aranızda kararlaştır; mümkünse ürünü görerek al." },
  { icon: "star-outline", t: "4. Puanla", b: "Deneyimini puanla; dürüst satıcılar öne çıksın, topluluk güçlensin." }
];

const FAQ: Array<{ q: string; a: string }> = [
  { q: "Alıcı olarak ücret öder miyim?", a: "Hayır. OrtakSat'ta alıcıya platform ücreti çıkmaz. Komisyonu, satışı yapan ortağa satıcı öder. Sen yalnızca satıcıyla anlaştığın ürün bedelini ödersin." },
  { q: "Ödemeyi OrtakSat mı alıyor?", a: "Hayır. OrtakSat aracı bir platformdur; para tutmaz, ödeme almaz, kargo yapmaz. Ödeme ve teslimatı satıcıyla kendi aranızda yaparsınız. Bu yüzden güvenli alışveriş adımlarını uygulaman önemlidir." },
  { q: "Satıcının güvenilir olduğunu nasıl anlarım?", a: "Satıcı puanına, doğrulama rozetine (telefon/kimlik), tamamlanan satış sayısına ve yanıt oranına bak. Gerçek fotoğraf ve net açıklama da güven işaretidir. Yine de ödemeyi ürünü görmeden yapma." },
  { q: "Bir ortağın linkinden geldim, fiyat değişir mi?", a: "Hayır. Ortak linkinden gelmen fiyatı değiştirmez; komisyonu satıcı öder. Link sadece hangi ortağın seni yönlendirdiğini kaydeder." },
  { q: "Sorun yaşarsam ne yaparım?", a: "İlan sayfasındaki 'Bildir' ile şüpheli durumu kayda geçir. Güvenli Alışveriş Rehberi'nde dolandırıcılık kırmızı bayrakları ve yapılacaklar (155/156 dahil) yer alır." }
];

const faqLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } }))
});

export default function BuyerLandingPage() {
  const isWideWeb = useIsWideWeb();
  const { language } = useLanguage();
  const title = translateCopy("Güvenle Al, Doğrudan Satıcıyla Anlaş | OrtakSat", language);
  const desc = translateCopy("OrtakSat'ta ilanları keşfet, doğrulanmış satıcılarla doğrudan iletişime geç, ürünü görerek al. Alıcıya ek ücret yok; komisyonu satıcı öder. Güvenli alışveriş rehberiyle korunarak alışveriş yap.", language);
  const url = "https://ortaksat.com/alici";

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
            <MaterialCommunityIcons name="shopping-outline" size={15} color="#FFFFFF" />
            <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "900" }}>{translateCopy("Alıcılar için", language)}</Text>
          </View>
          <Text style={{ color: "#FFFFFF", fontSize: isWideWeb ? 34 : 26, fontWeight: "900", lineHeight: isWideWeb ? 40 : 31 }}>{translateCopy("Güvenle keşfet, doğrudan satıcıyla anlaş", language)}</Text>
          <Text style={{ color: "rgba(255,255,255,0.9)", fontSize: 15, fontWeight: "600", lineHeight: 23, maxWidth: 640 }}>
            {translateCopy("İlanları keşfet, doğrulanmış satıcılarla iletişime geç, ürünü görerek al. OrtakSat aracıdır; ödeme ve teslimatı satıcıyla kendi aranızda yaparsınız — komisyonu satıcı öder, sana ek ücret çıkmaz.", language)}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            <Link href="/explore" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: "#FFFFFF", borderRadius: 12, flexDirection: "row", gap: 8, paddingHorizontal: 22, paddingVertical: 13 }}>
                <MaterialCommunityIcons name="magnify" size={18} color={colors.primaryDark} />
                <Text style={{ color: colors.primaryDark, fontSize: 15, fontWeight: "900" }}>{translateCopy("Ürünleri Keşfet", language)}</Text>
              </Pressable>
            </Link>
            <Link href="/guvenli-alisveris" asChild>
              <Pressable style={{ alignItems: "center", backgroundColor: "rgba(255,255,255,0.12)", borderColor: "rgba(255,255,255,0.5)", borderRadius: 12, borderWidth: 1.5, flexDirection: "row", gap: 8, paddingHorizontal: 22, paddingVertical: 13 }}>
                <MaterialCommunityIcons name="shield-check-outline" size={18} color="#FFFFFF" />
                <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{translateCopy("Güvenli Alışveriş", language)}</Text>
              </Pressable>
            </Link>
          </View>
        </View>

        {/* Avantajlar */}
        <View style={{ gap: 12 }}>
          <Text style={{ color: colors.ink, fontSize: 21, fontWeight: "900" }}>{translateCopy("Neden OrtakSat'tan almalısın?", language)}</Text>
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
          <Text style={{ color: colors.ink, fontSize: 21, fontWeight: "900" }}>{translateCopy("4 adımda güvenli alışveriş", language)}</Text>
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
            <Text style={{ color: colors.ink, fontSize: 19, fontWeight: "900" }}>{translateCopy("Aradığın ürünü bul", language)}</Text>
            <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600" }}>{translateCopy("Doğrulanmış satıcılar, doğrudan iletişim, komisyonu satıcı öder.", language)}</Text>
          </View>
          <Link href="/explore" asChild>
            <Pressable style={{ alignItems: "center", backgroundColor: colors.primary, borderRadius: 12, flexDirection: "row", gap: 8, paddingHorizontal: 24, paddingVertical: 13 }}>
              <MaterialCommunityIcons name="magnify" size={18} color="#FFFFFF" />
              <Text style={{ color: "#FFFFFF", fontSize: 15, fontWeight: "900" }}>{translateCopy("Ürünleri Keşfet", language)}</Text>
            </Pressable>
          </Link>
        </View>
      </WebContainer>
      <WebFooter />
    </ScrollView>
  );
}
