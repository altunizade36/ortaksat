# Kategori ve konum seçimleri — 29 Ekim 2026

29 Ekim 2026'da `dpl_5T32Q9BfU4oiVYRnAXEoRu4BBoTK` ile canlıya yayınlandı. Yayın ve canlı kontrol ayrıntıları: `RESPONSIVE_AUTH_REVIEW.md`.

## Kategori

Taslaklar kategori yolunu küçük kimlik kayıtları olarak saklar. Geri yükleme bu kayıtları doğrudan CategoryNode gibi kullanıyordu; children alanı bulunmadığı için ara kategori yaprak kabul ediliyor ve masaüstündeki alt seçim kutuları eksik açılıyordu. Mobil kategori penceresi de üst dalları kaybedebiliyordu.

`resolveCategoryPath` her seviyeyi güncel ağacın o seviyesinde key/slug ile çözer. Güncel düğümlerin children ve formKey bilgileri kullanılır; önbellekteki yapıya güvenilmez. Geçersiz son ek varsa son geçerli üst seviye korunur. Ortak ilan formunda taslak geri yükleme ve mobil kategori penceresi bunu kullanır.

## İl / ilçe / mahalle

- Geçersiz il kimliğinde ilçe seçicisi kapalı kalır.
- Kayıtlı ilçe seçili ile ait değilse mahalle alanı kapalı ve boş gösterilir; yanlış ilçeye mahalle isteği gönderilmez. Görünür bir düzeltme uyarısı vardır.
- Aynı il tekrar seçildiğinde geçerli alt seçimler korunur. Aynı ilde geçersiz ilçe bulunan kayıt yeniden seçilince temiz bir il seçimine dönülür.
- Mahalle alanı geçerli il–ilçe kimliğiyle anahtarlanır; eski yanıt yeni ilçenin durumuna uygulanmaz.
- Temizleme düğmesinin tıklaması üstteki açılır liste düğmesine yayılmaz.
- Mevcut liste hatası/elle giriş/yeniden deneme ve görünür konum tercihleri korunmuştur.

## Kontroller

- `check-category-path.mjs`: 7.467 kategori yolu; güncel children/form bilgisi, dal geri yükleme, eski son ek, slug, bozuk giriş ve farklı köke atlamanın reddi geçti.
- `check-listing-location.mjs`: 81 il, 973 ilçe ilişkisi, Türkçe arama, bozuk kimlik ve mahalle metni/konum görünürlüğü geçti.
- `check-selection-cascade-ui.mjs`: web 1440 px ve mobil geliştirme önizlemesi 390 px geçti. Taslakta tüm kategori seviyeleri, geçersiz ilçe için mahalle isteğinin engellenmesi, elle giriş/yeniden yükleme, aynı ilin korunması, il değişiminde temizleme ve gecikmiş eski mahalle yanıtının yalıtılması doğrulandı. Web kategorisi Vasıta'dan Emlak yaprağına değiştirilince başlık korundu.
- Önceki web taslak depolama hata/yeniden deneme testi ve mobil oluşturma adımları/fotoğraf/taslak testi geçti.
- TypeScript, hedefli ESLint ve diff kontrolleri temiz.
- Web export `dist-check-mobile/selection-cascade-web`, Android export `dist-check-mobile/selection-cascade-android` başarılı.
- Görsel kanıtlar: `audit/web-review/selection-cascade-web.png` ve `selection-cascade-mobile.png`.

## Canlı veriyle salt okunur doğrulama

Aktif kayıt sayıları: 81 il, 973 ilçe, 74.356 mahalle/köy. Paket içindeki 973 ilçe kimliği/il kimliği/slug bilgisi canlı katalogla karşılaştırıldı; uyuşmazlık sayısı 0. Kanıt: `audit/web-review/selection-live-location-consistency.json`.

Arayüz senaryoları taklit API yanıtlarıyla çalıştırıldı. Canlı katalogda yalnızca okuma yapıldı; kayıt, fotoğraf yükleme veya ilan yayınlama yapılmadı. Veritabanı/API/RLS değişmedi. Mobil kontroller tarayıcıdaki mobil geliştirme önizlemesi ve Android paket çıktısı içindir; bu turda yerel Android emülatöründe elle form doldurulmadı. Tüm ekranların tamamlandığı iddia edilmez.
