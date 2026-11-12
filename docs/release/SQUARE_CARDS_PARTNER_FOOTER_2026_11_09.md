# Kare kartlar, ortaklık alanı ve footer yayını — 9 Kasım 2026

## Canlı sürüm

- Alan adı: https://www.ortaksat.com
- Vercel deployment: `dpl_C64JAXSkkUGB3MqvFqU8KBm5LhR1`
- Aday build test edilip yeniden derlenmeden production'a yükseltildi.
- Önceki production geri dönüş noktası: `dpl_BZt2GFjWXhZLeMmijsEnMC7FYWbB`
- Veritabanı migration'ı uygulanmadı; Güven Sistemi feature flag'i açılmadı.

## Tamamlanan arayüz işleri

- İlan kartları ana sayfa, keşfet, favoriler ve ortak satışta ortak kompakt geometriye geçirildi.
- Kart üzerinde yalnızca başlık, fiyat, şehir ve komisyon gibi karar bilgileri bırakıldı.
- Fotoğraf oranı `2:1`, sabit bilgi gövdesi `96 px`, kompakt komisyon bandı `24 px` yapıldı.
- “Tahmini komisyon” yerine “Komisyon” kullanıldı.
- Ana sayfadaki en çok kazandıran, son gezilen ve en yeni şeritleri ortak kart bileşenine bağlandı.
- Ortaklık fırsatları masaüstü üst alanı; kompakt başlık paneli, küçük sekmeler, 44 px arama ve 36 px kategori çipleriyle yeniden düzenlendi.
- Eski çok sütunlu koyu footer kaldırıldı. Web, mobil web ve native kabukta tek, açık zeminli, tam genişlikte ve 96–112 px footer kullanıldı.
- Ana turkuaz palet daha canlı hale getirildi; metin kontrastları korundu.

## Doğrulama

- Chromium ve WebKit: aday build'de 45'er rota/görünüm kontrolü.
- Chromium ve WebKit: 390/1440 px ana sayfa, keşfet ve ortak satış kart kontrolü.
- Mobil web footer: 8 rota × 320/390 px; tam genişlik, tek footer, taşma yok.
- Ortaklık alanı: 320/390/1024/1440 px; Chromium ve WebKit.
- Mesaj erişimi ve ilan detayı: iki tarayıcıda geçti.
- Android Hermes export: `dist-check-square-ui-android`.
- iOS Hermes export: `dist-check-square-ui-ios`.
- Encoding, ESLint ve TypeScript kontrolleri temiz.
- Canlı production: 12 rota/görünüm ve 6 kart kontrolü her iki tarayıcıda geçti.
- Son 30 dakikalık Vercel production runtime error taraması: 0 kayıt.
