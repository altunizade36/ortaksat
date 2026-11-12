# Mobil arayüz ve yayın öncesi kontrol — 23 Ekim 2026

## 23 Ekim: referans ekranların güncel uygulama durumu

Bu bölüm aşağıdaki tarihli çalışma notlarının yerine geçer. Önceki notlarda eksik olarak belirtilen destek ekleri/yanıtları, kullanıcı adı/ilçe/sosyal alanlar, şikâyet/değerlendirme formları ve bildirim tercihleri artık uygulanmıştır. Bütün referansların birebir görsel eşitliği veya bütün platformlarda hatasız çalışma garantisi verilmez.

| Ekran / akış | Uygulanan davranış | Doğrulama |
| --- | --- | --- |
| Açılır yan menü | Sağdan animasyon, arka alana dokunma/X/Android geri/sürükleme ile kapatma; açılır ortaklık ve araç grupları; gerçek sayaçlar, mevcut kedi maskotu | `check-mobile-discovery-ui.mjs`, gerçek Android `native-drawer-top.png` |
| Keşfet / arama / filtreler | Altı keşif sekmesi, sunucu sıralaması ve sayfalama, kategori alanları, konum, kayıtlı arama ve ilgi alanları | Discovery/catalogue/filter testleri; 320–390 px |
| Ortak Satış / talepler / aktif ortaklık | İki sütunlu ilan kartları, komisyon, açık ilan filtresi, başvuru ve sunucu sonucunu bekleyen onay/ret, gerçek durum detayları | `check-mobile-partnership-ui.mjs`, Android `native-resumed.png` |
| İlanlarım / düzenleme / önizleme | Gerçek durumlar, taslak, kategori özellikleri, fotoğraflar, atomik kapak kaydı, komisyon/kontenjan, ortak yönetimine bağlantı | Management UI ve atomic cover DB testleri |
| İlan istatistikleri | Ayrı `/listing-stats/[id]` ekranı, 7/30/90 gün, günlük/haftalık/aylık grafik, toplam etkileşimler ve kayıtlı bağlantı kaynakları | `check-mobile-analytics-ui.mjs`, `check-mobile-listing-analytics-db.mjs` |
| Ortaklık kazançları | Tüm erişilebilir kayıtlardan sunucuda toplamlar; para birimi ayrımı, altı aylık grafik, 24 kayıtla sayfalama | `check-mobile-earnings-ui.mjs`, earnings DB testi, gerçek Android `native-earnings.png` |
| Satıcı mağazası | Profil/kapak/iletişim, sunucuda kategori/sıralama/arama, yorum türleri ve sayfalama; arama boşken de satıcının uygun ilanından sohbet başlatma | Analytics UI ve offers/block UI testleri |
| Teklifler | Gelen/gönderilen, durumlar, kabul/ret/geri çekme/karşı teklif; TL binlik ayracı; hata halinde tutarı koruma | `check-mobile-offers-block-ui.mjs` |
| Kullanıcı/ilan şikâyeti ve takibi | Neden, açıklama, en fazla beş özel ek, gerçek kayıt numarası, durum/filtre/detay ve ilgili içerik kartı | `check-mobile-reports-review-ui.mjs`, evidence DB testi |
| Yorum ve değerlendirme | Uygun tamamlanmış satış, 1–5 yıldız, deneyim etiketleri, görsel, aynı UUID ile güvenli tekrar deneme | Reports/review UI: sunucuda kaydolup cevabı kaybolmuş yorum tekrarında tek kayıt |
| Kullanıcı engelle / engellenenler | Alt panelde isteğe bağlı neden, sunucuya kayıt sonrası sonuç, arama/sıralama/kaldırma; yeni mesaj/talep/takip kısıtları | Blocking DB ve offers/block UI testleri |
| Destek / yardım | Gerçek destek talepleri, özel ekler, personel/kullanıcı yanıtları, sayfalama; kapanıp açılan talepte yanıt taslağını koruma; yardım arama/akordeon | `check-mobile-support-ui.mjs`, support DB testi |
| Hesap / profil / güvenlik | Kullanıcı adı, il/ilçe, web/Instagram, fotoğraf, gizli e-posta, mevcut şifre doğrulaması, bekleyen e-posta değişikliği, oturum geçmişi/çıkış | `check-mobile-security-ui.mjs`, profile details DB testi |
| Bildirim / fiyat takibi | Genel/grup/tür tercihi; fiyat düşüşünde genel anahtar ve ilan başına sessize alma; gerçek kaydedilen fiyat karşılaştırması | Price watch UI/DB testleri; %1 altındaki değişimler de listelenir |
| Alıcı bulma / talep / eşleştirme | Gerçek talepler, bütçe/konum/kategori/para birimi, ilan eşleştirme ve satıcının kendi ilanını önerme | Buyer requests UI/DB testleri |
| Ortaklık faaliyet geçmişi | Sunucuda değiştirilemeyen olay kayıtları; başvuru/onay/ret/sonlandırma/ödeme filtreleri ve sayfalama; eski gerçek tarihlerin birleştirilmesi | `check-mobile-activity-ui.mjs`, activity DB testi |
| Ek araçlar | Benzer ilan fiyat analizi, karşılaştırma, performans, türetilen başarımlar, ilgi alanları, toplu yenileme, güvenli alışveriş rehberi | `check-mobile-market-tools-ui.mjs` |

