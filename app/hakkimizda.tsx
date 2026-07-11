import { ContentPageView } from "@/components/content-page-view";
import { InfoPage } from "@/components/info-page";
import { SUPPORT_EMAIL } from "@/lib/contact";
import { translateCopy, useLanguage } from "@/lib/i18n";

export default function AboutScreen() {
  return <ContentPageView slug="hakkimizda" fallback={<AboutScreenStatic />} />;
}

function AboutScreenStatic() {
  const { language } = useLanguage();
  return (
    <InfoPage
      title={translateCopy("Hakkımızda", language)}
      intro={translateCopy("ortaksat, ürününü ortaklarla birlikte satmanı sağlayan komisyonlu ortak satış pazarıdır.", language)}
      sections={[
        {
          heading: translateCopy("Ne yapıyoruz?", language),
          body: translateCopy("Satıcılar ilanlarını açar; ortaklar bu ilanları kendi referans bağlantılarıyla kendi çevrelerine ulaştırır. Bir satış gerçekleştiğinde ortak, satıcının belirlediği komisyonu kazanır. Talep, satış ve komisyon süreçleri tek panelde şeffaf biçimde takip edilir.", language)
        },
        {
          heading: translateCopy("Kimler için?", language),
          body: translateCopy("Emlakçıdan telefoncuya, bilgisayarcıdan inşaatçıya, bisiklet satıcısından moda butiğine kadar ürün veya hizmet satan herkes ortaksat'ta ilan açabilir; sosyal medyası ve çevresi güçlü olan herkes ortak olup komisyon kazanabilir.", language)
        },
        {
          heading: translateCopy("Neden ortaksat?", language),
          body: translateCopy("Tek bir ürünü ortak ağına taşıyarak erişimini büyütürsün. Reklam bütçesi yerine sonuç bazlı komisyon ödersin: sadece satış olduğunda ödeme yaparsın.", language)
        },
        {
          heading: translateCopy("İletişim", language),
          body: `${translateCopy("Şikayet, bilgi, yasal/KVKK başvurusu ve destek talepleri için bize e-posta ile ulaşabilirsin:", language)} ${SUPPORT_EMAIL}. ${translateCopy("OrtakSat bir aracı platformdur; çağrı merkezi/telefon hattı işletmez. Genellikle 1–3 iş günü içinde dönüş yapılır. Ayrıntılar için İletişim sayfasına bakabilirsin.", language)}`
        }
      ]}
    />
  );
}
