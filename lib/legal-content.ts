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
        heading: "7. Değişiklik ve yürürlük",
        body: [
          "Bu şartlar zaman zaman güncellenebilir; güncel sürüm bu sayfada yayınlanır. Önemli değişikliklerde kullanıcılar bilgilendirilir.",
          "Uyuşmazlıklarda Türkiye Cumhuriyeti hukuku uygulanır."
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
        heading: "5. Haklarınız ve iletişim",
        body: [
          "Verilerinize erişme, düzeltme ve silme haklarınızı KVKK bölümündeki şekilde kullanabilirsiniz.",
          "Sorularınız için Yasal & Destek üzerinden bize ulaşın."
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
          "Tüketici, 6502 sayılı Kanun kapsamındaki haklarını doğrudan satıcıya karşı kullanır.",
          "Taraflar arası anlaşmazlıklardan OrtakSat sorumlu tutulamaz; şüpheli/aykırı durumları Güven Merkezi üzerinden bildirebilirsiniz."
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
        heading: "4. İhlal ve yaptırım",
        body: [
          "Kurallara aykırılık halinde ilan/ortaklık askıya alınabilir, hesap kısıtlanabilir.",
          "Dolandırıcılık veya kötüye kullanım tespitinde hesap kalıcı olarak kapatılabilir ve yasal yollara başvurulabilir."
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