### Ortaklık detayının sonraki tamamlaması

- `/partnership/[id]` ürün galerisi, tam ekran fotoğraflar, fiyat/konum, komisyon ve kontenjan kartları; Genel Bilgiler, Ortaklık Koşulları, Satıcı Bilgileri ve Yorumlar sekmeleriyle güncellendi. Telefon ve tablet yerleşimi ayrıldı; 320 px görünümde sekmelerin kartlarla üst üste binmesi düzeltilip ölçüyle test edildi.
- Komisyon koşulları ortaklığın kaydedilmiş anlaşmasını/özel komisyonunu kullanır. Satıcı bilgileri sunucudan okunur. İlan yorumları hata/tekrar deneme ve 24 kayıtla sayfalanır; fotoğraf ve deneyim etiketleri ortak yorum bileşeninde korunur.
- Satıcı ayrıntı ekranından özel komisyon belirleyebilir, kaldırabilir, ortaklığı sonlandırabilir veya kapatabilir. Ortak kendi aktif ortaklığından ayrılabilir. Bu mutasyonlar sunucudan başarı gelmeden yerel durumu, ortak sayısını veya bildirimleri değiştirmez. Tekrarlı eşzamanlı kararlar kilitlenir; hesap değişiminde eski sonuç yeni hesaba yazılmaz.
- Özel komisyon formu artık başarısız kayıtta kapanmaz; virgüllü yüzdeyi ve mevcut ondalıklı tutarı korur. Geçersiz yeni komisyonlar ayrıca sunucuda `20261023162300_mobile_partner_override_validation.sql` tetikleyicisiyle reddedilir. Eski anlaşmalar topluca değiştirilmedi.
- Ortaklık Yönetimi kartına doğrudan yönetim bağlantısı eklendi. Sekmeler URL ile eşlendi; menüden aynı açık sekmeye dönünce yanlış panelde kalma ve filtrelenmiş boş ortaklık görünümü düzeltildi.
- `check-mobile-partnership-detail-ui.mjs`: galeri/tam ekran, kilitli anlaşma, satıcı, yorum hatası ve 25. yorum, `%1,25` başarısız/başarılı kayıt ve özel koşulu kaldırma, sonlandırma/ayrılma hatasında aktif durumu koruma, tekrar denemede kalıcı sonuç ve 320 px düzen. Tüm servisler yerel taklittir; canlı ortaklık sonlandırılmaz.
- `check-mobile-partner-override-db.mjs`: gerçek tabloyu değiştirmeden geçici kopyada ondalık yüzde, sabit tutar, temizleme; >90/negatif/NaN/yarım alan çiftini reddetme; iç işlevin çağrı izinleri. Önce rollback testi, ardından şema uygulaması yapıldı.
- Gerçek Android'de mevcut hesabın arsa ortaklığı yeni galeri/fiyat/komisyon görünümünde açıldı: `audit/mobile-v4/native-partnership-detail-new.png`. Görüntüleme sırasında iş verisi değiştirilmedi.

### Bu turdaki veri ve hata düzeltmeleri

- İstatistikler başka bir hesabın ilanı için dönmez. Günlük görüntüleme sorgusu sadece ilan sahibine iki sütun izni verir; ziyaretçi anahtarı okunamaz. Yeni analiz ve kazanç RPC'leri SECURITY INVOKER kullanır, anonim çalıştırma kapalıdır.
- Kazanç toplamları mobil store'un 500 kayıt penceresine bağlı değildir. Geçmiş para birimi anlık görüntüsü bulunmadığı için ayrım ilanın güncel para birimine dayanır; döviz dönüşümü yapılmaz ve bu sınır ekranda açıklanır.
- Eski `%350` komisyon verisi değiştirilmedi. Geçersiz potansiyel komisyon gösterilmez; mevcut anlaşmanın geçerli kilitli/özel koşulları kullanılır. Sonuçlanmış satış tutarları değiştirilmez.
- Şikâyet listesinde eski bir isteğin yeni filtreyi ezmesi önlendi. Hesap değişince yorum ve şikâyet formu yeniden oluşturulur; yorum verileri yüklenmeden satış seçimi kurulmaz.
- Görsel seçme/yükleme hataları cihaz URI'sini başarılı uzaktan kayıt gibi göstermiyor. Silinmiş `assets/mascot.png` başvurusu mevcut kedi varlığına taşındı.
- Expo SDK uyumlu `@react-navigation/native` bağımlılık aralığı tanımlandı. Kayıtsız formlarda geri hareketi korunur. Grafiklerde dokunma ile değer görüntüleme eklendi.
- Yeni migration dosyaları 23 Ekim analytics, earnings, price watch preferences ve partner activity şemalarıdır; her biri önce geri alınan transaction ile sınanıp sonra uygulandı. Test iş verileri kalıcılaştırılmadı. Yeni teklif ilan yabancı anahtar indeksi eklendi.

