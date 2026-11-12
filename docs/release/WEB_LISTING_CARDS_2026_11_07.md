# İlan kartları — 7 Kasım 2026

Mobil tarayıcı, masaüstü web ve ortak bileşenlerde ilan kartlarının okunabilirliği ve ortaklık bilgisinin sunumu iyileştirildi.

## Değişiklikler

- Fotoğraf alanları 1.15 en/boy oranında; başlık iki satırla sınırlı, kart yüksekliği içerikle sınırlı.
- Gerçek para birimi korunuyor; büyük fiyatlar dar iki sütunlu kartlara sığıyor.
- Tahmini komisyon ayrı bir bantta; anında katılım, satıcı onayı ve davet koşulları ayrıştırılıyor. Kapalı veya satışa uygun olmayan ilanlarda tahmini komisyon gösterilmiyor.
- Favori, karşılaştırma ve koleksiyon işlemleri ayrı dokunma hedefleri. İlan detayları gerçek tarayıcı bağlantısı; yönlendirme parametreleri korunuyor.
- Masaüstü ana sayfa ortak ListingCard bileşenini kullanıyor. Keşfet ve Ortak Satış kartlarında aynı komisyon sunumu var. Favori özetleri daha kompakt.
- Gerçekleşmiş ödeme veya güven puanı üretilmiyor. Mevcut backend hesaplama ve yetkilendirme kuralları korunuyor.

## Dosyalar

- components/listing-card.tsx
- components/listing-commission.tsx (yeni)
- components/home-desktop.tsx
- components/mobile/partnership-listing-card.tsx
- app/(tabs)/explore.tsx
- app/favorites.tsx
- lib/card-layout.ts (yeni)
- scripts/check-web-listing-cards.mjs (yeni)

## Doğrulama

TypeScript, ESLint/hooks ve Türkçe karakter kontrolleri başarılı.
Yerel Chromium/WebKit: 320, 390, 430, 768, 1024, 1440 genişlikleri; uzun başlıklar, TRY/EUR/USD, beş ortaklık/ilan durumu. Fiyat sığması, görsel oranı, 44 piksel hedefler, karşılaştırma ve gerçek ortaklık başvuru ekranına geçiş doğrulandı. Veriler yerel mock; gerçek kayıt oluşturulmadı.
Yayın adayı Chromium/WebKit: her motor için 45 sayfa/ölçü kontrolü ve 6 gerçek katalog kartı kontrolü başarılı. Backend yalnızca okunur; yazma istekleri engellendi. Kompakt filtreler ve giriş/kayıt/şifre sıfırlama da kontrol edildi.
Kanıtlar: audit/web-cards/ ve audit/web-cards-release/.

## Yayın

Aday: dpl_CN2XFQCfKqiEik118MY5xExopKV4
URL: https://ortaksat-f9m93cc5e-fatih5.vercel.app
Önceki canlı / geri dönüş: dpl_HTheM7FK6cCvNeoBdbQwS9jXdQtp
Hedef: https://www.ortaksat.com

Yayın tamamlandı: www.ortaksat.com doğrulanan aday sürüme geçirildi; Vercel API üzerinden proje hedefi ve alan adı doğrulandı. Canlı Chromium ve WebKit kontrolleri motor başına 12 sayfa/ölçü ve 6 kart kontrolüyle başarılı; sayfa istisnası yok. Kanıt: audit/web-cards-release/live-release-receipt.json.
Veritabanı migration uygulanmadı; Güven Sistemi kapalı kaldı. Bu yayın web sürümüdür; imzalı mobil mağaza paketi hazırlanmadı ve emülatör kontrolü bu kapsamda yapılmadı.
