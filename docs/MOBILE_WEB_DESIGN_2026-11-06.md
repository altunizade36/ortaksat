# Mobil tarayıcı tasarımı — 6 Kasım 2026

Bu çalışma web tarayıcısındaki giriş, menü ve ana sayfa akışını sadeleştirir. Native uygulamanın e-posta seçimi korunur; aynı mevcut kimlik doğrulama servisleri kullanılır. Yeni doğrulama veya ödeme hizmeti eklenmez.

## Değişiklikler

- Web girişinde e-posta ve şifre alanları doğrudan görünür. Kayıt sekmesinde ad, soyad, e-posta, şifre, şifre tekrarı ve mevcut yasal onay bulunur. Desteklenmeyen Apple/telefon seçenekleri bu doğrudan formda gösterilmez.
- “Şifremi unuttum”, doğrudan `auth?mode=reset` adresi ve girişe dönüş çalışır. E-posta korunur; mevcut kodla sıfırlama servisi değiştirilmez.
- E-posta/şifre/ad alanlarının tarayıcı otomatik doldurma tanımları düzeltildi. Şifre göster/gizle ve kayıt şifre gücü kontrolü korunur.
- Mobil tarayıcı üstünde Keşfet, Ortak Satış, Kategoriler ve Menü bağlantıları görünür. Ziyaretçiye görünür Giriş bağlantısı verilir.
- Menü sayfası ve açılır menü aynı gezinme içeriğini kullanır. Ziyaretçi giriş/kayıt seçeneklerini; üye hesap işlemlerini görür. Yardım ve ek hesap işlemleri açılır bölümlerdedir. Kategori ağacı ayrı Kategoriler sayfasında kalır.
- Ana sayfa ürün listeleme ve alıcı yönlendirerek komisyon kazanma yollarını açıklar. Üç adımlı rehber gerektiğinde açılır; komisyonun satışa ve anlaşmaya bağlı olduğu belirtilir. Dekoratif ürün kümesi kaldırıldı.

## Dosyalar

`app/auth.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/menu.tsx`, `components/mobile-auth-landing.tsx`, `components/web-account-menu.tsx`, `components/mobile-nav-menu.tsx`, `components/app-header.tsx`, `components/header-actions.tsx`.

## Yerel doğrulama

- TypeScript, lint, Türkçe karakter kontrolü geçti.
- Chromium ve WebKit: 320/390/430/768/1440 pikselde doğrudan giriş, kayıt, şifre sıfırlama, e-postanın korunması, şifre görünürlüğü, otomatik doldurma, menü aç/kapat ve bağlantılar geçti. Anonim ve oturumlu menü ayrı kontrol edildi.
- 10 ekran ölçüsünde giriş formu genişlik sınırı, yatay/dikey düzen geçişleri ve 44 piksel işlem hedefleri geçti.
- Kayıt kurtarma testi: çift tıklamada tek istek, eksik kodun engellenmesi, yeniden gönderme hatası/tekrar deneme, bekleme süresi ve başarılı doğrulamadan ilan formuna dönüş geçti.
- Kullanıcı/ilan oluşturulmadı. HTTP ve WebSocket istekleri yerel testlerde taklit edildi. Gerçek e-posta teslimatı veya gerçek kullanıcıyla uçtan uca giriş testi yapıldığı iddia edilmez.

Testler: `scripts/check-mobile-web-navigation-auth.mjs`, `scripts/check-responsive-auth-ui.mjs`, `scripts/check-web-signup-recovery-ui.mjs`. Görsel kanıtlar: `audit/mobile-web-design/`.

## Yayın kapsamı

Önizleme: `https://ortaksat-rlem1u6vb-fatih5.vercel.app`, deployment `dpl_9XqGYbxvPc4bEDgWLQ9FgmTehQJV`.

Kullanıcının “deploy et diğer gelişmeleriylede eksik olmasın” onayı üzerine 6 Kasım 2026'da ayrı production derlemesi hazırlandı: `dpl_13aXxwFzhCf9SVtidYHtnKhbu6Xt`, `https://ortaksat-fk5oqpafb-fatih5.vercel.app`. Production ortamındaki bu paket Chromium ve WebKit'te 45'er kontrolden geçti; yeniden derlenmeden `https://www.ortaksat.com` alan adına terfi ettirildi. Önceki yayın `dpl_9z38RF3ZJqMXk2VzG8i2ao4kgKkp` geri dönüş referansı olarak korunur. Migration uygulanmadı; Güven Sistemi kapalıdır. APK/IPA üretilmedi.

Yayın kayıtları ve alan adı sonrası testler: `audit/mobile-web-design-release/`.

Canlı alan adında Chromium ve WebKit ayrı ayrı 12 kontrolü tamamladı: 390/1440 pikselde ana sayfa, ortak satış, menü, giriş, kayıt ve şifre sıfırlama. Sayfa istisnası ve yatay taşma görülmedi; Güven Sistemi kapalı kaldı. Test sırasında backend mutasyonları engellendi.

Barındırılan önizlemede Chromium, 5 genişlikte 9 rota olmak üzere 45 kontrolden geçti: ana sayfa, keşfet, emlak kategorisi, ortak satış, hakkımızda, menü, giriş, kayıt ve şifre sıfırlama. Gerçek backend yalnızca herkese açık okuma istekleriyle kullanıldı; mutasyonlar engellendi. Güven Sistemi kapalı kaldı.

WebKit de gerçek backend yalnızca herkese açık okuma istekleriyle kullanılarak aynı 45 kontrolden geçti; sayfa istisnası ve yatay taşma yok. Sonuç: `audit/mobile-web-design/design-webkit-checks.json`; `dataSource: public-read-only-backend`.

İlk WebKit denemelerindeki erişim/zaman aşımı hataları test düzeninde çözüldü: paylaşım bağlantısı da ana sayfayı yüklediğinden ilk test yönlendirmesinden önce başlangıç isteklerinin tamamlanması beklendi. Salt okuma yapan `partner_directory` RPC’si kontrolün okuma listesine eklendi; ürüne ait olmayan Vercel inceleme araç çubuğu testte dışarıda tutuldu. Ürün erişim kuralları veya veritabanı bu nedenle değiştirilmedi. Önceki başarısız günlükler inceleme için korunur; sentetik yayın denemesi nihai başarılı kanıt olarak kullanılmaz.