### Doğrulama ve sınırlar

- Gerçek Android `emulator-5554` / `OrtakSat_Mobile_API35` üzerinde uygulama açık; gerçek hesapla katalog, sağ menü, kazanç ve gerçek tarihli faaliyet geçmişi ekranı kontrol edildi. Üretim kullanıcılarına test mesajı/teklif/şikâyet/yorum gönderilmedi.
- Yeni UI testleri tüm Supabase HTTP/WebSocket trafiğini yerel örnek servisle taklit eder. Kanıtlar `audit/mobile-v4/`; örnek ekranlarda “YEREL TEST · ÖRNEK VERİ” etiketi vardır. Görüntüler sonlu menü/geçiş animasyonları bittikten sonra alınır.
- TypeScript, hook ve Türkçe karakter kontrolleri; Expo Doctor 18/18; Android/iOS Hermes exportları geçti. Exportlar imzalı mağaza build'i değildir. Fiziksel iPhone/iOS Simulator bu Windows ortamında sınanmadı.
- Son advisors: 104 güvenlik bulgusu (102 uyarı, 2 bilgi), 203 performans bulgusu (132 uyarı, 71 bilgi; yeni olay tablosundaki henüz kullanılmamış indeksler dahil). Önceden var olan ayrıcalıklı işlev/extension/parola koruması ve çoklu politika uyarıları ayrı inceleme bekliyor; yeni analiz RPC'leri SECURITY DEFINER eklemez.
- Kayıtlı gerçek cihaz/arama/kategori trafik kaynağı olmadığı için bunlara yüzdeler uydurulmaz. Fiyat takibi favoriye ekleme anındaki fiyatla karşılaştırmadır; tam tarihsel fiyat serisi değildir. Ortaklık faaliyetleri 23 Ekim 2026 itibarıyla sunucuda olay günlüğüne yazılır. Önceki kayıtların yalnızca mevcut başvuru, onay ve ödeme tarihleri gösterilir; eski ret/ayrılma tarihleri uydurulmaz. Olay tablosuna istemci yazma/silme yetkisi verilmez. Test, gerçek ortaklığı değiştirmeden geçici tablo kopyasında tetikleyiciyi çalıştırır.
- Davet, ayrıntılı müşteri/satış/ödeme ve bazı mağaza yönetimi işlemleri mevcut gelişmiş ekranlara bağlıdır. Ücretli üyelik/kimlik rozeti/başarım XP'si veya platform bakiyesi uydurulmadı. Genel profilin her anonim erişim yolundan engellenen kişiye görünmez olması ayrıca uçtan uca denetlenmedi; arayüz bunu vaat etmez.
- Apple/SMS sağlayıcıları, gerçek EAS proje kimliği, mağaza sertifikaları ve alan adı ilişkilendirme dosyaları aşağıdaki dış yapılandırma bölümündeki durumdadır.

## 21 Ekim ekran geliştirmeleri ve doğrulama sınırı

