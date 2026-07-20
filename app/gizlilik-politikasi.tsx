import { LegalDoc, type LegalSection } from "@/components/legal-doc";

// Gizlilik Politikası — App Store / Google Play zorunlu belgesi. KVKK (6698) uyumlu, dürüst.
const SECTIONS: LegalSection[] = [
  {
    heading: "Veri Sorumlusu ve Kapsam",
    paragraphs: [
      "Bu Gizlilik Politikası, OrtakSat platformunu (web ve mobil uygulama) kullanırken kişisel verilerinizin nasıl işlendiğini açıklar. Veri sorumlusu OrtakSat'tır; her türlü başvuru ve iletişim destek@ortaksat.com üzerinden yapılır.",
      "OrtakSat aracı bir ilan ve iletişim platformudur; ödeme almaz, para tutmaz, komisyon kesmez, kargo yapmaz. Bu politika, platformu kullanmanız sırasında topladığımız verilerle sınırlıdır."
    ]
  },
  {
    heading: "Topladığımız Kişisel Veriler",
    paragraphs: ["Yalnızca hizmeti sağlamak için gerekli verileri toplarız:"],
    bullets: [
      "Hesap bilgileri: e-posta adresi, ad-soyad/görünen ad, şifre (şifrelenmiş saklanır).",
      "İsteğe bağlı profil: telefon numarası, kısa açıklama (bio), sosyal medya kullanıcı adı, konum (il/ilçe).",
      "İçerik verileri: yayınladığınız ilanlar, fotoğraflar, ortaklık başvuruları, mesajlar, talepler, yorumlar ve komisyon kayıtları.",
      "Kimlik/telefon doğrulama durumu (yalnızca 'doğrulandı/doğrulanmadı' bilgisi).",
      "Teknik veriler: cihaz/oturum bilgileri, IP tabanlı genel konum, kullanım günlükleri (güvenlik ve hata takibi için)."
    ]
  },
  {
    heading: "Verileri Nasıl Topluyoruz",
    paragraphs: [
      "Verileri doğrudan sizden (kayıt, profil, ilan, mesaj vb.) ve platformu kullanımınız sırasında otomatik olarak (oturum/günlük kayıtları) toplarız.",
      "Google ile giriş yapmayı seçerseniz, Google hesabınızdan yalnızca e-posta ve ad bilgisi alınır; şifreniz veya başka veri alınmaz."
    ]
  },
  {
    heading: "Verileri Hangi Amaçla İşliyoruz",
    paragraphs: ["Kişisel verilerinizi aşağıdaki amaçlarla işleriz:"],
    bullets: [
      "Hesabınızı oluşturmak, oturum açmanızı ve platformu kullanmanızı sağlamak.",
      "İlan yayınlama, ortaklık başvurusu, mesajlaşma, talep ve komisyon takibi gibi temel işlevleri sunmak.",
      "Güvenliği sağlamak, dolandırıcılık ve kötüye kullanımı önlemek, spam/bot faaliyetini engellemek.",
      "Bildirim ve işlemsel e-postalar (kayıt, mesaj, talep bildirimleri) göndermek.",
      "Destek taleplerini yanıtlamak ve yasal yükümlülükleri yerine getirmek."
    ]
  },
  {
    heading: "Hukuki Sebep (KVKK m.5-6)",
    paragraphs: [
      "Verileriniz; bir sözleşmenin kurulması/ifası (hizmeti sunmak), meşru menfaat (güvenlik ve platformun işletilmesi), hukuki yükümlülük ve gerektiğinde açık rızanız hukuki sebeplerine dayanılarak işlenir. Pazarlama iletişimi yalnızca açık rızanızla yapılır ve dilediğiniz an geri çekebilirsiniz."
    ]
  },
  {
    heading: "Kullandığımız Üçüncü Taraf Hizmetler",
    paragraphs: [
      "Hizmeti sunmak için güvenilir altyapı sağlayıcılarını kullanırız. Bu sağlayıcılar verilerinizi yalnızca bize hizmet vermek için işler:"
    ],
    bullets: [
      "Supabase — kimlik doğrulama, veritabanı ve dosya barındırma (sunucular AB / eu-west-1 bölgesinde).",
      "Vercel — web ve API barındırma; ayrıca çerezsiz, kişi-tanımlamayan Web Analytics.",
      "Resend — işlemsel/bildirim e-postalarının gönderimi.",
      "Google — yalnızca 'Google ile giriş' seçilirse kimlik doğrulama."
    ]
  },
  {
    heading: "Yurt Dışına Aktarım",
    paragraphs: [
      "Barındırma altyapımız AB (eu-west-1) bölgesinde çalıştığından verileriniz yurt dışında işlenebilir. Aktarım, hizmetin sağlanması amacıyla ve uygun güvenlik önlemleriyle yapılır."
    ]
  },
  {
    heading: "Saklama Süresi",
    paragraphs: [
      "Verilerinizi hesabınız aktif olduğu sürece ve hizmetin gerektirdiği süre boyunca saklarız. Hesabınızı kapatmanız hâlinde, yasal saklama yükümlülükleri saklı kalmak kaydıyla verileriniz makul süre içinde silinir veya anonim hâle getirilir."
    ]
  },
  {
    heading: "Veri Güvenliği",
    paragraphs: [
      "Verilerinizi korumak için satır-seviyesi erişim denetimi (RLS), şifreli iletişim (HTTPS) ve erişim kısıtlamaları uygularız. Şifreler geri döndürülemez biçimde saklanır. Hiçbir sistem %100 güvenli olmasa da verilerinizi korumak için makul teknik ve idari tedbirleri alırız."
    ]
  },
  {
    heading: "Haklarınız (KVKK m.11)",
    paragraphs: [
      "Kişisel verileriniz üzerinde; işlenip işlenmediğini öğrenme, bilgi talep etme, düzeltme, silinmesini isteme, işlemeye itiraz etme ve izinlerinizi geri çekme haklarına sahipsiniz. Bu talepleri uygulama içindeki KVKK sayfasından veya destek@ortaksat.com üzerinden iletebilirsiniz; talepler en geç 30 gün içinde ücretsiz sonuçlandırılır."
    ]
  },
  {
    heading: "Çocukların Gizliliği",
    paragraphs: [
      "OrtakSat 18 yaş ve üzeri kullanıcılar içindir. Bilerek 18 yaşından küçüklerden veri toplamayız; böyle bir durumu fark edersek ilgili veriyi sileriz."
    ]
  },
  {
    heading: "Değişiklikler",
    paragraphs: [
      "Bu politikayı zaman zaman güncelleyebiliriz. Önemli değişikliklerde platform üzerinden bilgilendirme yaparız. Güncel sürüm her zaman bu sayfada yayımlanır."
    ]
  }
];

export default function GizlilikPolitikasi() {
  return (
    <LegalDoc
      title="Gizlilik Politikası"
      path="/gizlilik-politikasi"
      updated="11 Temmuz 2026"
      seoDescription="OrtakSat Gizlilik Politikası: hangi verileri topladığımız, nasıl kullandığımız, üçüncü taraf hizmetler ve KVKK kapsamındaki haklarınız."
      intro="Gizliliğiniz bizim için önemlidir. Bu politika, OrtakSat'ı kullanırken kişisel verilerinizin nasıl toplandığını, işlendiğini ve korunduğunu açıklar."
      sections={SECTIONS}
    />
  );
}
