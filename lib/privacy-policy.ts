// Gizlilik Politikası — TEK KAYNAK. Hem /gizlilik-politikasi sayfası hem de giriş/kayıt ekranındaki
// sözleşme penceresi (lib/legal-content.ts → LEGAL_DOCS.gizlilik) buradan beslenir; iki ayrı metin
// tutmak mağaza incelemesinde "uygulamadaki politika ile bağlantıdaki farklı" sorununa yol açıyordu.
// App Store / Google Play zorunlu belgesi. KVKK (6698) uyumlu, dürüst.
export type PrivacySection = { heading: string; paragraphs: string[]; bullets?: string[] };

export const PRIVACY_UPDATED = "25 Kasım 2026";
export const PRIVACY_INTRO = "Gizliliğiniz bizim için önemlidir. Bu politika, OrtakSat'ı kullanırken kişisel verilerinizin nasıl toplandığını, işlendiğini ve korunduğunu açıklar.";

export const PRIVACY_SECTIONS: PrivacySection[] = [
  {
    heading: "Veri Sorumlusu ve Kapsam",
    paragraphs: [
      "Bu Gizlilik Politikası, OrtakSat platformunu (web ve mobil uygulama) kullanırken kişisel verilerinizin nasıl işlendiğini açıklar. Platformun marka adı OrtakSat'tır; başvuru ve iletişim için destek@ortaksat.com adresi kullanılır.",
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
      "Teknik veriler: cihaz/oturum bilgileri, IP tabanlı genel konum, kullanım günlükleri (güvenlik ve hata takibi için).",
      "Anlık bildirim belirteci: mobil uygulamada bildirime izin verirseniz cihazınıza bildirim gönderebilmek için cihaz belirteci (token) saklanır; bildirimlerde mesaj içeriği gösterilmez. İzni cihaz ayarlarından dilediğiniz an kapatabilirsiniz.",
      "Konum (isteğe bağlı): yalnızca 'Konumumu kullan' gibi bir özelliği kendiniz seçerseniz cihaz konumu o anlık kullanılır; arka planda konum toplanmaz."
    ]
  },
  {
    heading: "Verileri Nasıl Topluyoruz",
    paragraphs: [
      "Verileri doğrudan sizden (kayıt, profil, ilan, mesaj vb.) ve platformu kullanımınız sırasında otomatik olarak (oturum/günlük kayıtları) toplarız.",
      "Google veya Apple ile giriş yapmayı seçerseniz, o hesabınızdan yalnızca e-posta ve (paylaşırsanız) ad bilgisi alınır; şifreniz veya başka veri alınmaz. Apple ile girişte e-postanızı gizlemeyi seçerseniz Apple'ın sizin için ürettiği aktarma adresi kaydedilir."
    ]
  },
  {
    heading: "Verileri Hangi Amaçla İşliyoruz",
    paragraphs: ["Kişisel verilerinizi aşağıdaki amaçlarla işleriz:"],
    bullets: [
      "Hesabınızı oluşturmak, oturum açmanızı ve platformu kullanmanızı sağlamak.",
      "İlan yayınlama, ortaklık başvurusu, mesajlaşma, talep ve komisyon takibi gibi temel işlevleri sunmak.",
      "Güvenliği sağlamak, dolandırıcılık ve kötüye kullanımı önlemek, spam/bot faaliyetini engellemek.",
      "Bildirim ve işlemsel e-postalar (kayıt, mesaj, talep bildirimleri) ile izin verdiğiniz takdirde mobil uygulamada anlık bildirim göndermek.",
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
      "Vercel — web barındırma ve içerik dağıtımı (ABD merkezli; küresel uç sunucular). Ziyaret istatistikleri (Web Analytics, Speed Insights) yalnızca çerez tercihlerinde izin verirsen çalışır; çerez yerleştirmez.",
      "Resend — işlemsel/bildirim e-postalarının gönderimi.",
      "Expo (Expo Push), Apple Push Notification service ve Firebase Cloud Messaging — yalnızca mobil uygulamada anlık bildirime izin verirseniz bildirim iletimi.",
      "Google — yalnızca 'Google ile giriş' seçilirse kimlik doğrulama.",
      "Apple — yalnızca iOS uygulamasında 'Apple ile giriş' seçilirse kimlik doğrulama.",
      "Meta (Facebook / Instagram) Pixel — yalnızca etkinleştirildiği dönemlerde ve yalnızca 'Pazarlama' iznini verirsen reklam ölçümü."
    ]
  },
  {
    heading: "Yurt Dışına Aktarım",
    paragraphs: [
      "Altyapı sağlayıcılarımızın sunucuları Türkiye dışında (başlıca Avrupa Birliği ve ABD) bulunduğundan verileriniz hizmetin sunulabilmesi için yurt dışına aktarılır. Bu aktarımlar KVKK'nın 9. maddesine tabidir: yeterlilik kararı bulunmayan ülkeler bakımından Kişisel Verileri Koruma Kurulu'nun ilan ettiği standart sözleşme gibi uygun güvencelerden birinin sağlanması gerekir. Süreklilik arz eden bu aktarımlar açık rızanıza dayandırılmaz.",
      "Yazı tipimiz kendi alan adımızdan sunulur; sayfa yüklenirken IP adresiniz Google'a veya başka bir üçüncü tarafa iletilmez."
    ]
  },
  {
    heading: "Saklama Süresi",
    paragraphs: [
      "Verilerinizi hesabınız aktif olduğu sürece ve hizmetin gerektirdiği süre boyunca saklarız. Yasal saklama yükümlülükleri saklı kalmak kaydıyla, hesabınız silindiğinde verileriniz silinir veya anonim hâle getirilir."
    ]
  },
  {
    heading: "Hesabınızı Silme",
    paragraphs: [
      "Hesabınızı dilediğiniz an uygulama içinden silebilirsiniz: Menü › Hesap Ayarları › Hesabımı Sil. Aynı işlem web'de ortaksat.com/hesap-silme adresinden de yapılabilir.",
      "Silme talebinden sonra hesabınız 30 gün askıya alınır; bu sürede giriş yaparak talebi iptal edebilirsiniz. 30 günün sonunda profiliniz, ilanlarınız, fotoğraflarınız ve iletişim bilgileriniz kalıcı olarak silinir veya anonim hâle getirilir. Kayıtlı işlem ve komisyon geçmişi gibi yasal olarak saklanması gereken kayıtlar kimliğinizle ilişkilendirilmeden tutulur.",
      "Apple ile giriş yaptıysanız, hesap silindiğinde Apple hesabınızla olan bağlantı da Apple nezdinde iptal edilir."
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