- Mobil ilan önizleme, İlanlarım, Favorilerim ve İlan Düzenle ayrı bileşenlerle uygulamaya bağlandı. Kategoriye özgü alanlar, fotoğraf/kapak seçimi, fiyat, konum, ortaklık ayarları, düzenleme önizlemesi ve kayıt eylemleri mevcut servisleri kullanır. Android geri tuşu kirli formdan çıkarken onay ister. Aynı adlı kategori yapraklarının farklı markalara bağlanması düzeltildi; BMW/Diğer Model için yanlış Alfa Romeo yolu artık seçilmez.
- İlan oluşturma, durum değiştirme ve kaldırma store işlemleri sunucu sonucunu bekler. Favori mutasyonunda başarısız işlem geri alınır; hesap değiştiğinde eski hesabın geri alma işlemi yeni hesaba uygulanmaz. Gerçek kaydetme tarihi ile son 7 gün filtresi ve kaydedilen fiyattan değişim yüzdesi kullanılır.
- `/account-settings` hesap ayarları merkezi eklendi. Profil, mevcut şifre/doğrulama/mağaza ayarları, e-posta bildirimi, engellenenler, yasal metinler ve destek bağlantıları çalışır. Bu ekran tüm ayrıntılı gizlilik/push/MFA ayarlarının tamamlandığı anlamına gelmez.
- `/profile-edit` varsayılan mobil görünümünde yeni Profil Düzenle formunu açar. Fotoğraf için kamera/galeri izinleri, 5 MB kontrolü, ad/telefon doğrulaması, il, hakkında, kayıt hatasında girdileri koruma ve Android geri tuşunda kirli form uyarısı vardır. Mağaza, uzmanlık ve güvenlik işlemleri `view=advanced` ile mevcut ayrıntılı ayarlara bağlıdır. Kullanıcı adı/e-posta değiştirme ve referanstaki tüm ek alanlar henüz yeni forma eklenmedi. Profilin başarısız kaydı ve başarılı tekrar denemesi izole UI testine dahil edildi.
- `/sss` mobil Yardım Merkezi mevcut kedi maskotunu, sekiz konu filtresini, aramayı ve açılır yanıtları kullanır. `/support` mevcut `support_tickets` tablosuna talep yazar; kullanıcının taleplerini, gerçek durumlarını ve açıklamalarını gösterir. Sayılar sunucudan alınır; liste 50 kayıtla sayfalanır. Hata halinde form korunur. Durum `reviewing`, yanlış biçimde “Yanıtlandı” diye gösterilmez. Destek yanıtlaşması ve görsel ekleme henüz bu ekrana eklenmedi.
- Menüye Hesap ve Yardım grubu eklendi; profil ayarları dişlisi yeni merkeze gider. Logo, maskot dosyaları ve alt menü bileşeni yeniden tasarlanmadı.
- Android `emulator-5554` üzerinde Expo Go ile uygulama açıldı; giriş, gerçek kataloglu ana sayfa ve yeni Yardım Merkezi görüntülendi. `audit/mobile-v3/native-home.png` ve `native-help.png` gerçek emülatör kayıtlarıdır. Hesaba bağlı yeni ekranlar bu emülatörde gerçek oturum olmadan doğrulanmış sayılmaz.
- `check-mobile-management-ui.mjs`: durum/kayıt/silme hatalarında kayıt koruma, favori geri alma, fiyat değişimi, kayıt tarihi filtresi, marka-kategori tutarlılığı ve 320 px düzenleyici. `check-mobile-support-ui.mjs`: ayarlar bağlantısı, destek sayıları/detayı, başarısız gönderimde formun korunması, tek başarılı yeniden gönderim, yardım araması. Bu iki test izole ve örnek veri kullanır; canlı kullanıcı hesabına mesaj veya destek talebi göndermez.
- Canlı veritabanında `support_tickets` tablosunun RLS etkinliği salt okunur sorguyla doğrulandı. Yeni destek şeması veya ayrıcalıklı erişim eklenmedi.
- Kalan kapsam: referanslardaki bütün satıcı/değerlendirme/şikâyet takibi ve ayrıntılı bildirim/gizlilik ekranları, destek yanıtları ve ekleri, ortaklık kapasitesinin eşzamanlı işlemlerde sunucuda uygulanması, fotoğraf-kayıt işlemlerinin atomikliği ve gerçek oturumla bütün ekranların Android/iOS kontrolü. Tüm uygulama eksiksiz veya mağazaya hazır olarak işaretlenmedi.

## Son tamamlanan işler

- Yeni tasarım yalnız native uygulamada ve açıkça etkinleştirilen yerel geliştirme önizlemesinde kullanılır. `lib/mobile-app.ts` üretim web arayüzünü ayırır. Önceki turdaki dar web tasarımı değişikliği kaldırıldı; mevcut web ekranları kendi bileşenlerini kullanır.
- Son referansa göre ana sayfada önce mevcut kedi maskotlu tanıtım alanı, üç kampanya noktası, ardından beş sütunda on kategori ve üç sütunlu ilan kartları bulunur. Maskot yeniden çizilmedi; mevcut WebP uygulamaya dahil edildi. Tabletlerde ilan sütunu sayısı artar. Android'deki kesirli ölçü yuvarlamasından kaynaklanan sütun kayması düzeltildi.
- Mobil açılışta oturumun yüklenmesi beklenir. Oturum varsa ana sayfa açılır; yoksa giriş/tanıtım ekranı görünür. “Geç” bu açılış için misafir gezinmesine izin verir. İlan, mesaj, ortaklık ve hesap yolları giriş ister; ilan/yorum/mesaj/ortaklık store işlemleri de misafire kapalıdır. Üretim web ana sayfasına açılış kapısı eklenmedi.
- Google ve e-posta kaydında açık yasal onay zorunludur. Google düğmesi onaydan önce de normal görünür ve tıklanabilir. Onaysız tıklamada OAuth başlamaz; kutu turkuaz çerçeveyle belirginleşir, görünür alana kaydırılır ve yanında “Devam etmek için önce bu kutuyu işaretle.” açıklaması gösterilir. Kutu işaretlenince açıklama kalkar; sonraki Google tıklaması OAuth'u başlatır. Tek bir belgeyi okumak toplu kutuyu otomatik işaretlemez. Google onayı tarayıcı dönüşü boyunca saklanır, gerçek oturum kurulduğunda kabul zamanı ile kaydedilir. Önceden açık Google oturumları yeni onay verilmiş gibi kaydedilmez. Apple ve telefon yöntemleri henüz kapalıdır.
- Eksik, baş harf içeren veya yüklenemeyen profil fotoğrafları ana sayfa, profil/düzenleme, satıcı, sohbet, yorum ve sıralama kartlarında ortak gri silüete düşer. Gerçek fotoğraflar korunur. Oturum yükleme, geçici profil okuma hatasında yedek değerleri mevcut profilin üzerine yazmaz.
- Kategori ekranına 16 görselli kart, kategori araması, tüm alt kategoriler ve tanıtım alanı eklendi. Ana sayfadaki kategori bağlantıları ağacın tüm seviyelerinde doğru kategoriyi bulur.
- İlan listesi ve filtre ekranında konum, fiyat aralığı/sürüklenebilir aralık, marka/model, yıl/km, kategori özellikleri, sahibinden/ortaklık/garanti/takas filtreleri ve sıralama çalışır. Takas ve sahibinden seçenekleri mevcut şemanın `swap` ve `from` alanlarıyla eşleştirildi. Arama mevcut sunucu arama servisini de kullanır. Filtre yeniden açıldığında seçimler korunur; modalın geri düğmesi filtreyi kapatır.
- İlan detayında fotoğraf galerisi, tam ekran fotoğraflar, satıcı kartı, özellikler, açıklama, konum bağlantısı, paylaşım, bildirme ve sabit iletişim/ortaklık eylemleri bulunur.
- İlan verme ekranı mevcut yayınlama, doğrulama, fotoğraf yükleme ve taslak işlevlerini kullanır. Kategoriye bağlı alanlar, isteğe bağlı ek özellikler, ortaklık ayarları, konum ve önizleme eklendi. Konum için foreground izin metni yapılandırıldı. Yatay tablet görünümü için yönelim `default` olarak ayarlandı.
- Ortaklık talebi ekranına teklif, mesaj, hazır mesajlar ve ek bilgiler eklendi. Komisyon teklifi başvuru notuna yazılır; tek başına geçerli komisyonu değiştirmez. Doğrudan bağlantıyla açılan, henüz katalog belleğinde bulunmayan ilanlara başvuru da desteklenir; mevcut sunucu RPC'si yetki ve ilan durumunu kontrol etmeye devam eder.
- Mesaj listesi, sohbet, fotoğraf gönderimi, hızlı mesajlar, engelleme/bildirme, başarısız mesajı tekrar gönderme ve bildirim ekranı tamamlandı. Tablet mesaj ekranında liste ve sohbet yan yana açılır. Okundu güncellemesinin tekrar render döngüsüne girmesi düzeltildi.
- Expo Go'da desteklenmeyen push kaydı/handler kurulumu atlanır. Gerçek uygulama derlemelerinde push kurulumu korunur.

