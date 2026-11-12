# Mobil ve mobil web — pratik kullanım geliştirmeleri

5 Kasım 2026. Bu değişiklikler önceki canlı web sürümünden sonra hazırlandı. Yeni migration, veri aktarımı, SMS/ödeme işlemi veya mağaza yayını yok.

## Değişiklikler

- Native ilan verme konum alanına kullanıcı başlatımlı “Konumumu kullan” eklendi. Native filtredeki aynı akış ortak servise alındı. Konumdan yalnız desteklenen il/ilçe seçimi türetilir; açık adres veya koordinatlar ilan verisi olarak yazılmaz.
- İlçeler, bağlı oldukları il içinde eşleştirilir. Türkçe/ASCII ve “Province / ilçesi” gibi idari ad varyantları desteklenir; bilinmeyen/yabancı konumdan sahte seçim üretilmez. İlçe bulunamazsa yalnız il seçilir, kullanıcı ilçeyi elle tamamlar.
- GPS/ters konum çözümleme 25 saniye ile sınırlıdır; izin verilmemesi ve servis hatası için anlaşılır geri bildirim var. Kullanıcı bu sırada elle konum seçerse gecikmiş GPS sonucu seçimini ezmez. Ekrandan çıkılan istekler forma uygulanmaz.
- Expo SDK 54 tarayıcıda ters konum çözümlemeyi desteklemediğinden webde çalışmayan GPS düğmesi gösterilmez ve gereksiz konum izni istenmez. Web il/ilçe/mahalle seçimi korunur; dışarıdan yeni bir harita servisi veya anahtar eklenmedi.
- Fiyat sürgüsünün her tutma alanı 44×44 ölçüsüne getirildi. Native artır/azalt erişilebilirlik eylemleri, webde sayısal ARIA değerleri ve klavye okları eklendi. Minimum/maksimum birbirini geçmez; sayısal girişler korunur.
- Galeri, telefon/tablet genişliği değiştiğinde seçili fotoğrafı korur ve sayfayı yeni genişliğe hizalar. Yeni ilanda seçim sıfırlanır. Ana görselin mevcut tam çözünürlük davranışı korunur.
- Mobil web Keşfet kartında fiyat artık kısaltılmış/yaklaşık değer yerine tam tutar ve para birimiyle gösterilir; dar alana uyum için yazı ölçeklenir.
- Mevcut fotoğraf sayısı sınırı değiştirilmedi; video eklenmedi.

## Dosyalar

`lib/geocoded-location.ts`, `lib/current-location.ts`, `components/listing-location-fields.tsx`, `components/mobile/catalogue.tsx`, `components/mobile/listing-detail.tsx`, `app/(tabs)/explore.tsx`.

## Doğrulama

- `scripts/check-device-location.mjs`: 81 il, 973 ilçe, il sınırı, yabancı/bilinmeyen ad, izin reddi, webde GPS çağrılmaması ve zaman aşımı temizliği geçti. Konum sağlayıcısı ve koordinatlar sentetiktir; gerçek GPS sağlayıcısının uçtan uca testi değildir.
- Mobil katalog UI: 50 sonuçta sayfalama, filtre sonucunun doğru sayılması, vazgeçilen kategori taslağının korunmaması, ağ hatasında yeniden deneme ve 320 piksel görünüm geçti.
- `scripts/check-mobile-filter-controls.mjs`: 44 piksel hedefler, ekran okuyucu değerleri, klavye okları ve sürüklemenin gerçek filtre alanını güncellemesi geçti.
- `scripts/check-mobile-gallery-layout.mjs`: seçili üçüncü fotoğraf 740/320/430 genişliklerinde aynı hizada; fotoğraf sayacı doğru; taşma ve sayfa istisnası yok.
- İlan verme UI: taslak yeniden açma, marka/model ve kategori alanı değişimi, özel başlığın korunması ve ilan yayınlamadan yerel taslak kaydı geçti.
- Android `OrtakSat_Mobile_API35` / Expo Go üzerinde uygulama ve filtre açıldı. Native sürükleme minimum fiyatı değiştirdi; Android erişilebilirlik ağacında güncel değer okundu (`mobile-next-native-checks.json`). Gerçek kullanıcıya ilan/ödeme yazılmadı.
- TypeScript, lint ve Türkçe karakter kontrolleri geçti. Paketleme sonuçları `audit/mobile-web-nov5/mobile-next-export-final.log` içindedir. EAS oturumu açılmadı; imzalı APK/IPA veya mağaza yayını yapılmadı.
- Android/iOS Hermes ve statik web export tamamlandı. Güncel statik web çıktısında Chromium ve WebKit ayrı ayrı 42 sayfa/ölçü kombinasyonunda geçti; tam fiyat tutarı, kategori aç/kapat ve taşmasız düzen doğrulandı.

## Önizleme

Bu değişiklikler için Vercel Preview: `https://ortaksat-5xhk9ymou-fatih5.vercel.app`, deployment `dpl_HGiB6X6kzuP4AFk7FTbsXAxi7iLF`. Önceki onaylı canlı sürüm `dpl_9z38RF3ZJqMXk2VzG8i2ao4kgKkp` korunur. Yeni backend kurulmadı, Güven Sistemi açılmadı. Native geliştirme Expo Go üzerinden yerelde test edildi; üretim webinde native önizleme bayrağı açık değildir.

Kanıt dosyaları `audit/mobile-next/` ve `audit/mobile-web-nov5/mobile-next-*` altında; deployment paketinden hariçtir. Native ekran okuyucu eylemleri API ve erişilebilirlik ağacı düzeyinde kontrol edildi; VoiceOver/TalkBack ile kapsamlı kullanıcı testi yapılmadı.
