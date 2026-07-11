import { LegalDoc, type LegalSection } from "@/components/legal-doc";

// Kullanım Şartları — App Store / Google Play zorunlu belgesi. Aracı-platform modeliyle dürüst.
const SECTIONS: LegalSection[] = [
  {
    heading: "Taraflar ve Kabul",
    paragraphs: [
      "Bu Kullanım Şartları, OrtakSat platformunu (web ve mobil uygulama) kullanan siz (\"Kullanıcı\") ile OrtakSat arasındaki koşulları düzenler. Platformu kullanarak bu şartları ve Gizlilik Politikası'nı kabul etmiş sayılırsınız. Kabul etmiyorsanız platformu kullanmayınız."
    ]
  },
  {
    heading: "Hizmetin Tanımı",
    paragraphs: [
      "OrtakSat aracı bir ilan, eşleştirme ve iletişim platformudur. OrtakSat ürünlerin satıcısı DEĞİLDİR; ödeme almaz, para tutmaz, komisyon kesmez, kargo/teslimat yapmaz.",
      "Platform yalnızca; ilan yayınlama, ortak satıcı eşleştirme, mesajlaşma, talep ve komisyon takip kaydı gibi teknik altyapı hizmetlerini sunar. Satış, ödeme, teslimat ve komisyon ödemesi tamamen kullanıcılar arasındaki anlaşmalardan ibarettir."
    ]
  },
  {
    heading: "Hesap ve Uygunluk",
    paragraphs: [
      "Platformu kullanmak için 18 yaşını doldurmuş olmanız gerekir. Hesap bilgilerinizin doğruluğundan ve hesabınızın güvenliğinden (şifre dâhil) siz sorumlusunuz. Hesabınız üzerinden gerçekleşen tüm işlemlerden siz sorumlu tutulursunuz."
    ]
  },
  {
    heading: "Kullanıcı Yükümlülükleri",
    paragraphs: ["Platformu kullanırken şunları kabul edersiniz:"],
    bullets: [
      "Doğru, güncel ve yanıltıcı olmayan bilgiler sağlamak.",
      "Yasalara aykırı, yanıltıcı, dolandırıcılık amaçlı veya üçüncü kişilerin haklarını ihlal eden içerik yayınlamamak.",
      "Yasaklı veya kısıtlı ürün/hizmetleri (silah, uyuşturucu, sahte/taklit ürün, yasa dışı içerik vb.) ilan etmemek.",
      "Spam, bot, otomatik toplama veya platformun işleyişini bozan davranışlarda bulunmamak.",
      "Ödeme/iletişimi platform dışına taşımaya yönelik dolandırıcılık girişimlerinde bulunmamak."
    ]
  },
  {
    heading: "İlanlar ve İçerik",
    paragraphs: [
      "Yayınladığınız ilan, görsel ve metinlerin doğruluğundan ve yasalara uygunluğundan siz sorumlusunuz. OrtakSat, kurallara aykırı içerikleri inceleme, kaldırma veya erişimi kısıtlama hakkını saklı tutar. İçeriğinizi yayınlayarak, platformda gösterilmesi için gerekli kullanım hakkını OrtakSat'a vermiş olursunuz."
    ]
  },
  {
    heading: "Ortaklık ve Komisyon Modeli",
    paragraphs: [
      "İlan sahibi (satıcı), ürün başına komisyon oranını/tutarını kendisi belirler. Ortak, ürünü kendi referans bağlantısıyla paylaşır; satış gerçekleşirse komisyon platformda kayıt altına alınır.",
      "OrtakSat komisyonu tahsil etmez veya ödemez; komisyon ödemesi satıcı ile ortak arasında, platform dışında yapılır. Platform yalnızca anlaşma ve komisyon kaydını tutar. Ödemenin yapılmaması gibi taraflar arası anlaşmazlıklardan OrtakSat sorumlu değildir."
    ]
  },
  {
    heading: "Ödeme, Teslimat ve Sorumluluk",
    paragraphs: [
      "Ödeme, teslimat, iade ve garanti dâhil tüm alışveriş süreci alıcı ile satıcı arasındadır ve tüm sorumluluk taraflara aittir. OrtakSat işlem taraflarının kimliğini, ürünlerin niteliğini veya işlemlerin tamamlanacağını garanti etmez. Güvenli alışveriş adımlarını uygulamanız önerilir."
    ]
  },
  {
    heading: "Fikri Mülkiyet",
    paragraphs: [
      "OrtakSat markası, logosu, maskotu, arayüzü ve yazılımı OrtakSat'a aittir ve izinsiz kullanılamaz. Kullanıcıların yüklediği içerikler ilgili kullanıcılara aittir."
    ]
  },
  {
    heading: "Sorumluluğun Sınırlandırılması",
    paragraphs: [
      "Platform \"olduğu gibi\" sunulur. OrtakSat, kullanıcılar arasındaki işlemlerden, üçüncü taraf içeriklerinden veya hizmetin kesintisiz/hatasız olacağından sorumlu tutulamaz. Uygulanabilir hukukun izin verdiği azami ölçüde, OrtakSat'ın sorumluluğu sınırlıdır."
    ]
  },
  {
    heading: "Askıya Alma ve Fesih",
    paragraphs: [
      "Bu şartları veya yasaları ihlal eden hesapları uyarısız askıya alabilir veya kapatabiliriz. Dilediğiniz zaman hesabınızı kapatabilirsiniz."
    ]
  },
  {
    heading: "Uygulanacak Hukuk",
    paragraphs: [
      "Bu şartlar Türkiye Cumhuriyeti hukukuna tabidir. Uyuşmazlıklarda Türkiye mahkemeleri ve icra daireleri yetkilidir."
    ]
  },
  {
    heading: "Değişiklikler ve İletişim",
    paragraphs: [
      "Bu şartları zaman zaman güncelleyebiliriz; güncel sürüm bu sayfada yayımlanır. Sorularınız için destek@ortaksat.com adresinden bize ulaşabilirsiniz."
    ]
  }
];

export default function KullanimSartlari() {
  return (
    <LegalDoc
      title="Kullanım Şartları"
      path="/kullanim-sartlari"
      updated="11 Temmuz 2026"
      seoDescription="OrtakSat Kullanım Şartları: aracı platform modeli, kullanıcı yükümlülükleri, ortaklık/komisyon kuralları, sorumluluk ve uygulanacak hukuk."
      intro="OrtakSat'ı kullanmadan önce lütfen bu şartları okuyun. Platform aracı bir hizmettir; satış, ödeme ve teslimat kullanıcılar arasındaki anlaşmalardan ibarettir."
      sections={SECTIONS}
    />
  );
}
