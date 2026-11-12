# Web üretim yayını — 28 Ekim 2026

- Canlı adres: https://www.ortaksat.com
- Vercel ekibi/projesi: fatih5 / ortaksat.
- Üretim dağıtımı: `dpl_BBk7w15aGsL9DAFFeQL1sYe8ARGp`.
- Dağıtım adresi: https://ortaksat-puw64ixdc-fatih5.vercel.app
- Önceki üretim dağıtımı: `dpl_5pvjPQacnENNnbUWLc991TQzts2X`.
- Kaynak: mevcut çalışma ağacı, HEAD `9e519965c` üzerinde commitlenmemiş birikmiş web değişiklikleri. Yeni commit oluşturulmadı.

Kullanıcının yayın talebiyle mevcut web sürümü üretim olarak derlendi; önce alan adı değiştirilmeden kontrol edildi, ardından aynı hazır dağıtım promote edildi. Vercel bağlantısı projeyi bulamadığından mevcut yerel yetkilendirmeyle aynı takım ve proje CLI/API üzerinden doğrulandı. Yeni proje oluşturulmadı.

## Yayına eklenen yönlendirme düzeltmeleri

`vercel.json` içinde `/partnership-request/:id`, `/partnership/:id`, `/listing-stats/:id` ve `/sayfa/:slug` yolları ilgili statik Expo çıktısına bağlandı. Böylece bu sayfalara doğrudan giriş ve yenileme için sunucu yolu mevcut.

Arama klavye/geçmiş iyileştirmeleri dahil mevcut birikmiş web değişiklikleri bu sürümde yayınlandı. Veritabanı migration, DNS veya kimlik doğrulama politikası değişikliği yapılmadı.

## Doğrulama

- TypeScript, genel ESLint ve Türkçe karakter kontrolü temiz.
- Vercel üretim derlemesi READY.
- Staged sürüm: ana sayfa, arama, gerçek ilan detayı, Emlak kategorisi ve yukarıdaki dört dinamik yol HTTP 200 döndü.
- Canlı sitede ana sayfa, Hakkımızda, SSS/Yardım, İletişim, Gizlilik, Kullanım Şartları ve KVKK HTTP 200 ve uygulama açılışı doğrulandı.
- Canlı arama: yön tuşu, aktif öneri, Escape, Enter ile sonuç sayfasına geçiş geçti.
- 1440/390 px görseller alındı; 390 px arama sayfasında yatay taşma yok.
- Canlı dört yeni dinamik yol HTTP 200 döndü.
- Tarayıcı pageerror listesi boş. Canlı tarayıcı kontrolünde yazma istekleri engellendi; gerçek hesap/ilan/mesaj/satış işlemi yapılmadı.

Kanıtlar `audit/web-review/deploy-*` altında yereldir. HTTP 200 kontrolleri kimlik doğrulaması gereken özel kayıtların içeriğinin doğru olduğunu tek başına kanıtlamaz; bu akışların örnek verilerle yapılan yerel kontrolleri önceki inceleme belgelerindedir.
