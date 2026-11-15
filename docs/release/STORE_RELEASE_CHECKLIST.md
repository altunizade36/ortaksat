# OrtakSat — Mağaza Yayın Kontrol Listesi

Son güncelleme: 16 Kasım 2026. Bu liste yayına kadar kalan adımları sırasıyla verir.
Mağaza metinleri `docs/release/store-listing.md` dosyasında, görseller `store/` klasöründedir.

## 1. Durum özeti

| Konu | Durum |
|---|---|
| Android yayın derlemesi (yerel, küçültme açık) | Çıkıyor; emülatörde gezildi, çökme yok |
| iOS derlemesi | Hiç alınmadı (Apple Developer hesabı gerekiyor) |
| Proje sağlık denetimi (expo-doctor) | 20/20 |
| Expo projesi | Kayıtlı: `@fatih3434/ortaksat-mobile` (kimlik `app.json` içinde) |
| Paket adı / sürüm | `com.ortaksat.app` · 1.0.0 · hedef Android sürümü 36 |
| Hesap silme (uygulama içi + web) | Çalışıyor; sunucu işlevleri ve gece görevi canlıda |
| Şikâyet / engelleme | İlan, sohbet, mağaza, ortak vitrini ve yorumlarda var |
| Apple ile giriş | iOS'ta Google ile birlikte gösteriliyor |
| Ödeme / uygulama içi satın alma | Yok (platform para almıyor) |
| Reklam / izleme yazılımı | Uygulamada yok |
| Anlık bildirim | Kod hazır; Android ve iOS anahtarları eksik (adım 3 ve 5) |
| Uygulama bağlantıları (linkin uygulamada açılması) | Alan adı dosyalarında iki değer eksik (adım 6) |

## 2. Hesaplar (senin açman gerekiyor)

1. **Google Play Console** — tek seferlik 25 ABD doları. Uygulama oluştur: ad `OrtakSat`, paket `com.ortaksat.app`.
2. **Apple Developer Programı** — yıllık 99 ABD doları. App Store Connect'te uygulama oluştur: paket kimliği `com.ortaksat.app`.

## 3. Android anlık bildirim anahtarı

1. Firebase konsolunda proje aç, Android uygulaması ekle (`com.ortaksat.app`), `google-services.json` dosyasını indir.
2. Dosyayı proje köküne koy ve bana haber ver: `app.json` içine bağlarım.
3. Firebase → Proje ayarları → Hizmet hesapları → yeni özel anahtar üret; anahtarı `npx eas-cli credentials` ile Expo'ya yükle.

Bu yapılmadan uygulama çalışır, yalnız Android'de anlık bildirim gelmez.

## 4. İlk bulut derlemesi

İmza anahtarını Expo üretip saklar; bu yüzden ilk derleme soru sorar ve senin başlatman gerekir.

```
npx eas-cli build --platform android --profile production
```

"Yeni anahtar üretilsin mi?" sorusuna **Evet** de. Çıkan `.aab` dosyası Play Console'a yüklenir:

```
npx eas-cli submit --platform android --profile production
```

iOS için (Apple hesabı açıldıktan sonra):

```
npx eas-cli build --platform ios --profile production
npx eas-cli submit --platform ios --profile production
```

## 5. iOS'a özgü kalanlar (Apple hesabından sonra)

- Anlık bildirim anahtarı: ilk iOS derlemesinde Expo sorar, **Evet** de.
- **Hesap silmede Apple belirtecinin iptali:** Apple, "Apple ile giriş" kullanan hesap silindiğinde girişin Apple tarafında da iptal edilmesini istiyor. Bunun için Apple hesabından bir anahtar (.p8) gerekiyor; hesap açılınca eklerim.
- "E-postamı gizle" seçen kullanıcılara e-posta gidebilmesi için gönderen alan adını Apple hesabına kaydet.
- iPad ekran görüntüleri (13 inç) zorunlu, çünkü uygulama tablet destekliyor. Henüz üretilmedi.

## 6. Uygulama bağlantıları

Paylaşılan ilan linkinin uygulamada açılması için iki değer gerekiyor; bana ilettiğinde dosyaları güncellerim:

- **Android:** Play Console → Uygulama bütünlüğü → Uygulama imzalama → SHA-256 parmak izi → `public/.well-known/assetlinks.json`
- **iOS:** Apple Developer → Üyelik → Ekip Kimliği → `public/.well-known/apple-app-site-association`

## 7. Mağaza girişleri

| Alan | Kaynak |
|---|---|
| Ad, kısa/uzun açıklama, anahtar kelimeler | `docs/release/store-listing.md` |
| Play simgesi (512) | `store/graphics/play-simge-512.png` |
| Play öne çıkan görseli (1024×500) | `store/graphics/play-one-cikan-gorsel-1024x500.png` |
| Telefon ekran görüntüleri | `store/screenshots/play-telefon/`, `store/screenshots/ios-6.7/` |
| Gizlilik politikası | https://www.ortaksat.com/gizlilik-politikasi |
| Kullanım şartları | https://www.ortaksat.com/kullanim-sartlari |
| Destek | https://www.ortaksat.com/iletisim |
| Hesap silme adresi | https://www.ortaksat.com/hesap-silme |
| Kategori | Alışveriş |

Veri güvenliği / gizlilik beyanı için `store-listing.md` bölüm 9'daki tabloyu kullan. Beyan edilecekler: e-posta ve ad, isteğe bağlı telefon, ilan içeriği ve fotoğraflar, yaklaşık konum (yalnız kullanıcı isterse), anlık bildirim belirteci. Üçüncü tarafa satış ve reklam amaçlı izleme yok.

## 8. İnceleme ekibi için

- **Test hesabı:** incelemeciler giriş gerektiren ekranları görmek ister. Gönderimden hemen önce bir inceleme hesabı açıp bilgilerini inceleme notuna yazmak gerekir; istediğinde hazırlarım.
- **İnceleme notu (öneri):** "OrtakSat bir ilan ve ortak satış aracı platformudur. Uygulama içinde ödeme alınmaz; ödeme ve teslimat taraflar arasında gerçekleşir. Hesap silme: Menü → Hesap Ayarları → Hesabımı Sil."
- **Türkiye dışı erişim:** site Türkiye dışına kapalıdır, ancak uygulama bundan etkilenmez; yasal sayfalar ve destek her ülkeden açılır.

## 9. Yayından hemen önce kaldırılacak deneme ayarları

Giriş servisinde yalnız deneme için açık bırakılmış iki ayar var (Expo Go ile iPhone'da deneme yapabilmen için). Gerçek derleme telefonda çalıştığında kaldırılacak:

- Apple giriş kimlik listesindeki `host.exp.Exponent`
- Yönlendirme izin listesindeki `exp://…` adresleri

## 10. Cihazda denenmesi gerekenler

Emülatörde gezildi ama gerçek cihazda henüz denenmedi: iPhone'da tüm akış, Apple ile giriş, anlık bildirim, kamera ile fotoğraf çekme, paylaşılan linkle soğuk açılış, yatay ekran.
