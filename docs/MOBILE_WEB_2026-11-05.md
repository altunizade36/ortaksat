# Mobil web düzenlemeleri — 5 Kasım 2026

Bu çalışma native uygulamayı webde taklit etmek yerine mevcut web navigasyonunu korur. Yeni backend/migration uygulanmaz; Güven Sistemi kapalı kalır.

## Değişiklikler

- Keşfet filtreleri ve kategori seçimleri tek satırlık yatay şeritlere alındı. Seçili filtrenin görünür alana kaydırılması ve kategori aç/kapat kontrolü korundu. İlk ilanlar yukarı taşındı.
- Keşfet kartlarında favori, karşılaştırma ve tam ekran düğmeleri birbirine değmeyen 44 piksel hedeflerle yerleştirildi. Kart metin bölümü komisyon etiketini kesmeyecek şekilde genişletildi. 360 piksel altı ekranlarda okunur tek sütun uygulanır.
- Kategori sayfalarının uzun açıklaması mobilde iki satır ve aç/kapat kontrolüyle sunulur. Tam metin korunur. Alt kategori, ilgili kategori ve ana kategori bağlantıları yatay şeritlerde kalır; yüzlerce piksel boyunca sıralanmaz.
- Masaüstü düzeni 768 yerine 1024 pikselden başlar. Dikey tabletlerde masaüstü başlığı ve yan panel taşması önlenir.
- Favoriler'in dar web görünümüne tek kısa footer eklendi. Footer ekran genişliği yerine bulunduğu kapsayıcının genişliğini kullanır.
- İlan detayındaki dört aksiyon mobilde ikon ve metin alt alta gösterilir; “Karşılaştır” metninin kesilmesi önlenir.
- Sayfa zemini ve kenarlıklar nötrleştirildi; turkuaz marka vurgusu korundu. Ana sayfa tanıtım metni kısaltıldı. Az ilan varken aynı tek ürünü tekrar eden kazanç şeridi gösterilmez. İlan ver/ortak ol erişimi hero ve menüde korunur.

## Dosyalar

`lib/layout.ts`, `components/colors.ts`, `components/compact-footer.tsx`, `app/+html.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/explore.tsx`, `app/favorites.tsx`, `app/kategori/[slug]/index.tsx`, `app/listing/[id].tsx`, `scripts/check-mobile-web-layout.mjs`.

## Doğrulama

`scripts/check-mobile-web-layout.mjs` mevcut Expo statik çıktısını Vercel'in önce dosya, sonra dinamik fallback sırasıyla yerelde servis eder. Tüm Supabase trafiği taklit edilir; gerçek kullanıcılara yazılmaz. Chromium ve WebKit ile 320/390/430/768/1024/1440 genişliklerinde ana sayfa, Keşfet, ortaklıklar, Favoriler, Hakkımızda, kategori ve ilan detayı kontrol edilir. Buna boş kategori/ortaklık, kategori açıklaması ve seçici aç/kapat, kart aksiyonlarının birbirine değmemesi ve karşılaştırmaya basınca ilanın açılmaması kontrolleri eklenir.

Çıktılar `audit/mobile-web-nov5/` altında tutulur; deployment paketine girmez. Bu rapor bütün geçmiş taleplerin ve tüm platformlardaki her akışın tamamlandığı anlamına gelmez. iOS fiziksel cihaz testi yapılmadı; WebKit tarayıcı testi cihaz testi yerine geçmez.

Yerel sonuç: Chromium ve WebKit ayrı ayrı **42 sayfa/ölçü kombinasyonunda geçti**, sayfa istisnası ve yatay taşma yok. Mobil Keşfet'te ilk kartın üst kenarı 345–350 pikselde. Kategori bağlantıları boş sonuçta da uzamıyor; aç/kapat ve kart aksiyonları geçti. TypeScript, lint, Türkçe karakter kontrolü ve web export başarılı.

## Yayın adayı

Production ortam değişkenleriyle, alan adı atanmadan oluşturulan aday: `https://ortaksat-1ugxtctuo-fatih5.vercel.app`, deployment `dpl_9z38RF3ZJqMXk2VzG8i2ao4kgKkp`. Bu bir preview'i production'a yeniden derleme yoluyla aktarma işlemi değildir; test edilecek production çıktısı doğrudan hazırlanır. Canlı alan adı geçişi ayrıca yapılır. Güncel doğrulama makbuzları `deploy-receipt.json` ve `deployed-*-checks.json` altında yer alır.

Yayın sonrası aday kontrolleri: Chromium ve WebKit ayrı ayrı 25 gerçek sayfa/ölçü kombinasyonunda geçti. Sayfalar HTTP 200 döndü; yatay taşma veya React sayfa istisnası görülmedi. Supabase'e yazma istekleri testte engellendi. Güven Sistemi kapalı görünümü doğrulandı. Production adayı korumalı olduğu için sadece bu sürüme 23 saatlik inceleme bağlantısı oluşturuldu; projenin koruması ve Trusted Sources kuralları değiştirilmedi.

Kullanıcı “Evet, bu web sürümünü canlıya al” diyerek açık onay verdi. Test edilmiş production çıktısı yeniden derlenmeden 5 Kasım 2026'da www.ortaksat.com'a promote edildi. Production hedefi `dpl_9z38RF3ZJqMXk2VzG8i2ao4kgKkp` olarak API üzerinden doğrulandı. Önceki deployment `dpl_7UxnrWCKY6VwtNyhDVbfGXtevmC2` geri dönüş için kayıtlıdır. Hiçbir Trust migration'ı veya Edge Function canlı backend'e uygulanmadı; Güven Sistemi kapalı kalır. Yayın sonrası tarayıcı kontrol sonuçları `live-*-checks.json` altında tutulur.

Canlı doğrulama tamamlandı: www.ortaksat.com üzerinde Chromium ve WebKit ayrı ayrı 25 sayfa/ölçü kontrolünden geçti. İki tarayıcıda da HTTP 200, sıfır sayfa istisnası, taşmasız görünüm ve kapalı Trust durumu doğrulandı. Kontroller gerçek kullanıcı verilerine yazmadan çalıştırıldı. WebKit kontrolünde sayfa değişmeden önce başlangıç veri isteklerinin tamamlanması beklendi; navigasyon sırasında iptal edilen istekler test başarısı olarak gizlenmedi.