## Kategori, hesap ve işlem akışlarında tamamlananlar

- Ana sayfa 5 × 2 kategori düzenine geçti; Elektronik, Ev & Yaşam, Hobi & Spor ve Tüm Kategoriler son referansa göre yerleştirildi. Tüm Kategoriler ekranı ve seçici bütün alt kategorilerde arar, tam kategori yolunu gösterir ve sonuçları kademeli açar.
- Mobil filtreler kategori şemasındaki sayı, seçenek, evet/hayır, çoklu seçim ve metin alanlarını kullanır. Diğer özellikler açılarak erişilir; ilk altı alan sınırlaması kaldırıldı. Kategori değişimi yalnız “Uygula” ile geçerli olur; “Vazgeç” önceki aramayı korur. Minimum/maksimum aralıkları, sıfır değerleri ve eski kilometre/vites alan adları desteklenir.
- `20261020194618_mobile_catalogue_filters.sql` salt okunur, SECURITY INVOKER sorgu işlevlerini ekler. Önce geri alınan transaction içinde anonim rolle test edildi; ardından Management API üzerinden uygulandı ve gerçek anonim Data API çağrısı doğrulandı. Mevcut tablo/RLS kuralları değiştirilmedi. Filtreleme ve sıralama sayfalamadan önce sunucuda yapılır; sonuç sayısı toplam eşleşmedir. İstek hatası sıfır sonuç gibi gösterilmez. Dosya idempotenttir.
- Mobil profil/ortaklık panelinde gerçek ilan, ortaklık, bekleyen talep ve favori sayıları; sekmeler; ilan menüsü; talep onay/ret ve paylaşım vardır. Eski satış/ödeme yönetimi ayrı düğmeden erişilebilir. Filtrelenmiş boş listeler ve yenileme hataları açıkça gösterilir.
- İlan verme taslak menüsü cihazdaki taslağı kaydeder, açar ve siler. Marka değişince model temizlenir; farklı kategori şemasına geçince eski özellikler temizlenir, özel başlık/açıklama korunur. Yüzde komisyonun ondalık ayracı ile fiyatın binlik ayracı ayrı işlenir. Henüz çoklu cihaz/sunucu taslak senkronizasyonu yoktur.
- Mesajlar tarih sırasına konur; alıcı/satıcı/ortak sekmeleri gerçek konuşma sayılarıyla ayrılır. Filtre dışına çıkan tablet sohbeti seçili kalmaz. Kapalı/engellenmiş sohbetten metin ve fotoğraf gönderimi engellenir. Konum ekleme kullanıcı izniyle metin taslağına bağlantı koyar; gönderme ayrıca kullanıcı eylemidir. Telefon paylaşımı da taslağa eklenir. Bildirim günleri ve saatleri cihazın yerel saatine göre gösterilir; uygulamaya dönüşte veri yenilenir.

