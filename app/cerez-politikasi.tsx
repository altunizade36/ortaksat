import { LegalDoc, type LegalSection } from "@/components/legal-doc";

// Çerez Politikası (özet sayfa). Tam metin: /legal → "Çerez Politikası" (lib/legal-content.ts → cerez).
// Buradaki envanter KODLA birebir aynı olmalı: yeni bir kayıt/araç eklenirse önce burası ve tam metin güncellenir.
// Rıza mekanizması: components/cookie-consent.tsx + lib/cookie-consent.ts + app/+html.tsx (consentScript).
const SECTIONS: LegalSection[] = [
  {
    heading: "Kısaca",
    paragraphs: [
      "OrtakSat'ın çalışması için zorunlu olan kayıtlar izne bağlı değildir. Bunun dışındaki her şey — ziyaret istatistikleri ve reklam ölçümü — yalnızca sen açıkça izin verirsen çalışır; izin vermediğin sürece ilgili araçlar tarayıcına hiç yüklenmez.",
      "Seçimini ilk ziyaretinde çıkan banttan yaparsın; sonradan her sayfanın altındaki \"Çerez Tercihleri\" bağlantısından dilediğin an değiştirebilir veya geri alabilirsin. Reddetmen siteyi kullanmanı hiçbir şekilde kısıtlamaz."
    ]
  },
  {
    heading: "Zorunlu Kayıtlar (izin gerekmez)",
    paragraphs: ["Bunlar olmadan giriş yapmak ve siteyi güvenle kullanmak mümkün değildir; bu yüzden kapatılamaz:"],
    bullets: [
      "Oturum bilgisi: giriş yaptığında tarayıcının yerel depolamasında tutulur, çıkış yaptığında silinir.",
      "\"Beni hatırla\" ve dil tercihin.",
      "Çerez tercihin: verdiğin karar ve tarihi; her ziyarette yeniden sorulmaması için saklanır.",
      "Google ile giriş öncesinde verdiğin sözleşme onayının kaydı.",
      "Hata kurtarma kayıtları: yalnızca sekme açıkken tutulur.",
      "İlan görüntülenme sayaçlarının şişirilmesini önleyen günlük anahtar: her gün yenilenen rastgele bir değerdir; seni günler arasında izlemeye elverişli değildir.",
      "Çevrimdışı sayfa ve logo için tarayıcı önbelleği."
    ]
  },
  {
    heading: "İşlevsel Kayıtlar (kullandığın özelliklerin parçası)",
    paragraphs: ["Yalnızca ilgili özelliği kullandığında oluşur ve cihazında kalır; reklam veya profilleme için kullanılmaz:"],
    bullets: [
      "Son gezdiğin ilanlar ve kategoriler, son aramaların, kayıtlı aramaların.",
      "Karşılaştırma listen ve mesaj kutusu görünüm tercihlerin.",
      "Yarım kalan ilan ve başvuru taslakların.",
      "Ortak satış atfı: bir ortağın bağlantısıyla bir ilana geldiysen, o ilanı hangi ortağın önerdiği bilgisi en fazla 30 gün saklanır; böylece satıcıyla iletişime geçtiğinde talep doğru ortağa bağlanır. Seni tanımlayan bir kimlik içermez.",
      "Davet kodu: bir davet bağlantısıyla geldiysen giriş yapana kadar saklanır, sonra silinir."
    ]
  },
  {
    heading: "Analitik Ölçüm (yalnızca izninle)",
    paragraphs: [
      "Ziyaret ve sayfa hızı istatistikleri için Vercel Web Analytics ve Speed Insights kullanılır. Bu araçlar cihazına çerez yerleştirmez ve seni kişisel olarak tanımlamaz. Yine de yalnızca izin verirsen yüklenir."
    ]
  },
  {
    heading: "Pazarlama ve Reklam Ölçümü (yalnızca izninle)",
    paragraphs: [
      "Reklam kampanyalarımızın etkisini ölçmek için Meta (Facebook / Instagram) Pixel kullanılabilir. Bu araç yalnızca etkinleştirildiği dönemlerde ve yalnızca \"Pazarlama\" iznini verirsen yüklenir; yüklendiğinde cihazına _fbp ve _fbc çerezlerini yerleştirir (yaklaşık 90 gün) ve ziyaret bilgilerini yurt dışındaki Meta sunucularına iletir. İzni geri aldığında araç durdurulur ve bu çerezler silinir.",
      "Araç etkin değilken tercih panelinde pazarlama seçeneği gösterilmez."
    ]
  },
  {
    heading: "Kullanmadığımız Teknolojiler",
    paragraphs: ["Aşağıdakiler OrtakSat'ta yoktur:"],
    bullets: [
      "İznin olmadan çalışan analitik veya reklam betiği.",
      "Cihaz parmak izi (fingerprinting) ve siteler arası izleme.",
      "Üçüncü taraf sunucudan yüklenen yazı tipi: yazı tipimiz kendi alan adımızdan sunulur, IP adresin Google'a veya başka bir üçüncü tarafa iletilmez.",
      "Kişisel verilerinin reklam amacıyla satılması veya kiralanması."
    ]
  },
  {
    heading: "Tercihini Yönetme ve Rızayı Geri Alma",
    paragraphs: [
      "Bantta \"Reddet\", \"Kabul Et\" ve \"Tercihleri Yönet\" seçenekleri aynı görünürlükte sunulur; zorunlu olmayan kategoriler varsayılan olarak kapalıdır. Siteyi kullanmaya devam etmen rıza verdiğin anlamına gelmez.",
      "Kararını her sayfanın altındaki \"Çerez Tercihleri\" bağlantısından değiştirebilirsin. Rızanı geri aldığında sayfa yenilenir ve ilgili araçlar durdurulur. Ayrıca tarayıcı ayarlarından site verilerini silebilirsin; bu durumda oturumun kapanır ve tercihin yeniden sorulur."
    ]
  },
  {
    heading: "Mobil Uygulama",
    paragraphs: [
      "iOS ve Android uygulamalarımızda tarayıcı çerezi yoktur. Oturum bilgin cihazın güvenli depolama alanında şifreli olarak, tercihlerin ve hızlı açılış için tutulan ilan önbelleği uygulamanın kendi alanında saklanır. Uygulamada analitik veya reklam izleme yazılımı bulunmaz."
    ]
  },
  {
    heading: "Hukuki Dayanak ve İletişim",
    paragraphs: [
      "Zorunlu ve işlevsel kayıtlar 6698 sayılı KVKK'nın 5. maddesinin ikinci fıkrasındaki sözleşmenin ifası ve meşru menfaat sebeplerine; analitik ve pazarlama araçları yalnızca açık rızana dayanır. Değerlendirmede Kişisel Verileri Koruma Kurulu'nun \"Çerez Uygulamaları Hakkında Rehber\"i esas alınmıştır.",
      "Ayrıntılı metin için Sözleşmeler sayfasındaki Çerez Politikası'na, kişisel verilerinle ilgili hakların için KVKK Aydınlatma Metni'ne bakabilirsin. Soruların için: destek@ortaksat.com."
    ]
  }
];

export default function CerezPolitikasi() {
  return (
    <LegalDoc
      title="Çerez Politikası"
      path="/cerez-politikasi"
      updated="13 Kasım 2026"
      seoDescription="OrtakSat Çerez Politikası: zorunlu kayıtlar izne bağlı değildir; analitik ve reklam ölçümü yalnızca açık rızanla çalışır. Tercihini dilediğin an değiştirebilirsin."
      intro="Zorunlu kayıtlar dışında hiçbir şey iznin olmadan çalışmaz. Hangi kayıtları neden tuttuğumuzu ve tercihini nasıl yöneteceğini burada bulabilirsin."
      sections={SECTIONS}
    />
  );
}
