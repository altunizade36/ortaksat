# Mesajlaşma düzeni — 7 Kasım 2026

## Son davranış

Mesajlaşma ekranı daha küçük ve sakin öğelerle düzenlendi. Masaüstündeki dört büyük istatistik kartı kaldırıldı. İlan ayrıntıları 1200 piksel ve üzerinde istenirse açılıyor; varsayılan iki panel sohbet için daha çok alan bırakıyor. Mesaj balonları açık turkuaz/beyaz, yazma alanı tek satır başlangıçlı ve sınırlı yüksekliğe sahip.

Mobil webde engelleme ve bildirme düğmeleri sohbet seçeneklerine taşındı; hazır yanıtlar yalnızca kullanıcı açtığında görünüyor. Hazır yanıt satırı yazmaya odaklanınca kendiliğinden kaybolmuyor. Native sohbetin uzun web footer'ı kaldırıldı; ilan bağlamı kompakt bir satır, hızlı yanıtlar açılır alan oldu.

## Akış düzeltmeleri

- Masaüstünde taslaklar konuşma kimliğine göre ayrı tutuluyor. Sohbet değişimi taslağı başka kişiye taşımıyor.
- Arama veya filtre sonucu boş olduğunda, filtre dışı eski konuşma gösterilmiyor.
- Okundu işaretleme yalnızca gerçekten açık olan ve okunmamış mesajı bulunan masaüstü konuşmasında çalışıyor. Okunmamış filtresinde açılan sohbet okundu olduğunda kendiliğinden sonraki sohbete geçilmiyor; diğer konuşmalar okunmamış kalıyor.
- Kapalı konuşmaların geçmişi okunabiliyor; mesaj yazma alanı gösterilmiyor. Sunucunun mevcut engelleri ve gönderim kontrolleri korunuyor.
- Mobil web dosya ekleri açılabilir bağlantı hâline getirildi. Fiyat ve komisyon metinleri gerçek ilan para birimini kullanıyor.
- İlan durumu gerçek yayında/yayında değil bilgisine dayanıyor; varsayılan yüzde 0 yanıt oranı veya risk içermeyen kelimeler için ödeme güvencesi ima edilmiyor.

## Değişen dosyalar

- app/(tabs)/messages.tsx
- app/chat/[id].tsx
- components/mobile/messages.tsx
- scripts/check-messaging-design.mjs (yeni)

## Testler

TypeScript, ESLint/hooks ve Türkçe karakter kontrolü geçti. Yerel, tamamen mock backend ile Chromium ve WebKit'te 320/390/768/1024/1440 ölçülerinde kontrol edildi. Taslak ayrımı, boş arama sonucu, yerel mesaj gönderimi, kapalı sohbet, okunmamış filtresinin otomatik okuma yapmaması, ayrıntılar ve menü/hazır yanıt açma kapama doğrulandı. Gerçek kullanıcılar arasında test mesajı gönderilmedi.

Android Expo export başarılı: dist-check-messaging-android. Bu bir JavaScript/Hermes paket derlemesidir; imzalı APK veya mağaza yayını değildir. Emülatör/gerçek cihaz ve gerçek realtime teslimat bu turda doğrulanmadı.

Yerel kanıtlar: audit/messaging-design/, audit/messages-typecheck.log, audit/messages-lint.log, audit/messages-encoding.log, audit/messages-android-export.log.

## Yayın takibi

Aday: dpl_ErPyBRT7uyHRuywCJV36RNPsxw8N
Aday URL: https://ortaksat-lyidxbdp8-fatih5.vercel.app
Önceki canlı / geri dönüş: dpl_CN2XFQCfKqiEik118MY5xExopKV4
Hedef: https://www.ortaksat.com

Yayın tamamlandı ve Vercel API üzerinden canlı hedef/alan adı doğrulandı. Yayın adayında her tarayıcı için 45 sayfa/ölçü, 6 ilan kartı ve 4 mesaj giriş-dönüş kontrolü; canlı sitede 12 sayfa/ölçü, 6 ilan kartı ve 4 mesaj giriş-dönüş kontrolü başarılı. Chromium ve WebKit sayfa istisnası yok. Kanıt: audit/messaging-release/live-release-receipt.json. Migration veya backend iş kuralı değişikliği uygulanmadı. Güven Sistemi feature flag'i kapalı kaldı.