### Bu turdaki tekrar üretilebilir testler

- `node scripts/check-mobile-filters.mjs`: 57 şemada 987 özellik; sıfır/eksik aralık, eski alan adları, açık false değeri, çoklu seçim, Türkçe arama ve geçersiz aralıklar.
- `node scripts/check-mobile-catalogue-db.mjs`: geri alınan DDL testi, anonim rol, yetkiyi yükseltmeme, sayfalama, sayı/boolean/çoklu seçim ve gerçek anonim RPC erişimi. `--apply` yalnız işlevleri kurmak istendiğinde kullanılır.
- `node scripts/check-mobile-catalogue-ui.mjs`: izole servisle 50 sonucu 24/48/50 yükleme, taslak filtre sayacı, filtreyi sunucuya iletme, kategori değişimini iptal ve ağ hatasından toparlanma.
- `node scripts/check-mobile-profile-ui.mjs`: izole servisle profil, onay/ret, filtrelenmiş boş ortaklık listesi ve ilanı yayından kaldırma.
- `node scripts/check-mobile-create-ui.mjs`: yerel taslak → yeniden yükleme → geri yükleme, marka/model temizliği ve araçtan konuta geçince şema değişimi. Canlı ilan yayınlamaz.
- Giriş testlerinin tamamı ve `python scripts/check-mobile-auth-android.py` geçti. Mesaj/başvuru testleri izole servise karşı geçti. Ekran görüntüleri ve JSON sonuçları `audit/mobile-v2/` içindedir; örnek verili görüntüler etiketlidir.
- Supabase Advisors: 105 güvenlik bulgusu (102 uyarı, 3 bilgi), 195 performans bulgusu (132 uyarı, 63 bilgi) mevcut. Yeni mobil işlevler SECURITY DEFINER kullanmaz ve sabit search_path tanımlar; bu işlevler için yeni advisor bulgusu görülmedi. Mevcut ayrıcalıklı işlevlerin erişimleri, sızmış parola koruması ve yinelenen politikalar yayın öncesi ayrıca incelenmeli; bunlar bu arayüz turunda topluca değiştirilmedi.

## Son doğrulama kanıtları

- TypeScript, hook ve Türkçe karakter kontrolleri geçti. Expo Doctor: 18/18.
- Android ve iOS Metro/Hermes exportları geçti. Bunlar imzalı AAB/IPA veya mağaza yayını değildir.
- Gerçek Android uygulaması OrtakSat'a özel `OrtakSat_Mobile_API35` emülatöründe Expo Go 54 ile açıldı. Ana sayfa, kategoriler, giriş ve ilan verme ekranları UI üzerinden gezildi; doğrulanmış görüntüler `audit/mobile-v2/android-home.png`, `android-categories.png`, `android-auth.png` ve `android-create.png` dosyalarında.
- iPhone boyutunda tarayıcı önizlemesi, 320 px dar ekran, iPad portre ve tablet yatay düzenleri kontrol edildi. `audit/mobile-v2/browser-errors.json`: `[]`.
- İzole yerel sahte servisle hesap ekranları test edildi: mesaj gönderimi ve ortaklık başvurusu arayüzden persistence API sınırına ulaştı. Hiçbir canlı kullanıcıya mesaj veya başvuru gönderilmedi. `audit/mobile-v2/account-ui-test.json` iki işlemin de geçtiğini ve hata listesinin boş olduğunu kaydeder.
- Örnek verili mesaj/sohbet/bildirim/ortaklık görüntüleri `*-sample.png` adını taşır ve üzerlerinde “ÖRNEK VERİ · YEREL ARAYÜZ TESTİ” etiketi bulunur.
- Yeni giriş testleri: `npm run test:mobile-auth`. Yalnız localhost mobil önizlemeye karşı çalışır; Supabase HTTP/WebSocket istekleri tamamen taklit edilir. İlk açılış, Geç, altı korumalı derin bağlantı, açık onay, kalıcı oturum, onayın yalnız bir kez yazılması ve kayıt → e-posta kodu → otomatik giriş → tekrar açılış kontrol edilir. Geçici profil sorgusu hatasında da oturum korunmalıdır ve yedek profil yazılmamalıdır. Sonuçlar `access-ui-test.json`, `session-consent-test.json`, `signup-ui-test.json`, `profile-fallback-test.json` dosyalarındadır. Canlı hesap veya mesaj oluşturulmaz.
- Google düğmesi düzeltmesinin testi: `npm run test:mobile-auth -- google`. İlk giriş ve e-posta formunda düğmenin aktif kalması, onaysız tıklamada kutu yanında açıklama gösterilmesi, kutu işaretlenince açıklamanın kalkması ve ancak sonraki tıklamada Google OAuth isteğinin başlaması kontrol edilir. Dış OAuth isteği taklit edilir; sonuç `google-action-test.json`, görünüm `google-consent-guidance.png` dosyasındadır.
- Android arayüz kontrolü: Geç ile gezinme, kedi görseli, on kategorili ana sayfa ve misafirin ilan vermeye yönlendirilmesi. Görüntüler: `android-auth-consent.png`, `android-home-cat.png`, `android-guest-create-blocked.png`. Android'de gerçek bir Google hesabıyla uçtan uca giriş yapılmadı; oturum/kayıt servis testleri izole tarayıcı önizlemesindedir.
- Android tekrar kontrolü: uygulama `emulator-5556` üzerinde açıkken `python scripts/check-mobile-auth-android.py`. Araç yalnız arayüz onay kutusunu, Geç'i ve misafir ilan kapısını kullanır; gerçek Google girişini başlatmaz.
- Fiziksel iPhone, iOS Simulator, TestFlight ve Google Play internal testing üzerinde doğrulama yapılmadı. `iphone-*.png` dosyaları tarayıcı boyutlandırmasıdır.

