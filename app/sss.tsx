import Head from "expo-router/head";
import { Fragment } from "react";

import { ContentPageView } from "@/components/content-page-view";
import { InfoPage } from "@/components/info-page";
import { translateCopy, useLanguage } from "@/lib/i18n";

const FAQ: Array<{ heading: string; body: string }> = [
  {
    heading: "ortaksat ürünü kendisi mi satıyor?",
    body: "Hayır. ortaksat alıcıyı satıcıya ve ortağa bağlayan bir pazardır. Satış ve teslimat satıcı ile alıcı arasında gerçekleşir; platform süreci ve komisyonu takip eder."
  },
  {
    heading: "Ortak olmak için ücret ödüyor muyum?",
    body: "Hayır. Ortaklık ücretsizdir. Sadece satış gerçekleştiğinde, satıcının ilanında belirttiği komisyonu kazanırsın."
  },
  {
    heading: "Komisyonu kim belirler?",
    body: "Komisyon oranını veya sabit tutarını ilanı açan satıcı belirler. Ortak, bağlantıyı paylaşmadan önce kazancını ilan detayında görür."
  },
  {
    heading: "Hangi ürünler satılabilir?",
    body: "Yasal her ürün ve hizmet: emlak, elektronik, moda, ev & yaşam, anne & bebek, spor, hediye ve daha fazlası. Yasak veya sahte ürünler moderasyon tarafından kaldırılır."
  },
  {
    heading: "Ödememi nasıl alırım?",
    body: "Kazandığın komisyonlar ortak panelinde bekliyor/onaylandı/ödendi olarak listelenir. Ödeme akışı ilk sürümde manuel takip edilir; ödeme sağlayıcı entegrasyonu yol haritasındadır."
  }
];

// Google zengin sonuç (rich result) için FAQPage yapısal verisi.
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
  return (
    <Fragment>
      <Head>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqLd }} />
      </Head>
      <InfoPage
        title={translateCopy("Sıkça Sorulan Sorular", language)}
        sections={FAQ.map((f) => ({ heading: translateCopy(f.heading, language), body: translateCopy(f.body, language) }))}
      />
    </Fragment>
  );
}
