import { ContentPageView } from "@/components/content-page-view";
import { InfoPage } from "@/components/info-page";

export default function AboutScreen() {
  return <ContentPageView slug="hakkimizda" fallback={<AboutScreenStatic />} />;
}

function AboutScreenStatic() {
  return (
    <InfoPage
      title="Hakkımızda"
      intro="ortaksat, ürününü ortaklarla birlikte satmanı sağlayan komisyonlu ortak satış pazarıdır."
      sections={[
        {
          heading: "Ne yapıyoruz?",
          body: "Satıcılar ilanlarını açar; ortaklar bu ilanları kendi referans bağlantılarıyla kendi çevrelerine ulaştırır. Bir satış gerçekleştiğinde ortak, satıcının belirlediği komisyonu kazanır. Talep, satış ve komisyon süreçleri tek panelde şeffaf biçimde takip edilir."
        },
        {
          heading: "Kimler için?",
          body: "Emlakçıdan telefoncuya, bilgisayarcıdan inşaatçıya, bisiklet satıcısından moda butiğine kadar ürün veya hizmet satan herkes ortaksat'ta ilan açabilir; sosyal medyası ve çevresi güçlü olan herkes ortak olup komisyon kazanabilir."
        },
        {
          heading: "Neden ortaksat?",
          body: "Tek bir ürünü yüzlerce ortağın ağına taşıyarak erişimini büyütürsün. Reklam bütçesi yerine sonuç bazlı komisyon ödersin: sadece satış olduğunda ödeme yaparsın."
        }
      ]}
    />
  );
}
