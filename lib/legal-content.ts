// OrtakSat hukuki metinleri — ORİJİNAL içerik (hiçbir üçüncü taraf sitesinden
// kopyalanmamıştır). Aracı ilan/pazaryeri modeline göre yazılmıştır. Yayına almadan
// önce bir avukata inceletmeniz önerilir; bu metinler hukuki tavsiye değildir.
//
// Hem /legal sayfası hem de kayıt ekranındaki onay-modalları buradan beslenir.

export type LegalSection = { heading: string; body: string[] };
export type LegalDoc = { key: string; title: string; updated: string; intro: string; sections: LegalSection[] };

const UPDATED = "5 Temmuz 2026";

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  kullanim: {
    key: "kullanim",
    title: "Kullanım Şartları",
    updated: UPDATED,
    intro:
      "Bu şartlar, OrtakSat platformunu kullanan tüm ziyaretçi, satıcı ve ortak (affiliate) kullanıcılar için geçerlidir. Platformu kullanarak bu şartları kabul etmiş sayılırsınız.",
    sections: [
      {
        heading: "1. Platformun niteliği (aracı rol)",
        body: [
          "OrtakSat, ürün/hizmet satmak isteyen satıcılar ile bu ürünleri kendi kitlesine tanıtan ortakları (ve alıcıları) buluşturan bir aracı ilan ve iletişim platformudur.",
          "OrtakSat; ürünlerin sahibi, satıcısı, üreticisi, ithalatçısı, ödeme kuruluşu veya kargo/teslimat tarafı DEĞİLDİR. Platform yalnızca ilan yayınlama, ortaklık başvurusu, mesajlaşma ve komisyon takip altyapısı sunar.",
          "Satış sözleşmesi doğrudan satıcı ile alıcı arasında kurulur. OrtakSat bu sözleşmenin tarafı değildir."
        ]
      },
      {
        heading: "2. Hesap ve uygunluk",
        body: [
          "Hesap oluşturan kullanıcı 18 yaşından büyük olduğunu ve verdiği bilgilerin doğru, güncel ve kendisine ait olduğunu beyan eder.",
          "Hesap güvenliğinden (şifre, oturum) kullanıcı sorumludur. Hesabınız üzerinden yapılan işlemlerden siz sorumlu tutulursunuz.",
          "Bir kişi/kurum, yanıltıcı biçimde birden fazla hesap açarak sistemi manipüle edemez."
        ]
      },
      {
        heading: "3. Kullanıcı yükümlülükleri",
        body: [
          "İlan, fiyat, stok, görsel ve ürün bilgilerinin doğruluğundan ilanı açan kullanıcı sorumludur.",
          "Ortaklık ilişkisinde komisyon oranını satıcı belirler; komisyon satış gerçekleştiğinde hak edilir ve taraflar arasında platform dışında ödenir.",
          "Kullanıcılar; yürürlükteki mevzuata, genel ahlaka ve bu şartlara aykırı içerik yayınlamamayı, başkalarının haklarını ihlal etmemeyi kabul eder."
        ]
      },
      {
        heading: "4. Yasaklı içerik ve davranışlar",
        body: [
          "Sahte, taklit, çalıntı veya yasa dışı/kısıtlı ürünler (silah, uyuşturucu, reçeteli ilaç vb.) yasaktır.",
          "Yanıltıcı fiyat/stok/kampanya, spam ve toplu istenmeyen paylaşım, bot kullanımı, marka/telif ihlali yasaktır.",
          "Kullanıcıyı platform dışına yönlendirerek dolandırma amaçlı içerik yasaktır.",
          "İhlal halinde ilan kaldırılabilir, hesap askıya alınabilir veya kapatılabilir."
        ]
      },
      {
        heading: "5. Fikri mülkiyet",
        body: [
          "OrtakSat markası, tasarımı, arayüzü ve yazılımı OrtakSat'a aittir; izinsiz kopyalanamaz.",
          "Kullanıcıların yüklediği içeriğin haklarından kullanıcılar sorumludur; kullanıcı, yüklediği içeriği yayınlama hakkına sahip olduğunu beyan eder."
        ]
      },
      {
        heading: "6. Sorumluluğun sınırı",
        body: [
          "OrtakSat, taraflar arasındaki alım-satım, ödeme, teslimat, iade ve garanti süreçlerinin tarafı olmadığından bunlardan doğan zararlardan sorumlu tutulamaz.",
          "Platform 'olduğu gibi' sunulur; kesintisizlik veya hatasızlık garanti edilmez. Zorunlu bakım/kesintiler olabilir.",
          "OrtakSat, hukuka aykırı kullanımı tespit ettiğinde ilanı/hesabı kısıtlama hakkını saklı tutar."
        ]
      },
      {
        heading: "7. Hesabın askıya alınması ve fesih",
        body: [
          "OrtakSat; bu şartlara, mevzuata veya genel ahlaka aykırı kullanım, dolandırıcılık şüphesi, sahte içerik, spam veya diğer kullanıcıların güvenliğini tehdit eden davranışlar halinde, önceden bildirimde bulunmaksızın ilanı kaldırma, hesabı askıya alma veya kapatma hakkını saklı tutar.",
          "Kullanıcı, dilediği zaman hesabını kapatma talebinde bulunabilir. Hesap kapatıldığında, yasal saklama yükümlülükleri saklı kalmak kaydıyla verileriniz silinir veya anonim hale getirilir.",
          "Askıya alma/fesih, tarafların o ana kadar doğmuş hak ve yükümlülüklerini ortadan kaldırmaz."
        ]
      },
      {
        heading: "8. Bildirimler ve iletişim",
        body: [
          "OrtakSat; hizmete ilişkin bildirimleri uygulama içi bildirim, e-posta veya platform üzerindeki duyurularla yapabilir. Kayıt sırasında verdiğiniz iletişim bilgilerinin güncel olmasından siz sorumlusunuz.",
          "Kullanıcılar arası iletişimin platform içi mesajlaşmada tutulması önerilir; olası bir uyuşmazlıkta bu kayıtlar taraflara yardımcı olabilir."
        ]
      },
      {
        heading: "9. Mücbir sebep",
        body: [
          "Doğal afet, salgın, siber saldırı, altyapı/servis sağlayıcı kesintileri, mevzuat değişiklikleri gibi tarafların kontrolü dışındaki hallerde OrtakSat, hizmette oluşabilecek aksama veya kesintilerden sorumlu tutulamaz."
        ]
      },
      {
        heading: "10. Değişiklik, yürürlük ve uygulanacak hukuk",
        body: [
          "Bu şartlar zaman zaman güncellenebilir; güncel sürüm bu sayfada yayınlanır ve yayınlandığı anda yürürlüğe girer. Önemli değişikliklerde kullanıcılar makul yollarla bilgilendirilir.",
          "Bu şartların uygulanmasında ve yorumlanmasında Türkiye Cumhuriyeti hukuku geçerlidir. Uyuşmazlıklarda, tüketici mevzuatındaki yetki kuralları saklı kalmak üzere ilgili yargı mercileri yetkilidir."
        ]
      }
    ]
  },

  kvkk: {
    key: "kvkk",
    title: "KVKK Aydınlatma Metni",
    updated: UPDATED,
    intro:
      "6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) uyarınca, veri sorumlusu sıfatıyla OrtakSat tarafından kişisel verilerinizin nasıl işlendiğine ilişkin aydınlatma metnidir.",
    sections: [
      {
        heading: "1. Veri sorumlusu",
        body: [
          "Kişisel verileriniz, veri sorumlusu sıfatıyla OrtakSat (ortaksat.com) tarafından aşağıda açıklanan kapsamda işlenir.",
          "Başvuru ve talepleriniz için Yasal & Destek sayfasındaki kanalları kullanabilirsiniz."
        ]
      },
      {
        heading: "2. İşlenen kişisel veriler",
        body: [
          "Kimlik ve iletişim: ad-soyad/mağaza adı, e-posta, telefon (ve isteğe bağlı olarak verdiğiniz diğer bilgiler).",
          "İşlem ve kullanım: ilanlar, ortaklık kayıtları, mesajlar, talepler, komisyon/işlem kayıtları, IP ve oturum bilgileri.",
          "Ödeme için IBAN gibi bilgileri isteğe bağlı verirseniz, yalnızca komisyon tahsilatını kolaylaştırmak amacıyla saklanır; OrtakSat ödeme kuruluşu değildir ve para tutmaz."
        ]
      },
      {
        heading: "3. İşleme amaçları ve hukuki sebep",
        body: [
          "Üyelik ve hesap yönetimi, hizmetin sunulması (ilan, ortaklık, mesajlaşma, komisyon takibi), güvenlik ve dolandırıcılığın önlenmesi, yasal yükümlülüklerin yerine getirilmesi.",
          "Hukuki sebep: sözleşmenin kurulması/ifası, hukuki yükümlülük, meşru menfaat ve gereken hallerde açık rızanız (KVKK md. 5-6)."
        ]
      },
      {
        heading: "4. Aktarım",
        body: [
          "Verileriniz; hizmetin çalışması için kullanılan altyapı/bulut sağlayıcılarına (ör. sunucu ve veritabanı hizmeti) ve yasal olarak yetkili kamu kurumlarına, mevzuatın gerektirdiği ölçüde aktarılabilir.",
          "Verileriniz reklam/pazarlama amacıyla üçüncü taraflara satılmaz."
        ]
      },
      {
        heading: "5. Saklama süresi",
        body: [
          "Kişisel verileriniz, işleme amacının gerektirdiği ve ilgili mevzuatın öngördüğü süre boyunca saklanır; sürenin sonunda silinir, yok edilir veya anonim hale getirilir.",
          "Hesabınızı kapattığınızda, yasal saklama yükümlülükleri saklı kalmak üzere verileriniz silinir/anonimleştirilir."
        ]
      },
      {
        heading: "6. Haklarınız (KVKK md. 11)",
        body: [
          "Kişisel verinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, amacına uygun kullanılıp kullanılmadığını öğrenme, aktarıldığı tarafları bilme.",
          "Eksik/yanlış işlenmişse düzeltilmesini, KVKK'daki şartlarla silinmesini/yok edilmesini ve bunların aktarıldığı taraflara bildirilmesini isteme.",
          "İşlemenin münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme ve zarara uğramanız halinde giderilmesini talep etme.",
          "Bu haklarınızı Yasal & Destek üzerinden bize ileterek kullanabilirsiniz; talebiniz en geç 30 gün içinde sonuçlandırılır."
        ]
      },
      {
        heading: "7. Veri güvenliği tedbirleri",
        body: [
          "Kişisel verilerinize yetkisiz erişimi önlemek için erişim kontrolü, satır bazlı yetkilendirme (RLS), şifreli iletişim ve güncel altyapı gibi idari ve teknik tedbirler uygulanır.",
          "Telefon numarası gibi hassas iletişim bilgileri, herkese açık listelemede gösterilmez; yalnızca ilgili iletişim/ortaklık akışında ve tercihlerinize göre paylaşılır.",
          "OrtakSat hiçbir zaman sizden şifre, kart bilgisi veya SMS/e-posta doğrulama kodunuzu talep etmez."
        ]
      },
      {
        heading: "8. Otomatik kararlar ve profilleme",
        body: [
          "Güvenlik ve dolandırıcılığın önlenmesi amacıyla bazı sinyaller (ör. güven puanı, hız-limiti) otomatik olarak değerlendirilebilir. Bu değerlendirmeler nihai kararların tek başına dayanağı olacak şekilde aleyhinize sonuç doğuracaksa, itiraz hakkınız saklıdır."
        ]
      },
      {
        heading: "9. Başvuru usulü",
        body: [
          "KVKK md. 11 kapsamındaki taleplerinizi kimliğinizi tevsik edici bilgilerle Yasal & Destek sayfasındaki kanallardan iletebilirsiniz.",
          "Başvurunuz talebin niteliğine göre en kısa sürede ve en geç 30 gün içinde ücretsiz olarak sonuçlandırılır; işlemin ayrıca bir maliyet gerektirmesi halinde Kurul'ca belirlenen tarifedeki ücret alınabilir."
        ]
      }
    ]
  },

  gizlilik: {
    key: "gizlilik",
    title: "Gizlilik Politikası",
    updated: UPDATED,
    intro:
      "Bu politika, OrtakSat'ı kullanırken verilerinizin nasıl toplandığını, kullanıldığını ve korunduğunu açıklar. KVKK Aydınlatma Metni ile birlikte okunmalıdır.",
    sections: [
      {
        heading: "1. Topladığımız veriler",
        body: [
          "Hesap ve profil bilgileri, ilan ve ortaklık verileri, mesajlar, işlem/komisyon kayıtları ve teknik veriler (oturum, cihaz/tarayıcı, IP).",
          "Yalnızca hizmet için gerekli verileri toplarız; gereksiz veri talep etmeyiz."
        ]
      },
      {
        heading: "2. Kullanım amacı",
        body: [
          "Hizmeti sunmak, hesabınızı ve güvenliği yönetmek, dolandırıcılığı önlemek, talep ve bildirimlerinizi işlemek, platformu iyileştirmek.",
          "Telefon numaranız, yalnızca ilgili iletişim/ortaklık akışında ve sizin tercihlerinize göre paylaşılır; herkese açık listelemede gösterilmez."
        ]
      },
      {
        heading: "3. Paylaşım",
        body: [
          "Verileriniz altyapı sağlayıcılarımızla (barındırma/veritabanı) ve yasal zorunluluk halinde yetkili mercilerle sınırlı olarak paylaşılır.",
          "Verilerinizi satmıyor, reklam amacıyla üçüncü kişilere pazarlamıyoruz."
        ]
      },
      {
        heading: "4. Güvenlik",
        body: [
          "Erişim kontrolü, satır bazlı yetkilendirme (RLS) ve güncel altyapı ile verilerinizi korumaya çalışırız.",
          "Hiçbir sistem %100 güvenli değildir; güçlü şifre kullanmanız ve şifrenizi kimseyle paylaşmamanız önemlidir. OrtakSat sizden asla şifre/SMS kodu istemez."
        ]
      },
      {
        heading: "5. Veri saklama süresi",
        body: [
          "Verileriniz, işleme amacının ve ilgili mevzuatın gerektirdiği süre boyunca saklanır. Süre sonunda veya hesabınızı kapattığınızda, yasal saklama yükümlülükleri saklı kalmak üzere silinir veya anonim hale getirilir.",
          "İşlem/komisyon kayıtları gibi bazı veriler, olası uyuşmazlıklara karşı ve yasal yükümlülükler nedeniyle daha uzun süre tutulabilir."
        ]
      },
      {
        heading: "6. Üçüncü taraf hizmetler",
        body: [
          "Platform, barındırma ve veritabanı gibi altyapı hizmetlerini üçüncü taraf sağlayıcılardan alır; bu sağlayıcılar verilerinizi yalnızca hizmetin sunulması amacıyla işler.",
          "Platform içindeki bazı bağlantılar üçüncü taraf sitelere yönlendirebilir; bu sitelerin gizlilik uygulamalarından OrtakSat sorumlu değildir."
        ]
      },
      {
        heading: "7. Çocukların gizliliği",
        body: [
          "Platform 18 yaş ve üzeri kullanıcılar içindir. 18 yaşından küçüklerden bilerek kişisel veri toplamayız; böyle bir durum tespit edilirse ilgili veriler silinir."
        ]
      },
      {
        heading: "8. Değişiklikler ve iletişim",
        body: [
          "Bu politika güncellenebilir; güncel sürüm bu sayfada yayınlanır. Önemli değişikliklerde sizi bilgilendiririz.",
          "Verilerinize erişme, düzeltme ve silme haklarınızı KVKK bölümündeki şekilde kullanabilir, sorularınız için Yasal & Destek üzerinden bize ulaşabilirsiniz."
        ]
      }
    ]
  },

  cerez: {
    key: "cerez",
    title: "Çerez Politikası",
    updated: UPDATED,
    intro:
      "Bu politika, OrtakSat'ın çerez ve benzeri teknolojileri (yerel depolama, oturum anahtarları) nasıl ve hangi amaçlarla kullandığını, bu tercihleri nasıl yönetebileceğinizi açıklar. Gizlilik Politikası ve KVKK Aydınlatma Metni ile birlikte okunmalıdır.",
    sections: [
      {
        heading: "1. Çerez nedir?",
        body: [
          "Çerez (cookie), bir internet sitesini ziyaret ettiğinizde tarayıcınız aracılığıyla cihazınıza kaydedilen küçük metin dosyalarıdır. Çerezler; oturumunuzu açık tutmak, tercihlerinizi hatırlamak ve hizmetin güvenli çalışmasını sağlamak gibi amaçlarla kullanılır.",
          "OrtakSat, klasik çerezlerin yanında tarayıcınızın 'yerel depolama' (localStorage) ve 'oturum depolama' (sessionStorage) alanlarını da benzer amaçlarla kullanır; bu metinde tümü birlikte 'çerez' olarak anılır."
        ]
      },
      {
        heading: "2. Çerez kategorileri",
        body: [
          "Zorunlu (Kesinlikle Gerekli) Çerezler: Hizmetin çalışması için zorunludur; devre dışı bırakılamaz. Oturum (giriş) bilgisini saklamak, 'Beni Hatırla' tercihinizi uygulamak, güvenlik ve dolandırıcılık önleme, dil/tema tercihinizi hatırlamak için kullanılır. Bu çerezler için açık rıza aranmaz; hizmetin sunulması için gereklidir.",
          "İşlevsel Çerezler: Gelişmiş özellikleri ve kişiselleştirmeyi mümkün kılar (ör. son görüntülenen tercihleriniz). Devre dışı bırakılırsa bazı özellikler tam çalışmayabilir.",
          "Performans / Analitik Çerezler: Sitenin nasıl kullanıldığını (ziyaret sayısı, hangi sayfaların gezildiği) anonim/toplu biçimde ölçmek için kullanılır. OrtakSat şu anda üçüncü taraf analitik çerezi KULLANMAMAKTADIR; ileride eklenirse yalnızca açık rızanızla etkinleştirilir.",
          "Hedefleme / Pazarlama Çerezleri: Size özel reklam göstermek amacıyla üçüncü taraflarca yerleştirilen çerezlerdir. OrtakSat bu tür çerezleri KULLANMAMAKTADIR ve reklam amaçlı üçüncü taraf takip çerezi yerleştirmez."
        ]
      },
      {
        heading: "3. Şu an kullandığımız çerezler",
        body: [
          "Bugün itibarıyla OrtakSat yalnızca ZORUNLU ve İŞLEVSEL kategorideki çerez/depolamayı kullanır: giriş oturumu, 'Beni Hatırla' tercihi, dil/tema ayarı ve güvenlik.",
          "Oturum bilgisi, tercihinize göre tarayıcınızın localStorage (kalıcı) veya sessionStorage (tarayıcı kapanınca silinir) alanında tutulur ve üçüncü taraflarla paylaşılmaz.",
          "Reklam/izleme amaçlı hiçbir üçüncü taraf çerezi kullanılmaz; verileriniz reklam için satılmaz."
        ]
      },
      {
        heading: "4. Çerez tercihlerini yönetme",
        body: [
          "Zorunlu çerezler hizmetin çalışması için gerekli olduğundan devre dışı bırakılamaz; ancak tüm çerezleri tarayıcı ayarlarınızdan temizleyebilir veya engelleyebilirsiniz.",
          "Çerezleri temizlerseniz oturumunuz kapanır ve dil/tema gibi bazı tercihleriniz sıfırlanır.",
          "İleride analitik veya pazarlama çerezleri eklenirse, bunları etkinleştirmeden önce ayrı bir çerez tercih ekranı ile onayınız istenecektir."
        ]
      },
      {
        heading: "5. Değişiklikler",
        body: [
          "Bu Çerez Politikası, hizmetlerimizdeki veya mevzuattaki değişikliklere bağlı olarak güncellenebilir. Güncel sürüm bu sayfada yayınlanır ve yayınlandığı tarihte yürürlüğe girer."
        ]
      }
    ]
  },

  aracilik: {
    key: "aracilik",
    title: "Aracılık ve Mesafeli İşlem Bilgilendirmesi",
    updated: UPDATED,
    intro:
      "OrtakSat'ın satış işlemindeki rolünü ve tarafların sorumluluklarını açıklar. Bu metin, platformun aracı niteliğini netleştirir.",
    sections: [
      {
        heading: "1. OrtakSat satışın tarafı değildir",
        body: [
          "OrtakSat, mesafeli satış sözleşmesi anlamında SATICI taraf değildir; ürünün sahibi, satıcısı, ithalatçısı, ödeme kuruluşu veya kargo/teslimat tarafı değildir.",
          "Mesafeli satış sözleşmesi doğrudan ilanı açan satıcı ile alıcı arasında kurulur; ürün bilgisi, fiyat, fatura, teslimat, cayma/iade ve garanti yükümlülükleri satıcıya aittir."
        ]
      },
      {
        heading: "2. Ödeme ve para akışı",
        body: [
          "OrtakSat ödeme almaz, para tutmaz, komisyon kesmez, cüzdan/bakiye/emanet (escrow) sağlamaz ve otomatik para dağıtmaz.",
          "İlanlarda gösterilen fiyat ve komisyon yalnızca taraflar arası BİLGİ amaçlıdır. Ödeme ve teslimat, tarafların kendi aralarında anlaştıkları yöntemle, kendi sorumluluklarında gerçekleşir."
        ]
      },
      {
        heading: "3. Komisyon (ortaklık) modeli",
        body: [
          "Komisyon oranını ilanı açan satıcı belirler; ortak, paylaşmadan önce kazanacağı komisyonu ilanda net görür.",
          "Komisyon yalnızca satış tamamlandığında ve satıcı onayladığında hak edilir; ödeme taraflar arasında anlaşılan kanaldan yapılır.",
          "İade penceresi içinde iade olursa komisyon kaydı beklemeye alınır ve süreç panelden şeffaf izlenir."
        ]
      },
      {
        heading: "4. Tüketici hakları ve anlaşmazlık",
        body: [
          "Tüketici, 6502 sayılı Tüketicinin Korunması Hakkında Kanun kapsamındaki haklarını (ayıplı mal, cayma, iade vb.) doğrudan satıcıya karşı kullanır.",
          "Taraflar arası anlaşmazlıklardan OrtakSat sorumlu tutulamaz; platform yalnızca ilan ve iletişim altyapısı sunar. Şüpheli/aykırı durumları Güven Merkezi üzerinden bildirebilirsiniz."
        ]
      },
      {
        heading: "5. Güvenli işlem önerileri",
        body: [
          "Ürünü görmeden/teslim almadan ödeme yapmamanız; tanımadığınız tarafa yüksek tutarlı ön ödeme/kapora göndermemeniz önerilir.",
          "Komisyon oranını, ödeme zamanını ve yöntemini yazılı (platform içi mesaj) olarak netleştirmeniz, olası uyuşmazlıklarda sizi korur.",
          "Piyasa değerinin çok altındaki 'kaçırılmayacak fırsat' ilanlarına ve sizi platform dışına yönlendiren taleplere şüpheyle yaklaşın."
        ]
      },
      {
        heading: "6. Vergi ve yasal yükümlülükler",
        body: [
          "Satış ve komisyon gelirlerine ilişkin vergi, fatura ve diğer yasal yükümlülükler ilgili tarafların (satıcı/ortak) kendi sorumluluğundadır. OrtakSat bu yükümlülüklerin tarafı veya sorumlusu değildir."
        ]
      }
    ]
  },

  ortak: {
    key: "ortak",
    title: "Satıcı ve Ortak (Affiliate) Sözleşmesi",
    updated: UPDATED,
    intro:
      "Satıcı olarak ilan açan veya ortak olarak ilan tanıtan kullanıcılar için ek kurallar. Kullanım Şartları ile birlikte geçerlidir.",
    sections: [
      {
        heading: "1. Satıcı yükümlülükleri",
        body: [
          "Satıcı; ürün, fiyat, stok ve komisyon bilgilerini doğru ve güncel tutmakla yükümlüdür.",
          "Satıcı, ortağın getirdiği satışta ilanda belirttiği komisyonu ödemeyi taahhüt eder; ödeme taraflar arasında yapılır.",
          "Satıcı, satış/teslimat/iade/garanti süreçlerinin tek sorumlusudur."
        ]
      },
      {
        heading: "2. Ortak (affiliate) yükümlülükleri",
        body: [
          "Ortak; ürünü yanıltıcı olmadan, gerçek bilgilerle tanıtır. Sahte vaat, spam ve yanıltıcı reklam yasaktır.",
          "Ortak, referans/paylaşım bağlantısını kendi kitlesine dürüstçe ulaştırır; sahte tıklama/lead üretmez.",
          "Komisyon, yalnızca onaylı ve iade edilmeyen satışlarda hak edilir."
        ]
      },
      {
        heading: "3. Ödeme ve şeffaflık",
        body: [
          "OrtakSat para tutmadığından komisyon ödemesi satıcı ile ortak arasında gerçekleşir; platform yalnızca kaydı ve durumu takip eder.",
          "Anlaşmazlık halinde taraflar önce kendi aralarında çözmeye çalışır; gerekirse Güven Merkezi'ne bildirir."
        ]
      },
      {
        heading: "4. Vergi ve gelir sorumluluğu",
        body: [
          "Ortaklık/komisyon gelirlerine ilişkin vergi ve beyan yükümlülükleri, geliri elde eden tarafın kendi sorumluluğundadır. OrtakSat para tutmadığı ve ödeme kuruluşu olmadığı için bu yükümlülüklerin tarafı değildir."
        ]
      },
      {
        heading: "5. İhlal ve yaptırım",
        body: [
          "Kurallara aykırılık halinde ilan/ortaklık askıya alınabilir, hesap kısıtlanabilir.",
          "Dolandırıcılık, sahte lead/tıklama üretimi veya kötüye kullanım tespitinde hesap kalıcı olarak kapatılabilir ve gerekli hallerde yasal yollara başvurulabilir."
        ]
      }
    ]
  },

  hesap: {
    key: "hesap",
    title: "Bireysel Hesap Sözleşmesi",
    updated: UPDATED,
    intro:
      "Bu Bireysel Hesap Sözleşmesi (\"Sözleşme\"), OrtakSat platformunda hesap oluşturan gerçek kişi kullanıcı (\"Hesap Sahibi\") ile OrtakSat'ı işleten işletme arasında, elektronik ortamda kurulan sözleşmedir. Hesap oluşturarak bu Sözleşme'yi ve eklerini kabul etmiş olursunuz. Bu metin hukuki tavsiye değildir; yayına almadan önce bir avukata inceletmeniz önerilir.",
    sections: [
      {
        heading: "1. Taraflar",
        body: [
          "Bu Sözleşme; bir tarafta ortaksat.com alan adı ve bağlı alt alan adları ile mobil uygulamalar üzerinden hizmet sunan OrtakSat (\"Platform\" veya \"OrtakSat\") ile diğer tarafta Platform'da bireysel hesap açan Hesap Sahibi arasında akdedilmiştir.",
          "Hesap Sahibi, Platform'daki hesap formunu doğru, güncel ve kendisine ait bilgilerle doldurduğunu ve bu Sözleşme ile eklerini okuyup kabul ettiğini beyan eder."
        ]
      },
      {
        heading: "2. Tanımlar",
        body: [
          "Platform: ortaksat.com ve bağlı alan adları ile mobil uygulamalardan oluşan, OrtakSat hizmetlerinin sunulduğu ortam.",
          "Kullanıcı: Platform'a erişen her gerçek veya tüzel kişi.",
          "Hesap Sahibi: Platform'da hesap açan ve sunulan hizmetlerden bu Sözleşme'de belirlenen koşullarla yararlanan Kullanıcı.",
          "Satıcı: Platform'da ürün/hizmet ilanı açan Hesap Sahibi. Ortak (Affiliate): Bir satıcının ilanını kendi kitlesine tanıtan ve satış gerçekleştiğinde komisyon hak eden Hesap Sahibi.",
          "Hizmetler: İlan yayınlama, ortaklık başvurusu, mesajlaşma, komisyon takibi ve benzeri, Platform tarafından sunulan uygulamalar bütünü.",
          "İçerik: Platform'da yayınlanan her türlü bilgi, yazı, görsel, video ve veri."
        ]
      },
      {
        heading: "3. Sözleşme'nin konusu ve kapsamı",
        body: [
          "Bu Sözleşme'nin konusu; Hizmetler'in kapsamı, bu Hizmetler'den yararlanma şartları ile tarafların hak ve yükümlülüklerinin belirlenmesidir.",
          "Platform içinde kullanıma, hesaba ve Hizmetler'e ilişkin OrtakSat tarafından yapılan tüm kural, duyuru ve açıklamalar bu Sözleşme'nin kapsamındadır. Hesap Sahibi, bu beyanlara uygun davranmayı kabul eder."
        ]
      },
      {
        heading: "4. Hesap şartları",
        body: [
          "Hesap açabilmek için 18 yaşını doldurmuş ve fiil ehliyetine sahip olmak; hesabın daha önce kapatılmamış veya askıya alınmamış olması gerekir.",
          "Hesap hak ve yükümlülükleri kişiseldir; kısmen veya tamamen üçüncü kişilere devredilemez.",
          "OrtakSat, hesap başvurusunu gerekçe göstermeksizin reddedebilir veya ek şart/belge talep edebilir."
        ]
      },
      {
        heading: "5. Hesap Sahibi'nin hak ve yükümlülükleri",
        body: [
          "Hesap Sahibi; mevzuata, genel ahlaka ve Platform kurallarına uygun davranacağını kabul eder.",
          "Giriş bilgilerinin (e-posta, şifre, oturum) güvenliğinden Hesap Sahibi sorumludur; bu bilgileri üçüncü kişilerle paylaşmamalıdır. Hesap üzerinden yapılan işlemlerden Hesap Sahibi sorumlu tutulur.",
          "Hesap Sahibi, Platform'a girdiği ilan, fiyat, stok, görsel ve ürün bilgilerinin doğru ve hukuka uygun olduğunu; bu içeriklerin üçüncü kişilerin haklarını (marka, telif, kişilik hakları vb.) ihlal etmediğini beyan ve taahhüt eder.",
          "Hesap Sahibi, başvuru sırasında verdiği bilgilerin değişmesi halinde bunları gecikmeksizin günceller.",
          "Hesap Sahibi; Platform'un veya diğer kullanıcıların güvenliğini tehdit eden, sistemi manipüle eden veya orantısız yük bindiren davranışlarda bulunmayacağını kabul eder."
        ]
      },
      {
        heading: "6. OrtakSat'ın hak ve yükümlülükleri",
        body: [
          "OrtakSat, Hizmetler'i sunmak için gerekli teknolojik altyapıyı makul ölçüde tesis etmeye çalışır; ancak bu, kesintisiz ve hatasız hizmet taahhüdü anlamına gelmez. OrtakSat, önceden bildirimde bulunmaksızın Hizmetler'i değiştirebilir, durdurabilir veya sonlandırabilir.",
          "OrtakSat, 5651 sayılı Kanun kapsamında 'yer sağlayıcı' olarak faaliyet gösterir; Hesap Sahibi tarafından üretilen içeriğin doğruluğunu ve hukuka uygunluğunu araştırma yükümlülüğü bulunmaz.",
          "OrtakSat; hukuka, mevzuata, üçüncü kişi haklarına veya Platform kurallarına aykırı içerikleri, önceden bildirimde bulunmaksızın erişimden kaldırma ve ilgili hesabı kısıtlama/askıya alma hakkını saklı tutar.",
          "OrtakSat Platform'u 'olduğu gibi' sunar; belirli bir sonucun üretileceğini, hizmetin kesintisiz veya hatasız olacağını taahhüt etmez."
        ]
      },
      {
        heading: "7. Aracı niteliği ve para akışı",
        body: [
          "OrtakSat bir aracı ilan ve iletişim platformudur; satış sözleşmesinin tarafı, ürünün sahibi/satıcısı, ödeme kuruluşu veya kargo/teslimat tarafı değildir.",
          "OrtakSat ödeme almaz, para tutmaz, komisyon kesmez ve emanet (escrow) sağlamaz. Ödeme ve teslimat taraflar arasında, kendi sorumluluklarında gerçekleşir. Ayrıntı için Aracılık ve Mesafeli İşlem Bilgilendirmesi geçerlidir."
        ]
      },
      {
        heading: "8. Kişisel verilerin korunması",
        body: [
          "OrtakSat, Hesap Sahibi'ne ait kişisel verileri KVKK Aydınlatma Metni ve Gizlilik Politikası kapsamında işler. Bu metinler bu Sözleşme'nin ayrılmaz ekleridir.",
          "Hesap Sahibi, ilanla ilgili iletişim için gerekli olduğunda, tercihlerine bağlı olarak iletişim bilgilerinin karşı tarafla paylaşılabileceğini kabul eder."
        ]
      },
      {
        heading: "9. Fikri mülkiyet hakları",
        body: [
          "Platform'un markası, arayüzü, tasarımı, veritabanı ve yazılımı dahil tüm unsurları OrtakSat'a aittir ve fikri mülkiyet mevzuatı ile korunur; izinsiz kopyalanamaz, çoğaltılamaz veya işlenemez.",
          "Hesap Sahibi, Platform'a yüklediği içeriğin haklarına sahip olduğunu; OrtakSat'a, bu içeriği Hizmetler'in sunulması amacıyla kullanma hususunda basit (münhasır olmayan) bir ruhsat verdiğini kabul eder."
        ]
      },
      {
        heading: "10. Sözleşme değişiklikleri",
        body: [
          "OrtakSat, bu Sözleşme'yi ve eklerini tek taraflı olarak güncelleyebilir. Değişiklikler Platform'da yayınlandığı tarihte yürürlüğe girer; önemli değişikliklerde Hesap Sahibi makul yollarla bilgilendirilir. Sözleşme, Hesap Sahibi'nin tek taraflı beyanı ile değiştirilemez."
        ]
      },
      {
        heading: "11. Hesabın askıya alınması, kapatılması ve fesih",
        body: [
          "OrtakSat; bu Sözleşme'ye, mevzuata veya genel ahlaka aykırılık, dolandırıcılık şüphesi, sahte/yanıltıcı içerik, spam, güvenlik tehdidi veya başvuruda yanlış bilgi verilmesi gibi hallerde, tazminat yükümlülüğü olmaksızın hesabı askıya alabilir veya kapatabilir.",
          "Hesap Sahibi, dilediği zaman hesabını kapatma talebinde bulunabilir. Hesap silme talebi alındığında hesap 30 gün askıya alınır; bu süre içinde giriş yapılarak talep iptal edilebilir. Süre sonunda, yasal saklama yükümlülükleri saklı kalmak üzere veriler silinir veya anonim hale getirilir.",
          "Askıya alma/fesih, tarafların o ana kadar doğmuş hak ve yükümlülüklerini ortadan kaldırmaz."
        ]
      },
      {
        heading: "12. Mücbir sebep",
        body: [
          "Doğal afet, salgın, savaş, grev, siber saldırı, altyapı/servis sağlayıcı kesintileri, elektrik veya internet arızaları ve mevzuat değişiklikleri gibi tarafların makul kontrolü dışındaki hallerde OrtakSat, edimlerini geç veya eksik ifa etmesinden ya da ifa edememesinden sorumlu tutulamaz."
        ]
      },
      {
        heading: "13. Uygulanacak hukuk, yetki ve yürürlük",
        body: [
          "Bu Sözleşme'nin uygulanmasında ve yorumlanmasında Türkiye Cumhuriyeti hukuku geçerlidir. Uyuşmazlıklarda, tüketici mevzuatındaki yetki kuralları saklı kalmak üzere ilgili yargı mercileri ve icra daireleri yetkilidir.",
          "Bu Sözleşme, Hesap Sahibi'nin elektronik olarak onay vermesiyle yürürlüğe girer. Herhangi bir hükmün geçersizliği, diğer hükümlerin geçerliliğini etkilemez.",
          "Ekler: Kullanım Şartları, KVKK Aydınlatma Metni, Gizlilik Politikası, Çerez Politikası, İlan Verme Kuralları, Yasaklı ve Kısıtlı Ürünler Listesi, Aracılık ve Mesafeli İşlem Bilgilendirmesi ile Satıcı ve Ortak Sözleşmesi bu Sözleşme'nin ayrılmaz parçalarıdır."
        ]
      }
    ]
  },

  ilan: {
    key: "ilan",
    title: "İlan Verme Kuralları",
    updated: UPDATED,
    intro:
      "İlan açan tüm satıcılar için geçerli içerik ve kalite kurallarıdır. Kullanım Şartları ve Yasaklı Ürünler Listesi ile birlikte uygulanır. Bu kurallara aykırı ilanlar yayından kaldırılabilir ve hesap kısıtlanabilir.",
    sections: [
      {
        heading: "1. Genel ilkeler",
        body: [
          "İlan; gerçek, satışa/tanıtıma uygun ve ilan sahibinin tasarruf yetkisinde olan bir ürün/hizmet için açılmalıdır.",
          "İlan başlığı, açıklaması, görselleri ve fiyatı ürünle birebir uyumlu ve doğru olmalıdır. Yanıltıcı başlık, alakasız görsel veya gerçek dışı fiyat/stok kullanılamaz.",
          "Aynı ürün için mükerrer (tekrarlı) ilan açılamaz; kategori ve konum doğru seçilmelidir."
        ]
      },
      {
        heading: "2. Görsel ve içerik standartları",
        body: [
          "Görseller ürünün kendisine ait olmalı; başka satıcıya, siteye veya telifli bir kaynağa ait görseller izinsiz kullanılamaz.",
          "Görsel veya açıklama üzerinde telefon/di̇ğer platform yönlendirmesi, filigran, reklam veya kullanıcıyı Platform dışına çekme amaçlı içerik bulunamaz.",
          "Açıklamada nefret söylemi, hakaret, ayrımcılık, müstehcenlik veya üçüncü kişilerin kişisel verileri yer alamaz."
        ]
      },
      {
        heading: "3. Fiyat, stok ve komisyon",
        body: [
          "Fiyat ve stok bilgisi güncel ve gerçekçi olmalıdır. Ortaklığa açık ilanlarda komisyon oranı açık ve doğru belirtilmelidir; ortak, paylaşmadan önce kazancını net görür.",
          "Piyasa değerinin gerçek dışı biçimde altında/üstünde gösterilen, alıcıyı yanıltıcı 'sahte fırsat' ilanları yasaktır."
        ]
      },
      {
        heading: "4. Örnek/demo ilanlar",
        body: [
          "Platformu tanıtmak amacıyla yayınlanan örnek içerikler açıkça 'ÖRNEK/DEMO' olarak etiketlenir. Gerçek olmayan bir ilanın gerçekmiş gibi sunulması yasaktır."
        ]
      },
      {
        heading: "5. Moderasyon ve yaptırım",
        body: [
          "İlanlar; kurallara, mevzuata ve genel ahlaka aykırılık yönünden incelenebilir. Aykırı bulunan ilanlar düzeltme istenerek veya doğrudan yayından kaldırılabilir.",
          "Tekrarlayan veya ağır ihlallerde hesap askıya alınabilir ya da kapatılabilir; gerekli hallerde yetkili mercilere bildirim yapılabilir."
        ]
      }
    ]
  },

  yasakli: {
    key: "yasakli",
    title: "Yasaklı ve Kısıtlı Ürünler Listesi",
    updated: UPDATED,
    intro:
      "Aşağıdaki ürün ve hizmetlerin Platform'da ilan edilmesi, satışa arzı veya tanıtımı yasaktır ya da özel kısıtlara tabidir. Liste örnekleyicidir; burada sayılmayan ancak mevzuata veya genel ahlaka aykırı olan ürünler de yasak kapsamındadır.",
    sections: [
      {
        heading: "1. Yasa dışı ve tehlikeli ürünler",
        body: [
          "Ateşli/ateşsiz silahlar, mühimmat, patlayıcı, piroteknik ve bunların parçaları.",
          "Uyuşturucu ve uyarıcı maddeler, bunların kullanımına yönelik araç-gereçler.",
          "Reçeteli ilaçlar, kontrole tabi tıbbi ürünler ve onaysız takviye/tedavi vaadi içeren ürünler.",
          "Zehirli, radyoaktif, yanıcı veya çevreye/insana zarar veren kısıtlı kimyasallar."
        ]
      },
      {
        heading: "2. Fikri mülkiyet ve resmi belge ihlalleri",
        body: [
          "Sahte, taklit (replika) veya marka/telif hakkı ihlali içeren ürünler.",
          "Korsan yazılım, kopya dijital içerik ve lisanssız erişim kodları.",
          "Resmi kimlik, pasaport, diploma, plaka, resmi kurum belgesi ve üniforma gibi belge/eşyalar."
        ]
      },
      {
        heading: "3. Kişiye/topluma zarar veren içerikler",
        body: [
          "İnsan organ/doku, kan ve benzeri biyolojik materyaller.",
          "Nesli tehlike altındaki canlılar, yasa dışı avlanma ürünleri ve mevzuata aykırı canlı hayvan satışı.",
          "Müstehcen/pornografik içerik, kumar ve yasa dışı bahis hizmetleri.",
          "Nefret söylemi, ayrımcılık, terör veya şiddeti öven içerik ve semboller."
        ]
      },
      {
        heading: "4. Finansal ve dolandırıcılık amaçlı içerikler",
        body: [
          "Çalıntı kart/hesap bilgileri, sahte para, dolandırıcılık amaçlı 'kolay para' vaatleri ve saadet zinciri türü sistemler.",
          "Kullanıcıyı Platform dışına yönlendirerek ön ödeme/kapora ile kandırmayı amaçlayan içerikler."
        ]
      },
      {
        heading: "5. Bildirim ve yaptırım",
        body: [
          "Bu kapsamdaki ilanlar tespit edildiğinde yayından kaldırılır ve ilgili hesap kısıtlanır veya kapatılır; gerekli hallerde yetkili mercilere bildirim yapılır.",
          "Şüpheli bir ilanı veya kullanıcıyı Güven Merkezi üzerinden bildirebilirsiniz."
        ]
      }
    ]
  },

  programatik: {
    key: "programatik",
    title: "Programatik Sistemler, Yapay Zekâ ve API Kuralları",
    updated: UPDATED,
    intro:
      "Bu kurallar; Platform içeriğine otomatik veya yarı otomatik erişen tüm sistemler (bot, tarayıcı/scraper, yapay zekâ aracıları, büyük dil modelleri, otomasyon araçları) ve bunları geliştiren/işleten kişiler için geçerlidir. Amaç, veri güvenliğini ve kullanıcı haklarını korumaktır.",
    sections: [
      {
        heading: "1. Kapsam",
        body: [
          "Programatik Sistemler; yazılım, algoritma ve botları; veri tarama (crawler), veri kazıma (scraper) ve toplama araçlarını; yapay zekâ, makine öğrenmesi sistemlerini ve büyük dil modellerini (LLM); tarayıcı tabanlı olsun olmasın içerik işleyen otomasyon araçlarını ve 'yapay zekâ aracılarını' (AI agent) kapsar.",
          "Bu sistemleri geliştiren, işleten, kullanan veya bunlardan fayda sağlayan tüm gerçek ve tüzel kişiler bu kurallara tabidir."
        ]
      },
      {
        heading: "2. İzinsiz erişim ve kullanım yasağı",
        body: [
          "OrtakSat'ın açık ve yazılı izni olmadan; Platform içeriğinin toplu olarak kopyalanması, çoğaltılması, taranması, işlenmesi, başka veri tabanına aktarılması veya indekslenmesi yasaktır.",
          "Platform içeriğinin, yapay zekâ modellerini (büyük dil modelleri dâhil) eğitmek, geliştirmek veya test etmek amacıyla izinsiz kullanılması yasaktır.",
          "CAPTCHA, güvenlik duvarı, hız-limiti ve robots.txt gibi güvenlik önlemlerini aşmaya yönelik erişim yasaktır."
        ]
      },
      {
        heading: "3. İzinli yapay zekâ aracıları için kurallar",
        body: [
          "Açık ve yazılı şekilde izin verilmiş aracılar; her istekte, erişimin bir yapay zekâ aracısı tarafından yapıldığını kullanıcı-aracı (user-agent) bilgisinde açıkça belirtmelidir.",
          "Kimliğini gizlememeli; insan etkileşimi izlenimi vermek için gezinme/etkileşim örüntülerini taklit etmemelidir.",
          "Tüm güvenlik önlemlerine ve OrtakSat'ın erişimi kısıtlama/engelleme talimatlarına derhal uymalıdır."
        ]
      },
      {
        heading: "4. API kullanımı",
        body: [
          "API erişimi (varsa) yalnızca OrtakSat tarafından kimlik doğrulaması ve yetkilendirmesi yapılan uygulamalar için, belirlenen kurallar, hız sınırları ve güvenlik önlemleri çerçevesinde sağlanır. API, veritabanına doğrudan erişim hakkı vermez.",
          "API anahtarlarının izinsiz paylaşımı, protokollerin kırılmaya çalışılması veya kapsam dışı kullanım yasaktır."
        ]
      },
      {
        heading: "5. Yaptırım",
        body: [
          "Bu kurallara aykırı erişim tespit edildiğinde OrtakSat; ilgili kullanıcı/sistem erişimini engelleme, IP/sistem bloklama, hesabı kapatma ve yasal yollara başvurma hakkını saklı tutar.",
          "İhlalden doğan sorumluluk, sistemi geliştiren, işleten ve kullanan taraflara müştereken ve müteselsilen aittir."
        ]
      }
    ]
  }
};

// Yasal merkezde sahibinden benzeri gruplu menü için belge kataloğu.
export type LegalGroup = { title: string; icon: string; keys: Array<keyof typeof LEGAL_DOCS> };
export const LEGAL_GROUPS: LegalGroup[] = [
  { title: "Sözleşmeler", icon: "file-sign", keys: ["hesap", "ortak", "aracilik"] },
  { title: "Kurallar ve Politikalar", icon: "gavel", keys: ["kullanim", "ilan", "yasakli", "programatik"] },
  { title: "Kişisel Verilerin Korunması", icon: "shield-lock-outline", keys: ["kvkk", "gizlilik"] },
  { title: "Çerez Yönetimi", icon: "cookie-outline", keys: ["cerez"] }
];

// Kayıt ekranında ayrı ayrı onaylanacak belgeler (sıralı).
export const CONSENT_DOCS: Array<{ key: keyof typeof LEGAL_DOCS; label: string }> = [
  { key: "kullanim", label: "Kullanım Şartları" },
  { key: "kvkk", label: "KVKK Aydınlatma Metni" },
  { key: "gizlilik", label: "Gizlilik Politikası" },
  { key: "aracilik", label: "Aracılık ve Mesafeli İşlem Bilgilendirmesi" }
];
