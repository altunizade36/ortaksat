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
    intro: "OrtakSat'ın çerez ve yerel depolama kullanımını açıklar.",
    sections: [
      {
        heading: "1. Kullandığımız çerezler",
        body: [
          "Zorunlu (işlevsel) çerez/depolama: oturum (giriş) bilgisini saklamak ve dil/tercih ayarlarını hatırlamak için gereklidir.",
          "Oturum bilgisi tarayıcınızın yerel deposunda (localStorage) tutulur; üçüncü taraflarla paylaşılmaz."
        ]
      },
      {
        heading: "2. Kullanmadıklarımız",
        body: [
          "Reklam/izleme amaçlı üçüncü taraf çerezleri kullanılmaz.",
          "İleride analitik veya pazarlama çerezleri eklenirse bu metin güncellenir ve gerektiğinde açık rızanız istenir."
        ]
      },
      {
        heading: "3. Yönetim",
        body: [
          "Tarayıcı ayarlarınızdan çerezleri/yerel depolamayı temizleyebilirsiniz; bu durumda oturumunuz kapanır ve bazı tercihler sıfırlanır."
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
  }
};

// Kayıt ekranında ayrı ayrı onaylanacak belgeler (sıralı).
export const CONSENT_DOCS: Array<{ key: keyof typeof LEGAL_DOCS; label: string }> = [
  { key: "kullanim", label: "Kullanım Şartları" },
  { key: "kvkk", label: "KVKK Aydınlatma Metni" },
  { key: "gizlilik", label: "Gizlilik Politikası" },
  { key: "aracilik", label: "Aracılık ve Mesafeli İşlem Bilgilendirmesi" }
];
