import { MaterialCommunityIcons } from "@/components/icons";
import { Link } from "expo-router";
import Head from "expo-router/head";
import { Fragment } from "react";
import { ScrollView, Text, View } from "react-native";

import { Accordion } from "@/components/accordion";
import { ContentPageView } from "@/components/content-page-view";
import { colors } from "@/components/colors";
import { Seo } from "@/components/seo";
import { WebFooter } from "@/components/web-landing";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { translateCopy, useLanguage } from "@/lib/i18n";
import { useIsWideWeb } from "@/lib/layout";

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const FAQ: Array<{ icon: IconName; heading: string; body: string }> = [
  {
    icon: "storefront-outline",
    heading: "ortaksat ürünü kendisi mi satıyor?",
    body: "Hayır. ortaksat alıcıyı satıcıya ve ortağa bağlayan bir pazardır. Satış ve teslimat satıcı ile alıcı arasında gerçekleşir; platform süreci ve komisyonu takip eder."
  },
  {
    icon: "gift-outline",
    heading: "Ortak olmak için ücret ödüyor muyum?",
    body: "Hayır. Ortaklık ücretsizdir. Sadece satış gerçekleştiğinde, satıcının ilanında belirttiği komisyonu kazanırsın."
  },
  {
    icon: "cash-multiple",
    heading: "Komisyonu kim belirler?",
    body: "Komisyon oranını veya sabit tutarını ilanı açan satıcı belirler; komisyon isteğe bağlıdır, satıcı isterse komisyonsuz normal ilan da verebilir. Ortak, ortak olmadan önce kazancını ilan detayında görür."
  },
  {
    icon: "link-variant-off",
    heading: "Zorunlu referans linki veya takip sistemi var mı?",
    body: "Hayır. Ortak, beğendiği ürünü kendi yöntemiyle tanıtır; zorunlu link/kod veya takip sistemi yoktur. Komisyon, satıcı ile ortak arasındaki anlaşmaya göre kaydedilir."
  },
  {
    icon: "shape-outline",
    heading: "Hangi ürünler satılabilir?",
    body: "Yasal her ürün ve hizmet: emlak, elektronik, moda, ev & yaşam, anne & bebek, spor, hediye ve daha fazlası. Yasak veya sahte ürünler moderasyon tarafından kaldırılır."
  },
  {
    icon: "shield-off-outline",
    heading: "OrtakSat ödeme veya güvenli-ödeme (emanet) yapıyor mu?",
    body: "Hayır. OrtakSat para tutmaz; cüzdan, bakiye veya emanet (güvenli ödeme) sistemi yoktur. Ödeme ve teslimat tamamen satıcı ile alıcı arasındadır."
  },
  {
    icon: "cash-check",
    heading: "Ödememi nasıl alırım?",
    body: "Kazandığın komisyonlar ortak panelinde bekliyor/onaylandı/ödendi olarak listelenir. Ödeme akışı ilk sürümde manuel takip edilir; ödeme sağlayıcı entegrasyonu yol haritasındadır."
  },
  {
    icon: "swap-horizontal",
    heading: "İade ve anlaşmazlıklar nasıl çözülür?",
    body: "Ödeme ve teslimat taraflar arasında olduğundan iade/anlaşmazlık öncelikle satıcı ile alıcı arasında çözülür. Tüm iletişimi platform mesajlaşmasında tutmak kayıt açısından önemlidir; kötüye kullanım şüphesinde 'Bildir' ile moderasyona taşınabilir."
  },
  {
    icon: "account-remove-outline",
    heading: "Hesabımı nasıl silerim?",
    body: "Hesabım → Ayarlar bölümünden hesap silme talebi oluşturabilirsin; KVKK kapsamında kişisel verilerin silinir."
  }
];

// Google zengin sonuç (rich result) için FAQPage yapısal verisi — SEO değeri korunur.
const faqLd = JSON.stringify({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ.map((f) => ({
    "@type": "Question",
    name: f.heading,
    acceptedAnswer: { "@type": "Answer", text: f.body }
  }))
});

export default function FaqScreen() {
  return <ContentPageView slug="sss" fallback={<FaqScreenStatic />} />;
}