## Hâlâ dış yapılandırma veya yayın kararı gerektirenler

1. Apple ve telefon/SMS kimlik sağlayıcıları kurulu değil. Bu giriş düğmeleri devre dışı ve “Yakında” etiketli; çalışıyor gibi gösterilmiyor.
2. `app.json` içindeki EAS project ID hâlâ `replace-after-eas-init`. İmzalı build, mağaza hesapları, sertifikalar ve push için gerçek EAS projesi gerekiyor.
3. `public/.well-known/assetlinks.json` içindeki örnek Android imzası ve `public/.well-known/apple-app-site-association` içindeki örnek Apple Team ID tamamlanmalı.
4. 19 Ekim bağımlılık taraması 51 bulgu (17 orta, 33 yüksek, 1 kritik) raporladı; kritik dolaylı `shell-quote` bulgusu `GHSA-pqg4-j6r4-53mv` idi. Araç zincirinin mobil uygulamaya etkisi ayrıca değerlendirilmeli. Bu bulgular ve katalogdaki `%350` komisyon gibi eski veri sorunları ayrı inceleme bekliyor. Canlı kayıtlar değiştirilmedi.

Yerel mobil önizleme için PowerShell:

```powershell
$env:EXPO_PUBLIC_MOBILE_PREVIEW='1'
npx expo start --offline --port 8087 --max-workers 2
```

Tarayıcı önizlemesi `http://localhost:8087` adresindedir. Bu bayrak `.env` dosyasına yazılmaz ve üretim web tasarımını etkinleştirmez. Android emülatörü için `adb reverse tcp:8087 tcp:8087` ardından Expo Go'da `exp://127.0.0.1:8087` açılır.

## Ek görsel varlıklar

Yerleşik imagegen ile oluşturulup projeye kaydedildi:

- `assets/mobile/category-atlas.webp`: 4 × 4 kategori görsel seti, 1280 × 1280, yaklaşık 189 kB.
- `assets/mobile/rocket.webp`: şeffaf zeminli roket, yaklaşık 23 kB.

Kategori setinin nihai istemi: “Create a precise 4 by 4 contact sheet of 16 premium photorealistic miniature 3D marketplace category illustrations. Square image, equal sized square cells, absolutely NO gutters, NO borders, NO text, NO labels, NO typography. Every object centered completely inside its own cell with generous whitespace; each cell has a very pale softly lit pastel background. Read left to right row by row exactly: row1: elegant miniature detached two-storey modern house on pale cyan; white compact luxury car side three-quarter view on pale gray; blue smartphone and open laptop together on pale cyan; beige couch beside floor lamp and wooden coffee table on pale cream. Row2: colorful shopping cart filled with bags on pale lavender; yellow excavator with black tracks on pale yellow; cordless drill plus crossed wrench and screwdriver on pale cyan; stack of books topped with graduation cap on pale lavender. Row3: soccer ball with small dumbbells on pale mint; pink red dress with matching handbag on pale pink; office desk and black leather office chair on pale gray; golden retriever dog and tabby cat together on pale peach. Row4: potted green plants with garden shovel on pale sage; black video game controller on pale lavender; red three-dimensional heart with white electrocardiogram line on pale pink; four rounded square outline tiles arranged 2x2 on pale gray. Consistent scale, refined realistic 3D product photography, polished app illustration pack, each cell clean isolated single grouped subject. Total 16 evenly aligned cells.”

Roketin nihai istemi: “Single premium polished 3D illustration of a small white rocket with turquoise teal nose cone, teal fins and metallic round turquoise porthole launching diagonally toward upper right, soft white puffy clouds under the rocket. Isolated transparent background, no text, no logos. Glossy realistic clay render, friendly elegant marketplace promotional banner icon. Rocket angled 30 degrees to right, clear silhouette, soft studio lighting. Wide rectangular composition with rocket on center right, clouds along lower edge.”


## Ana görsel varlıkları ve istemleri

- `assets/mobile/istanbul-marketplace.webp`: 900 × 1125, yaklaşık 149 kB.
- `public/assets/mascot/webp-512/success.webp`: mevcut kedi maskotu; ana sayfa bannerında kullanılır.
- `assets/mobile/handshake.png`: önceki tasarımdan kalan, artık ana sayfada kullanılmayan varlık.

