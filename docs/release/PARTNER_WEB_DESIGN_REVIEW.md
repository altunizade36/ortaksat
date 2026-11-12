# Web marka ve ortaklık sayfası · 30 Ekim 2026

31 Ekim 2026 tarihinde canlıya yayınlandı: https://www.ortaksat.com/partner — `dpl_7UxnrWCKY6VwtNyhDVbfGXtevmC2`.

## Marka

Genel web üst barının masaüstü ve dar ekran sürümlerinde, açılır menüde ve geniş web footerında mevcut halka/tokalaşma işareti ile lacivert `rtak` ve turkuaz `Sat` birleşimi kullanılır. Gönderilen görseldeki gibi halka `O` harfini oluşturur. Erişilebilir marka adı OrtakSat olarak korunur. Eski küçük harfli logo ve üst bardaki ek slogan kaldırıldı. Giriş ekranının mevcut aynı markası korunur.

## Ortaklık ekranı

1000 piksel ve üzerindeki web görünümüne ayrı sunum bileşeni eklendi: tek ana başlık, sağda yardım bağlantısı, yatay sekmeler, geniş arama alanı, sarılan metin kategorileri ve üç sütunlu ilan kartları. İçerik en fazla 1360 piksel genişliğinde ortalanır. Masaüstü kartlarının yazı ve boşlukları ayrıca büyütüldü.

Dar web ekranında yinelenen içerik logosu, ikinci ana başlık ve tanıtım bannerı kaldırıldı. Tek başlık, iki sütunlu ilanlar ve dokunmaya uygun kontroller korunur. Native mobil uygulamanın mevcut sunumu ve bütün ortaklık istekleri aynı veri/işlem kodunu kullanmaya devam eder. Arama, sıralama, kategori, başvuru ve hesap sekmelerinin iş kuralları değiştirilmedi.

## Doğrulama

- `scripts/check-partner-web-design.mjs`: 1440/1024/390/320 genişlikler, Chromium ve WebKit geçti.
- Chromium giriş yapılmış hesap varyantı aynı ölçülerde geçti.
- Tek ana başlık, tekrarların yokluğu, kategori/sıralama/arama parametreleri, hesap sekmeleri, üç/iki sütun ve yatay taşmama doğrulandı. Mock API ile çalışıldı; gerçek başvuru veya ilan yazılmadı.
- Ekran görüntüleri `audit/web-review/partner-design-*.png`; masaüstü ve 320 piksel görsel olarak incelendi.
- WebKit'te servis worker istekleri test mocklarından önce yakalayabildiği için ortak test fixture'ında service worker kapatıldı. Üretim service worker'ı değiştirilmedi.
- TypeScript, tam ESLint ve Türkçe karakter kontrolü geçti.
- Web: `dist-check-mobile/partner-web`; Android: `dist-check-mobile/partner-brand-android` dışa aktarımları geçti. Native cihaz üstünde bu tasarım çalışması ayrıca çalıştırılmadı.
