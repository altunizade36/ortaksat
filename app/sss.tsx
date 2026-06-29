import { InfoPage } from "@/components/info-page";

export default function FaqScreen() {
  return (
    <InfoPage
      title="Sıkça Sorulan Sorular"
      sections={[
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
      ]}
    />
  );
}
