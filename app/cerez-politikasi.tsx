import { LegalDoc, type LegalSection } from "@/components/legal-doc";
import { SUPPORT_EMAIL } from "@/lib/contact";

// Çerez Politikası / Çerez Aydınlatma Metni (özet sayfa). Tam metin: /legal → "Çerez Politikası" (lib/legal-content.ts → cerez).
// Buradaki envanter KODLA birebir aynı olmalı: yeni bir kayıt/araç eklenirse önce burası, tam metin ve tercih paneli
// (components/cookie-consent.tsx) güncellenir. Rıza mekanizması: components/cookie-consent.tsx + lib/cookie-consent.ts +
// app/+html.tsx (consentScript).
// Metin OrtakSat'ın GERÇEK kullanımını anlatır; başka sitelerin metinlerinden kopyalanmaz ve kullanmadığımız bir aracı
// "kullanıyoruz" diye yazmaz. Veri sorumlusunun tanıtıcı bilgileri lib/company.ts'ten gelir (boşsa uydurulmaz).
const SECTIONS: LegalSection[] = [
  {
    heading: "Kısaca",
    paragraphs: [
      "OrtakSat'ın çalışması için zorunlu olan kayıtlar izne bağlı değildir. Bunun dışındaki her şey — ziyaret istatistikleri ve reklam ölçümü — yalnızca sen açıkça izin verirsen çalışır; izin vermediğin sürece ilgili araçlar tarayıcına hiç yüklenmez.",
      "Seçimini ilk ziyaretinde ekranın altında çıkan banttan yaparsın; sonradan her sayfanın altındaki \"Çerez Tercihleri\" bağlantısından dilediğin an değiştirebilir veya geri alabilirsin. Reddetmen siteyi kullanmanı hiçbir şekilde kısıtlamaz."
    ]
  },
  {
    heading: "Veri Sorumlusu ve Bu Metnin Amacı",
    paragraphs: [
      "Bu metin, 6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında veri sorumlusu olan OrtakSat tarafından hazırlanmıştır. Amacı; ortaksat.com'da ve mobil uygulamalarımızda cihazına hangi kayıtların hangi amaçla yerleştirildiğini, bunların hangi hukuki sebebe dayandığını, kimlere aktarılabildiğini, tercihlerini nasıl yöneteceğini ve haklarını açıklamaktır.",
      "Bu metin yalnızca OrtakSat'ın kendi sitesini ve uygulamalarını kapsar. İlanlardaki ya da sayfalarımızdaki bağlantılarla gittiğin başka siteler kendi çerezlerini kullanabilir; onların uygulamalarından OrtakSat sorumlu değildir.",
      "Bu metinde \"çerez\" sözü; tarayıcı çerezlerini, yerel depolama ve oturum depolama kayıtlarını ve benzeri teknolojileri birlikte anlatır."
    ]
  },
  {
    heading: "Çerez Nedir?",
    paragraphs: [
      "Çerezler ve benzeri kayıtlar, bir siteyi ziyaret ettiğinde tarayıcın aracılığıyla cihazına kaydedilen küçük bilgi parçalarıdır. Sitenin seni yeniden tanımasını — örneğin oturumunun açık kalmasını ya da tercihinin hatırlanmasını — sağlar.",
      "Kayıtlar kimin yerleştirdiğine göre birinci taraf (OrtakSat) ve üçüncü taraf (başka bir sağlayıcı); süresine göre oturum (sekme kapanınca silinen) ve kalıcı; amacına göre zorunlu, işlevsel, analitik ve pazarlama olarak ayrılır. Aşağıda OrtakSat'ın her kategoride gerçekte ne kullandığı yazılıdır."
    ]
  },
  {
    heading: "Zorunlu Kayıtlar (izin gerekmez)",
    paragraphs: ["Bunlar olmadan giriş yapmak ve siteyi güvenle kullanmak mümkün değildir; bu yüzden kapatılamaz:"],
    bullets: [
      "Oturum bilgisi: giriş yaptığında tarayıcının yerel depolamasında tutulur, çıkış yaptığında silinir.",
      "\"Beni hatırla\" ve dil tercihin.",
      "Çerez tercihin: verdiğin karar ve tarihi; her ziyarette yeniden sorulmaması için saklanır.",
      "Google ya da Apple ile giriş öncesinde verdiğin sözleşme onayının kaydı.",
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
    heading: "Performans ve Analitik (yalnızca izninle)",
    paragraphs: [
      "Sitenin kaç kez ziyaret edildiğini, hangi sayfaların kullanıldığını ve sayfaların ne kadar hızlı açıldığını ölçmek için Vercel Web Analytics ve Vercel Speed Insights kullanılır. Bu araçlar cihazına çerez yerleştirmez ve seni kişisel olarak tanımlamaz. Yine de yalnızca izin verirsen yüklenir."
    ]
  },
  {
    heading: "Hedefleme ve Reklam Ölçümü (yalnızca izninle)",
    paragraphs: [
      "Reklam kampanyalarımızın etkisini ölçmek için Meta (Facebook / Instagram) Pixel kullanılabilir. Bu araç yalnızca etkinleştirildiği dönemlerde ve yalnızca \"Hedefleme ve Reklam\" iznini verirsen yüklenir; yüklendiğinde cihazına _fbp ve _fbc çerezlerini yerleştirir (yaklaşık 90 gün) ve ziyaret bilgilerini yurt dışındaki Meta sunucularına iletir. İzni geri aldığında araç durdurulur ve bu çerezler silinir.",
      "Araç etkin değilken tercih panelinde bu kategori \"şu an kullanılmıyor\" olarak görünür ve izin istenmez. Sitede bunun dışında reklam ağı, hedefleme pikseli ya da yeniden pazarlama çerezi yoktur."
    ]
  },
  {
    heading: "Kayıt Tablosu",
    paragraphs: ["Sırasıyla: kayıt — kategori — kimin yerleştirdiği — ne kadar kaldığı."],
    bullets: [
      "Oturum bilgisi — zorunlu — OrtakSat (yerel depolama) — çıkış yapana ya da oturumun süresi dolana kadar.",
      "\"Beni hatırla\" ve dil tercihi — zorunlu — OrtakSat — sen değiştirene kadar.",
      "Çerez tercihi — zorunlu — OrtakSat — sen değiştirene ya da bu politika esaslı biçimde değişene kadar.",
      "Sözleşme onayı kaydı — zorunlu — OrtakSat — giriş tamamlanana kadar.",
      "Hata kurtarma kayıtları — zorunlu — OrtakSat (oturum depolama) — sekme kapanana kadar.",
      "Günlük sayaç anahtarı — zorunlu — OrtakSat — bir gün.",
      "Son gezilenler, aramalar, karşılaştırma listesi, taslaklar — işlevsel — OrtakSat — sen silene kadar.",
      "Ortak satış atfı — işlevsel — OrtakSat — en fazla 30 gün.",
      "Davet kodu — işlevsel — OrtakSat — giriş yapana kadar.",
      "Vercel Web Analytics ve Speed Insights — analitik — Vercel (üçüncü taraf betik) — cihazda kayıt bırakmaz.",
      "_fbp ve _fbc — hedefleme ve reklam — Meta Pixel'in ortaksat.com adına yerleştirdiği çerezler — yaklaşık 90 gün; yalnızca araç etkinken ve izninle."
    ]
  },
  {
    heading: "Verilerin Toplanma Yöntemi",
    paragraphs: [
      "Bu metindeki veriler; siteyi ziyaret ettiğinde tarayıcına yerleştirilen kayıtlar ve — yalnızca izin verdiysen — yüklenen ölçüm betikleri aracılığıyla, otomatik yollarla toplanır."
    ]
  },
  {
    heading: "Kimlere Aktarılır?",
    paragraphs: [
      "Zorunlu ve işlevsel kayıtların çoğu yalnızca cihazında durur. Sitenin sunulabilmesi için bağlantı verilerin (örneğin IP adresin) altyapı sağlayıcılarımız tarafından işlenir: barındırma ve içerik dağıtımı için Vercel (ABD merkezli), veritabanı, giriş ve dosya depolama için Supabase (sunucuları Avrupa Birliği / İrlanda bölgesinde).",
      "Analitik izni verirsen ziyaret istatistikleri Vercel'e; hedefleme ve reklam izni verirsen ve araç etkinse ziyaret bilgilerin Meta'ya iletilir. İzin vermediğin sürece bu aktarımlar gerçekleşmez.",
      "Bu sağlayıcıların sunucuları Türkiye dışında olduğundan veriler yurt dışına aktarılır; aktarımlar KVKK'nın 9. maddesine tabidir. Ayrıntılar KVKK Aydınlatma Metni'nin \"Aktarım\" bölümündedir. Yasal bir talep hâlinde veriler yetkili kamu kurum ve kuruluşlarıyla paylaşılabilir. OrtakSat kişisel verilerini pazarlama amacıyla üçüncü kişilere satmaz veya kiralamaz."
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
      "Bantta \"Tümünü Reddet\", \"Tercihleri Yönet\" ve \"Tümünü Kabul Et\" seçenekleri aynı görünürlükte sunulur. Bant siteyi kilitlemez: seçim yapmadan da gezebilirsin ve seçim yapana kadar analitik ile reklam araçları yüklenmez. Siteyi kullanmaya devam etmen rıza verdiğin anlamına gelmez.",
      "\"Tercihleri Yönet\" ile açılan Çerez Tercihleri panelinde her kategorinin ne işe yaradığını okuyabilir, izne bağlı kategorileri tek tek açıp kapatabilirsin. Zorunlu olmayan kategoriler varsayılan olarak kapalıdır; önceden işaretlenmiş seçenek yoktur. Panelde \"Seçimlerimi Onayla\", \"Tümünü Reddet\" ve \"Tümüne İzin Ver\" düğmeleri de aynı görünümdedir. Paneli kapatmak tercihini değiştirmez.",
      "Kararını her sayfanın altındaki \"Çerez Tercihleri\" bağlantısından dilediğin an değiştirebilirsin. Rızanı geri aldığında sayfa yenilenir, ilgili araçlar durdurulur ve reklam ölçümü çerezleri silinir. Geri alma, o ana kadar rızana dayanılarak yapılan işlemleri etkilemez."
    ]
  },
  {
    heading: "Tarayıcı Ayarlarıyla Yönetme",
    paragraphs: [
      "Tarayıcının ayarlarından da çerezleri ve site verilerini silebilir veya engelleyebilirsin. Zorunlu kayıtları silersen oturumun kapanır ve tercihin yeniden sorulur. Menü adları sürüme göre değişebilir; genellikle şuralardadır:"
    ],
    bullets: [
      "Google Chrome: Ayarlar → Gizlilik ve güvenlik → Çerezler ve site verileri.",
      "Mozilla Firefox: Ayarlar → Gizlilik ve Güvenlik → Çerezler ve site verileri.",
      "Safari: Ayarlar → Gizlilik → Web sitesi verilerini yönet.",
      "Microsoft Edge: Ayarlar → Çerezler ve site izinleri.",
      "Opera: Ayarlar → Gizlilik ve güvenlik → Çerezler ve site verileri."
    ]
  },
  {
    heading: "Mobil Uygulama",
    paragraphs: [
      "Mobil uygulamalarımızda tarayıcı çerezi yoktur. Oturum bilgin cihazın güvenli depolama alanında şifreli olarak; tercihlerin, taslakların ve hızlı açılış için tutulan ilan önbelleği uygulamanın kendi alanında saklanır. Uygulamayı kaldırdığında bu kayıtlar silinir.",
      "Uygulamada analitik veya reklam izleme yazılımı bulunmaz; bu yüzden uygulamada çerez bandı ve tercih paneli gösterilmez. İleride uygulamaya böyle bir araç eklenirse önce bu metin güncellenir ve iznin uygulama içinde ayrıca istenir."
    ]
  },
  {
    heading: "Hukuki Dayanak",
    paragraphs: [
      "Zorunlu kayıtlar ile kullandığın özelliklere ait işlevsel kayıtlar, KVKK'nın 5. maddesinin ikinci fıkrasındaki \"bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması\" ve \"veri sorumlusunun meşru menfaati\" sebeplerine dayanır.",
      "Analitik ile hedefleme ve reklam araçları yalnızca KVKK'nın 5. maddesinin birinci fıkrasındaki açık rızana dayanır. Değerlendirmede Kişisel Verileri Koruma Kurulu'nun \"Çerez Uygulamaları Hakkında Rehber\"i esas alınmıştır."
    ]
  },
  {
    heading: "Hakların (KVKK md. 11)",
    paragraphs: ["Çerezler yoluyla işlenen kişisel verilerin bakımından şu haklara sahipsin:"],
    bullets: [
      "Kişisel verilerinin işlenip işlenmediğini öğrenmek ve işlenmişse bilgi istemek.",
      "İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenmek.",
      "Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilmek.",
      "Eksik veya yanlış işlenmişse düzeltilmesini; işlenmesini gerektiren sebepler ortadan kalkmışsa silinmesini veya yok edilmesini istemek ve bunların aktarıldığı üçüncü kişilere bildirilmesini istemek.",
      "Verilerinin yalnızca otomatik sistemlerle analiz edilmesiyle aleyhine bir sonuç çıkmasına itiraz etmek.",
      "Kanuna aykırı işleme nedeniyle zarara uğradıysan zararın giderilmesini istemek.",
      "Açık rızana dayanan işlemler için rızanı dilediğin an geri almak."
    ]
  },
  {
    heading: "Başvuru ve İletişim",
    paragraphs: [
      `Taleplerini ${SUPPORT_EMAIL} adresine, sistemimizde kayıtlı e-posta adresin üzerinden iletebilirsin; kimliğini doğrulamak için ek bilgi istenebilir. Başvurun en kısa sürede ve en geç otuz gün içinde sonuçlandırılır. Başvuru yollarının tamamı ve veri sorumlusunun tanıtıcı bilgileri KVKK Aydınlatma Metni'nde ve İletişim sayfasında yer alır.`,
      "Bu metin; kullanılan teknolojiler ya da mevzuat değiştikçe güncellenir ve bu sayfada yayımlandığı tarihte geçerli olur. Yeni bir kategori eklenmesi gibi esaslı bir değişiklikte tercihin yeniden sorulur. Ayrıntılı tam metin için Sözleşmeler sayfasındaki Çerez Politikası'na bakabilirsin."
    ]
  }
];

export default function CerezPolitikasi() {
  return (
    <LegalDoc
      title="Çerez Politikası"
      path="/cerez-politikasi"
      updated="15 Kasım 2026"
      seoDescription="OrtakSat Çerez Politikası ve Çerez Aydınlatma Metni: zorunlu kayıtlar izne bağlı değildir; analitik ve reklam ölçümü yalnızca açık rızanla çalışır. Tercihini dilediğin an değiştirebilirsin."
      intro="Zorunlu kayıtlar dışında hiçbir şey iznin olmadan çalışmaz. Hangi kayıtları neden tuttuğumuzu, kimlere aktarıldığını, haklarını ve tercihini nasıl yöneteceğini burada bulabilirsin."
      sections={SECTIONS}
    />
  );
}
