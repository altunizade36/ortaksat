# İlana bağlı mesajlaşma ve kompakt ilan detayı — 7 Kasım 2026

## Tasarım ve platformlar

Masaüstü web: solda kişi/ilan araması ve Tümü, Alıcı, Satıcı, Ortaklık sekmeleri; ortada kişi başlığı, bağlı ilan şeridi ve konuşma; 1200 pikselden itibaren sağda ilan bilgileri paneli. Sağ panel gerektiğinde gizlenebilir. Kişi fotoğrafları gerçek avatar verisini kullanır; yoksa nötr avatar gösterilir. Giden balonlar koyu turkuaz, gelenler açık gri; boyutlar büyütülmedi.

Mobil tarayıcı: liste ve konuşma ayrı ekranlarda kalır. İlan şeridi ve teklif/ortaklık işlemleri kompakt olarak konuşmanın üstündedir. Native uygulamada aynı işlevler ortak bileşenlerle kullanılır; tablet düzeni iki paneldir. Klavye ve güvenli alan davranışları mevcut platform bileşenleriyle korunur.

## İş kuralları ve düzeltmeler

- Rol sekmeleri, hesabın sabit rolüne göre değil, ilgili konuşmadaki karşı tarafa göre belirlenir. Ortaklık konuşmaları ayrı gruptur.
- Arama kişi, ilan başlığı ve mesaj içeriğini kapsar. Aynı kişiyle farklı ilanlar ayrı konuşma ve ayrı ilan bağlantısı olarak tutulur.
- İlk katalog sayfasında bulunmayan eski sohbet ilanları ve eksik katılımcı profilleri mevcut public kolonlarla toplu yüklenir. Yalnız kendi konuşmalarının bağlamı istenir; kişi/ilan başına oturum içi tekrarlar engellenir, kullanıcı değişiminden sonra eski istek sonucu uygulanmaz. Telefon gibi özel alanlar bu sorgulara eklenmez.
- Gerçek `offers` kayıtları doğru ilan ve iki katılımcıyla eşleştirilir. Başka alıcının teklifi veya başka ilanın teklifi o sohbette gösterilmez.
- Teklif tutarı/notu mevcut `createOffer` servisiyle kaydedilir; karşı teklif kabul/ret işlemleri mevcut sunucu RPC'lerinden geçer. Kabul işleminde istemci anlaşma tutarı göndermez.
- Hata durumunda teklif formu korunur; tekrar deneme mümkündür. Butonlar işlem sürerken ikinci isteği engeller. Kapalı, engelli, stok dışı veya örnek ilanlarda uygun işlem engelleri korunur.
- StoreContext memo bağımlılıklarında eksik `offers` nedeniyle kaydedilen yeni teklif ekranda görünmeyebiliyordu. Bağımlılık düzeltildi. Ön plana dönünce hesap verisiyle birlikte teklifler de yeniden okunur.
- Native gelen kutusundaki okunmamış filtre otomatik olarak sıradaki konuşmaları açmaz; kullanıcı seçimi korunur. Önceki web taslak ve okundu düzeltmeleri için regresyon testleri tekrar geçti.
- Telefon tercihi yalnız mevcut telefon/WhatsApp akışını kullanır. Görüntülü arama servisi veya doğrulanmış çevrimiçi durum altyapısı olmadığı için bunlar çalışıyormuş gibi gösterilmez. Yazıyor göstergesi mevcut typing olaylarını kullanır.
- Yeni para transferi, banka doğrulaması, ödeme veya kimlik doğrulama sistemi eklenmedi. Teklif kabulü ödeme/teslimat tamamlandı anlamına gelmez.

## İlan detayı sadeleştirmeleri

Ortaklık koşulları tek özette toplandı. Tahmini komisyon, katılım biçimi, yönlendirme süresi, vade ve hak ediş koşulu görünür; satıcının kuralları ayrıntılarda açılır. Teknik özellikler ilk dört satırla başlayıp genişletilir. Mobil alt çubuğun uzun fiyatlı ve tekrarlanan işlem düğmeleri kısaltıldı. Native detayda yinelenen satıcı mesajı/ortaklık düğmeleri kaldırıldı; footer işlemleri korunur.

Üyelik kaydı olmayan ilanda sahte kabul/bekliyor durumlarıyla anlaşma kartı gösterilmez. Gerçek mevcut ortaklık kaydı açılır bölümden erişilebilir. Anlaşma kartındaki fiyatlar gerçek para birimini kullanır; ortaklık tamamlandı durumu komisyon ödendi olarak adlandırılmaz.

## Dosyalar

- app/(tabs)/messages.tsx
- app/chat/[id].tsx
- app/listing/[id].tsx
- components/conversation-listing-strip.tsx (yeni)
- components/conversation-listing-actions.tsx (yeni)
- components/conversation-offer-card.tsx (yeni)
- components/listing-terms-summary.tsx (yeni)
- components/mobile/messages.tsx
- components/mobile/listing-detail.tsx
- components/agreement-card.tsx
- components/accordion.tsx
- lib/inbox-model.ts (yeni)
- data/app-store.tsx
- scripts/check-messaging-design.mjs
- scripts/check-conversation-reference.mjs (yeni)
- scripts/check-listing-detail-design.mjs (yeni)

## Testler ve sınırlar

TypeScript, ESLint/hooks ve Türkçe karakter kontrolü geçti. Chromium/WebKit: 320, 390, 768, 1024, 1440 genişliklerinde mesajlaşma regresyonu; rol sekmeleri, aynı kişi/farklı ilan bağlantıları, ilk katalogda bulunmayan ilan bağlamının yüklenmesi, özel teklif ayrımı, başarısız teklif oluşturma/tekrar deneme, karşı teklif yanıtında hata ve sunucu tutarıyla kabul, kapalı sohbet engelleri. İlan detayı 320/390/1440 ölçülerinde iki motorda kontrol edildi.

Native bileşenler geliştirme önizlemesinde Chromium ile 390/900 ölçülerinde aynı teklif/rol senaryolarından geçti. Android ve iOS Hermes paket export'ları başarılı: dist-check-reference-android, dist-check-reference-ios. Bunlar imzalı mağaza paketi veya gerçek cihaz/emülatör testi değildir. Canlı iki kullanıcı arasında mesaj veya teklif gönderilmedi. Yerel backend istekleri tamamen mock edildi.

Kanıtlar: audit/messaging-reference/, audit/conversation-reference/, audit/listing-detail-design/, audit/reference-*.log.

## Yayın

Aday: dpl_AbWKxX1Yjbp2JzkwkME1w7yiD58R
URL: https://ortaksat-dlvs6njig-fatih5.vercel.app
Önceki canlı / geri dönüş: dpl_ErPyBRT7uyHRuywCJV36RNPsxw8N
Hedef: https://www.ortaksat.com

Canlı doğrulama sonucu audit/conversation-reference-release/live-release-receipt.json dosyasında tutulur. Bu kayıt oluşmadan yayın doğrulaması tamamlanmış sayılmaz. Yeni migration uygulanmadı, RLS veya RPC yetkileri değiştirilmedi; mevcut sunucu kontrolleri kullanıldı. Güven Sistemi kapalı kaldı. Hosting kontrolleri yalnızca okuma yapar; görüntüleme sayacı yazmaları da test sırasında engellenir.