### İstanbul görseli için kullanılan nihai istem

> Create a premium photorealistic background image asset for a Turkish mobile marketplace onboarding screen. Portrait 4:5 composition. NO TEXT, NO LOGOS, NO UI, NO phone frame. Match attached user reference second image's scenic product collage: airy bright pale blue sky and soft clouds occupying upper 60 percent with extremely calm nearly white central region for text overlay. Lower background Istanbul Bosphorus, Galata tower on left and suspension bridge on right, distant buildings, sunny turquoise water. In bottom 35 percent foreground arrange grey luxury sedan on left, beige sofa center behind wooden coffee table, a large flat television showing mountains center-right, black modern scooter right, a silver smartphone and elegant dark handbag near right bottom. Photorealistic professional advertising collage, natural perspective, premium warm sunlight, bright pale turquoise palette, crisp detailed objects, seamless composition. Save output as local project asset.

### El sıkışma görseli için kullanılan nihai istem

> A single premium 3D rendered handshake for Turkish marketplace app hero banner, isolated on transparent background. Two friendly realistic simplified hands shaking, left arm wears rich turquoise teal suit cuff with white shirt, right arm wears violet purple suit cuff with white shirt. Hands enter from left and right upper sides. Soft glossy clay render with rounded shapes and realistic skin shading, slightly diagonal handshake, front view, elegant advertising 3D icon. Three short thin mint accent rays above hands. No text, no logo, no other objects. Wide landscape composition.


## İlan başlığı kalitesi — 23 Ekim 2026

- Web ve mobil oluşturma/düzenleme aynı `ListingTitleField` alanını, `lib/listing-title.ts` politikasını ve 10–70 karakter sınırını kullanır. Türkçe/uluslararası harfler ve model/ölçü için anlamlı noktalama korunur. Emoji, ok, yıldız, HTML, kontrol/görünmez karakter ve art arda süsleme engellenir. Uzun yapıştırmalar sessizce kesilmez; sayaç ve alan uyarısı gösterilir.
- Ortak `validateListing`, toplu yükleme, uygulama deposu, canlı kayıt servisi ve yenileme kontrolü aynı başlık doğrulamasına bağlıdır. `20261023164431_listing_title_policy.sql` sunucu tetikleyicisi uygulanıp doğrulandı; istemci atlanarak yeni/geçersiz başlık yazılması da engellenir.
- Mevcut ilanların asıl başlıkları ve tarihsel olay kayıtları değiştirilmedi. Kart/detay/geçmişte süslemeler yalnız görünümde temizlenir; düzenleme alanı asıl metni ve düzeltme uyarısını gösterir.
- 28 istemci + 28 sunucu örneği, 70/71 sınırı, Unicode normalizasyonu, geçersiz güncelleme, özel tetikleyici izinleri ve veri yazmadan rollback testi geçti. Mobil form 320/390/1440 px, oluşturma taslağı ve düzenleme önizlemesinde geçersiz başlığın engellenmesi doğrulandı. TypeScript, hook lint, Türkçe kodlama ve Android Hermes dışa aktarımı geçti.
- Android emülatöründe gerçek faaliyet başlıkları süslemesiz göründü; geçici `BMW *** 320i` girdisi için alan uyarısı doğrulandı. Görseller: `audit/mobile-v4/native-title-activity-clean.png`, `native-title-warning.png`, `title-valid-390.png`, `title-legacy-activity-390.png`.

- Mobil önizleme bayrağı kapalı, ayrı 8088 geliştirme sunucusunda gerçek masaüstü oluşturma formu da test edildi: Vasıta → Otomobil → BMW → Diğer Model, süsleme/71 karakter uyarısı ve geçerli başlık kabulü geçti. `scripts/check-listing-titles-web-ui.mjs`; görsel `audit/mobile-v4/title-desktop-warning-1440.png`.


## 24 October 2026 ? compact footer and listing creation

- Shared compact footer: six legal/help links, turquoise top border, no large logo/social columns; 148 px at phone widths. Added to scroll content across native tabs and narrow web tabs. Chat timelines keep their composer and messages clear.
- Five stable navigation destinations, correct selected state for profile/messages/categories, unread marker on Menu, hidden while the native keyboard is open. Create and preview now retain bottom navigation.
- Listing photos remain images only, maximum five including cover. Gallery uses remaining capacity; duplicate URIs are removed, picker is locked while active, permission/errors are reported.
- Larger photo tiles open a full-screen gallery with cover selection/removal and 44 px controls. Preview checks title, description, price, required category fields, location and commission before proceeding, then scrolls to the relevant section.
- Drafts preserve photos/title even before category selection; a pending draft cannot be overwritten by autosave until restored/dismissed.
- Android emulator smoke check: photo picker, selection, lightbox, cover status, remove control and all five bottom navigation items. No listing published.
- Verification artifacts: audit/mobile-v4/footer-create-results.json; audit/mobile-v4/photo-lightbox-native.png; audit/web-review/compact-footer-results.json.
- New changes are local and have not been deployed to production.
