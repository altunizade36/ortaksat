import { LegalDoc, type LegalSection } from "@/components/legal-doc";

// Çerez Politikası — OrtakSat üçüncü-taraf takip çerezi kullanmaz; yalnız işlevsel yerel depolama.
const SECTIONS: LegalSection[] = [
  {
    heading: "Çerez ve Yerel Depolama Nedir?",
    paragraphs: [
      "Çerezler ve yerel depolama (localStorage), bir web sitesinin veya uygulamanın cihazınızda küçük bilgiler saklamasına olanak tanır. OrtakSat, sizi izlemek veya reklam amacıyla üçüncü taraf takip çerezleri KULLANMAZ."
    ]
  },
  {
    heading: "Kullandığımız Teknolojiler",
    paragraphs: ["OrtakSat yalnızca hizmetin çalışması için gerekli, işlevsel depolamayı kullanır:"],
    bullets: [
      "Oturum bilgisi: giriş yapmış kalmanızı sağlayan kimlik doğrulama verisi.",
      "Tercihler: dil seçimi, karşılaştırma listesi, son gezilen ilanlar gibi işlevsel ayarlar (cihazınızda tutulur).",
      "Web Analytics (Vercel): ziyaret istatistikleri için ÇEREZSİZ, kişi-tanımlamayan ölçüm. Kimliğiniz izlenmez."
    ]
  },
  {
    heading: "Reklam ve Takip Çerezi Kullanmıyoruz",
    paragraphs: [
      "OrtakSat, üçüncü taraf reklam ağı veya kişiselleştirilmiş reklam takip çerezi kullanmaz. Verileriniz reklam amacıyla satılmaz veya paylaşılmaz."
    ]
  },
  {
    heading: "Kontrol",
    paragraphs: [
      "Tarayıcınızın/cihazınızın ayarlarından yerel depolamayı temizleyebilirsiniz. Ancak oturum ve tercih verilerini silmek, giriş durumunuzu ve bazı işlevsel ayarları sıfırlayabilir."
    ]
  },
  {
    heading: "İletişim",
    paragraphs: [
      "Çerez ve depolama uygulamalarımızla ilgili sorularınız için destek@ortaksat.com adresinden bize ulaşabilirsiniz."
    ]
  }
];

export default function CerezPolitikasi() {
  return (
    <LegalDoc
      title="Çerez Politikası"
      path="/cerez-politikasi"
      updated="11 Temmuz 2026"
      seoDescription="OrtakSat Çerez Politikası: takip çerezi kullanmıyoruz; yalnızca oturum, tercih ve çerezsiz analitik gibi işlevsel depolama kullanılır."
      intro="OrtakSat, sizi izleyen üçüncü taraf çerezleri kullanmaz. Yalnızca hizmetin çalışması için gerekli işlevsel depolamayı kullanırız."
      sections={SECTIONS}
    />
  );
}
