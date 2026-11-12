# OrtakSat Güven Sistemi 1.0

Durum (5 Kasım 2026): backend, ortak web/native ekranları ve izole test altyapısı geliştirildi. Güncel kapsam, test kanıtları ve açık işler [yayın incelemesinde](./RELEASE_REVIEW.md). Kullanıcının açık onayıyla web arayüzü canlıya alındı; Trust backend migration'ları uygulanmadı ve Güven Sistemi canlıda kapalı.

## Mevcut mimari ve yeniden kullanım

- Expo 54 / React Native / React 19 / TypeScript; Expo Router aynı depodan native Android/iOS ve statik web üretir. Web Vercel `ortaksat` projesinde `npm run build:web` ile yayınlanır.
- Supabase Auth, PostgreSQL, RLS, Storage ve RPC ortak backend'dir. Canlı şemada 56 tablo/görünüm, 563 kolon, incelenen 50 ilgili fonksiyon ve 132 policy var. Şema yalnızca okundu; kullanıcı satırları dışa aktarılmadı.
- `profiles`: tek hesap ve mevcut yönetim rolü. İşlemde satıcı/ortak/alıcı olmak ayrı platform yönetim rolü değildir; mevcut role alanı çoklu iş rolüyle karıştırılmayacak.
- `partnerships`: başvuru, ref_code ve immutable agreed_* snapshot zaten var. Yeni sürümlü anlaşma kaydı bu ilişkinin üzerine eklenecek; eskiler sahte karşılıklı onayla backfill edilmeyecek.
- `leads`, `referral_public_links`, `referral_clicks`: mevcut atıf altyapısı. Tıklama, alıcı kimliği veya satış kanıtı sayılmayacak.
- `commissions`: mevcut miktar, satış/ödeme durumları ve iki taraflı ödeme beyanı/onayı var. Yeni işlem dosyası mevcut komisyon kaydını ilişkilendirecek; eski alanların anlamı otomatik değiştirilmez.
- `reviews`: mevcut açık ürün/satıcı/ortak yorumları. Gizli dönem, işlem uygunluğu ve üç rol gerektiren yeni değerlendirmeler ayrı kayıtlarla izole edilir; mevcut public sorgulardan sızdırılmaz.
- `activity_logs`, `notifications`: mevcut audit ve bildirim altyapısı kullanılacak. Yeni olaylar idempotency anahtarıyla ayrılır.
- `support_tickets`, `support_messages`, `reports`: mevcut destek ve moderasyon kayıtları korunur; işlem itirazı bunlara isteğe bağlı bağlanır.
- `private-evidence`: mevcut destek kanıtları; yeni karantina/tarama gerektiren dosyalar için izole özel bucket gerekir. Eski dosyalara yeni erişim hakkı verilmez.

## Doğrulanan eksikler

1. `lib/trust-score.ts` profil tamlığı ve doğrulanmamış davranışlardan puan hesaplıyor; yeni hesabı Riskli, sonuçlanmamış itirazı negatif gösterebiliyor. Yeni rol karnesi bunları kullanmayacak.
2. Mevcut anlaşma ilk snapshot'ı koruyor; iki tarafın her sürüme ayrı onayı ve yeniden müzakere kaydı yok.
3. Eski commission_status satış, iade ve ödeme süreçlerini birleştiriyor. Alıcının satış onayı metinleri komisyon doğrulamasıyla karışabiliyor.
4. Eski yorumlarda üç ayrı rol, çift kör yayın penceresi ve boyutsal kriterler yok.
5. Telefon sağlayıcısı canlıda kapalı; Twilio seçili ancak anahtar yapılandırılmamış. Sahte OTP/rozet üretilmeyecek.
6. Zararlı dosya tarayıcısı henüz doğrulanmadı. Yapılandırılmadan kanıtlar temiz sayılmayacak.

## Aşamalar ve kabul ölçütleri

1. Backend/veritabanı: kapalı sunucu feature flag, mevcut kimlikle yetkilendirme, RLS, immutable sürümler, ayrı durum makineleri, idempotent audit/bildirim. Geri alma önce kapatır; verili tabloları düşürmez.
2. Ortaklık/komisyon: iki onay, işlem dosyası, ilk geçerli alıcı atfı, belgeyi banka onayı saymayan ayrı ödeme akışı. Çakışma ve yarış testleri.
3. Karneler: üç rol, işlem bağlı çift kör yorumlar, sıfır veri için nötr görünüm; en az 10 uygun kayıt olmadan yüzde gösterilmez.
4. Kanıt/itiraz: karantina, MIME/magic/size, tarama adaptörü, yetkili erişim ve cevap hakkı; kesinleşmeyen şikâyet ihlal olmaz.
5. Web/native: ortak API; profil, anlaşma, yönlendirme, işlem, komisyon, değerlendirme, kanıt, itiraz ve admin ekranları. Boş/yükleniyor/hata/başarı durumları.
6. Test/staging: SQL yetkilendirme ve durum testleri, hesaplama, web/native akışlar, regresyon, kapalı staging deploy. Production öncesi kullanıcıdan açık onay.

## Sabit sınırlar

- Para tahsilatı, escrow, banka doğrulaması veya otomatik ödeme yok. OrtakPay yalnız tasarım ve kapalı flag.
- SMS/antivirüs olmadan doğrulama başarıya çevrilmez. Token sahibi olmak tek başına gerçek kişi kimliğini kanıtlamaz.
- İtiraz açılması, başvuru reddi, alıcının vazgeçmesi ve yeni hesap tek başına olumsuz puan nedeni değildir.
- Kişisel telefon/IBAN/kanıt public karnede bulunmaz. Ortaklık snapshot'ları otomatik resmî e-imza veya ödeme garantisi sayılmaz.
- Yeni özellikler ve migration'lar canlıya otomatik uygulanmaz. Kullanıcının tercihiyle ayrı test Supabase projesi yerine izole yerel PostgreSQL kullanıldı. Vercel önizlemesi, tam backend staging ortamı değildir.

## Kaynaklar

Uygulama kararı öncesi Supabase güncel değişiklikleri ve [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage erişim kontrolü](https://supabase.com/docs/guides/storage/security/access-control), [telefon OTP](https://supabase.com/docs/guides/auth/phone-login) belgeleri kontrol edildi. Bağlayıcı hukuki belge veya resmî e-imza hizmeti tasarlanmadı.