function FaqScreenStatic() {
  const { language } = useLanguage();
  const isWideWeb = useIsWideWeb();
  const t = (s: string) => translateCopy(s, language);

  return (
    <Fragment>
      <Head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />
      </Head>
      <ScrollView contentInsetAdjustmentBehavior="automatic" showsVerticalScrollIndicator={false} contentContainerStyle={{ backgroundColor: colors.background, flexGrow: 1, paddingBottom: 0 }} style={{ backgroundColor: colors.background }}>
        <Seo title="Sıkça Sorulan Sorular (SSS) — OrtakSat" description="OrtakSat hakkında sık sorulan sorular: komisyon nasıl belirlenir, ortaklık ücretli mi, ödeme nasıl alınır, hangi ürünler satılır, iade ve hesap silme." path="/sss" />
        <View style={{ alignSelf: "center", gap: 16, maxWidth: 860, paddingHorizontal: isWideWeb ? 20 : 14, paddingTop: 16, width: "100%" }}>
          {/* Breadcrumb */}
          <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <Link href="/" asChild><Text style={{ color: colors.muted, fontSize: 13, fontWeight: "700" }}>{t("Ana Sayfa")}</Text></Link>
            <MaterialCommunityIcons name="chevron-right" size={15} color={colors.subtle} />
            <Text style={{ color: colors.ink, fontSize: 13, fontWeight: "800" }}>{t("Sıkça Sorulan Sorular")}</Text>
          </View>

          {/* Başlık */}
          <View style={{ alignItems: "center", flexDirection: "row", gap: 14 }}>
            <View style={{ alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 12, height: 52, justifyContent: "center", width: 52 }}>
              <MaterialCommunityIcons name="help-circle-outline" size={28} color={colors.primaryDark} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={{ color: colors.ink, fontSize: isWideWeb ? 26 : 22, fontWeight: "900" }}>{t("Sıkça Sorulan Sorular")}</Text>
              <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "600", lineHeight: 19 }}>{t("Ortak satış, komisyon, ödeme ve güvenlik hakkında en çok merak edilenler.")}</Text>
            </View>
          </View>

          {/* Akordeon SSS */}
          <View style={{ gap: 8 }}>
            {FAQ.map((f) => (
              <Accordion key={f.heading} title={t(f.heading)} icon={f.icon}>
                <Text style={{ color: colors.muted, fontSize: 13.5, fontWeight: "500", lineHeight: 21 }}>{t(f.body)}</Text>
              </Accordion>
            ))}
          </View>

          {/* Cevaplanmadı mı? — iletişim CTA */}
          <View style={{ backgroundColor: colors.primarySoft, borderColor: colors.primary, borderRadius: 16, borderWidth: 1, gap: 10, padding: isWideWeb ? 20 : 16 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              <MaterialCommunityIcons name="lifebuoy" size={22} color={colors.primaryDark} />
              <Text style={{ color: colors.ink, flex: 1, fontSize: 17, fontWeight: "900" }}>{t("Sorun burada yok mu?")}</Text>
            </View>
            <Text style={{ color: colors.ink, fontSize: 13.5, fontWeight: "500", lineHeight: 20 }}>{t("Aradığın yanıtı bulamadıysan bize e-posta ile yaz. OrtakSat aracı platformdur; çağrı merkezi/telefon hattı işletmez, genellikle 1–3 iş günü içinde dönüş yapılır.")}</Text>
            <View style={{ alignItems: "center", backgroundColor: colors.surface, borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: "row", gap: 10, paddingHorizontal: 14, paddingVertical: 12 }}>
              <MaterialCommunityIcons name="email-outline" size={18} color={colors.primaryDark} />
              <Text selectable numberOfLines={1} style={{ color: colors.ink, flex: 1, fontSize: 14, fontWeight: "900" }}>{SUPPORT_EMAIL}</Text>
              <Link href="/iletisim" asChild><Text style={{ color: colors.primaryDark, fontSize: 12.5, fontWeight: "800" }}>{t("İletişim")} →</Text></Link>
            </View>
          </View>
        </View>
        <View style={{ marginTop: 20 }}><WebFooter /></View>
      </ScrollView>
    </Fragment>
  );
}
