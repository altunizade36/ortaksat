# Ortak giriş tasarımı — 29 Ekim 2026

Mobil uygulama ve üretim web aynı MobileAuthLanding bileşenini kullanır. İstanbul görseli, OrtakSat markası, giriş/kayıt sekmeleri ve sağlayıcı seçenekleri korunur; genişlikler ekran boyutuna göre sınırlanır.

- 960 px ve üzeri: en fazla 1440 px ortalanmış iki sütun; sahne yüzde 52, sağ panelde en fazla 440 px içerik.
- Dar ekran / tablet: tek sütun, kaydırılabilir içerik. E-posta formunda sahne 236 px'e küçülür.
- E-posta, kayıt ve şifre sıfırlama aynı çerçevede açılır. Ekran ölçüsü değişince form yeniden kurulmaz; yazılan bilgiler korunur.
- En az 44 px etkileşim hedefleri, 16 px giriş yazısı, şifre gösterme/gizleme, belirgin durum ve hata mesajları.
- Statik HTML ve ilk istemci render'ı aynı ölçülerle başlar. Doğrudan kayıt URL'si hydration hatası vermeden uygulanır.
- Eski ayrı masaüstü giriş tasarımı ve yinelenen form kaldırıldı. Google için mevcut onay ve kimlik doğrulama davranışı korunur. Apple/telefon seçenekleri henüz kullanılamadığı açıkça belirtilen pasif düğmelerdir.

## Yerel doğrulama

- Chromium ve WebKit: 320/390/640/768/959/960/1024/1440/1920/2560 px dahil 10 farklı viewport; düzen, taşma, form genişliği, giriş boyutları, şifre görünürlüğü, ölçü değişiminde veri korunması, sıfırlama, kayıt, doğrudan URL ve misafir geçişi geçti.
- Mobil geliştirme arayüzü: 320/390/768/1024 px kayıt ve e-posta doğrulamaya geçiş geçti.
- Kayıt hata/tekrar deneme, taslak depolama hatası, kategori/il–ilçe–mahalle ve kayıtlı arama regresyon testleri geçti.
- Genel ESLint, TypeScript, Türkçe karakter kontrolü ve web/Android export başarılı.

Arayüz testlerinde API yanıtları taklit edildi; gerçek hesap oluşturulmadı veya ilan yayınlanmadı. WebKit kontrolü gerçek iPhone/Safari cihaz testi değildir. Native mobil kontrolü bu turda geliştirme önizlemesi ve Android export içindir.

## Üretim yayını

29 Ekim 2026'da `dpl_5T32Q9BfU4oiVYRnAXEoRu4BBoTK` üretim dağıtımı yayınlandı. Dağıtım adresi: https://ortaksat-5yqlqigj0-fatih5.vercel.app . Canlı adres: https://www.ortaksat.com/auth . Önceki üretim dağıtımı `dpl_BBk7w15aGsL9DAFFeQL1sYe8ARGp`.

Önce üretim sürümü alan adı değiştirilmeden hazırlandı. Giriş, ana sayfa, arama, ilan, kategori ve dört dinamik yol dahil 9 HTTP kontrolü geçti; yeni girişin HTML çıktısı doğrulandı. Ardından aynı READY dağıtımı promote edildi ve proje üretim kimliği API'den doğrulandı.

Canlı Chromium ve WebKit kontrollerinde 1440/390/320/768 px, panel genişliği, taşma, e-posta formu, şifre sıfırlama ve kayıt formuna geçiş geçti. Gerçek hesap açılmadı; canlı kontrolde yazma istekleri engellendi. Ana sayfa, Hakkımızda, Yardım, İletişim ve yasal sayfalar ile arama klavye/gezinme kontrolü de geçti. Pageerror listeleri boş.

Önceki kayıtlı arama, kayıt/ilan dayanıklılığı ve kategori/konum düzeltmeleri bu sürüme dahildir. Yeni veritabanı migration, DNS veya sunucu kimlik doğrulama ayarı değişikliği yapılmadı. Kaynak mevcut çalışma ağacıdır; yeni commit oluşturulmadı.

Kanıtlar: `audit/web-review/responsive-auth-live-checks.json`, `responsive-auth-live-regression.log` ve `auth-live-*-768.png` (canlı, salt okunur tarayıcı kontrolleri).
