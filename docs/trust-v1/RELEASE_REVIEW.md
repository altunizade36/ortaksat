# Güven Sistemi 1.0 — yayın incelemesi

Tarih: 5 Kasım 2026. Bu belge bir tamamlanmış canlı hizmet beyanı değildir.

Yayın güncellemesi: kullanıcının açık onayıyla web arayüzü `dpl_9z38RF3ZJqMXk2VzG8i2ao4kgKkp` üzerinden www.ortaksat.com'a alındı. Trust backend ve migration'lar canlıya kurulmadı; sistem kapalıdır. Bu onay gerçek SMS/antivirüs entegrasyonlarının doğrulandığı veya Trust özelliğinin açıldığı anlamına gelmez.

## Mimari

Expo 54, React Native 0.81, React 19, TypeScript ve Expo Router aynı depodan web, Android ve iOS üretir. Supabase Auth/PostgreSQL/RPC/Storage iş kurallarını paylaşır. Web Vercel `ortaksat` projesindedir. Mevcut profiles, partnerships, commissions, orders, notifications, activity_logs ve destek altyapısı korunur. Satıcı/ortak/alıcı işlem rolleri, yönetici rolünden ayrıdır.

## Uygulanan kapsam

- Gerçek telefon doğrulama durumu; sağlayıcı kapalıysa doğrulanmış rozeti veya başarılı SMS gösterilmez.
- İki tarafın hash üzerinden onayladığı, tamamlanınca değiştirilemeyen anlaşma sürümleri. Değişiklik yeni sürüm ve yeniden onay gerektirir.
- İlk geçerli alıcı yönlendirmesi, çakışma kilitleri, hesaplı alıcı doğrulaması ve yapılandırılabilir misafir e-posta OTP akışı. Tıklama satış değildir.
- Ayrı satış ve komisyon durumları, aktör/tarih/gerekçe/önceki durum kaydı, idempotent komutlar ve sürüm kontrolü.
- Mevcut komisyon/order kayıtlarıyla bağlantı: aynı satış için ikinci borç veya ikinci stok düşümü oluşturulmaz. Satıcının ödeme beyanı, ortağın ödeme onayından ayrıdır.
- Üç rol için işlem bağlı değerlendirmeler; karşılıklı yorum veya 14 günlük süre bitene kadar gizlilik. Yeni kullanıcı, vazgeçen alıcı ve açık şikâyet otomatik risk puanı üretmez. Eski yapay güven yüzdeleri kaldırıldı.
- Özel belge karantinası, dosya türü/imza/boyut/hash kontrolü, yapılandırılabilir antivirüs, kısa süreli yetkili indirme bağlantısı.
- İtiraz, karşı cevap, temiz belge ilişkilendirme, yönetici gerekçeli kararı ve süreli kısıtlama/kaldırma. Açık itiraz kesin ihlal sayılmaz.
- Mevcut bildirimlere işlem bağlantısı; kalıcı mükerrerlik anahtarları ve bakım uç noktası.
- Ortak web/native Güven Merkezi; profil rol seçimi, anlaşma, yönlendirme, işlem, komisyon, değerlendirme, belge, itiraz ve yönetici görünümü. Masaüstünde web başlığı, küçük ekranda alt navigasyon kullanılır.
- OrtakPay yalnızca kapalı teknik durum modeli. Para transferi, escrow, banka doğrulaması ve sahte para kaydı yok.

## Veritabanı

Yeni public tablolar: `partnership_agreements`, `partnership_transactions`, `buyer_referrals`, `transaction_evidence`, `transaction_reviews`, `trust_disputes`, `trust_dispute_responses`. Eklenen tablo sayısı **7**. Ayrı `commission_claims` oluşturmak yerine mevcut `commissions` yeniden kullanılır.

Özel tablolar: `trust_private.settings`, `requests`, `restrictions`, `notification_keys`, `guest_challenges`. Public tablolarda RLS ve doğrudan erişimi kapatan izinler; hassas komutlar kontrollü sunucu fonksiyonları üzerinden çalışır. Hassas alıcı kimlik anahtarı, telefon, IBAN ve özel belgeler public profilde yer almaz.

Migration sırası:

1. `20261101132437_trust_system_v1_foundation.sql`
2. `20261101133136_trust_system_v1_read_models.sql`
3. `20261101133531_trust_system_v1_evidence.sql`
4. `20261101134345_trust_system_v1_operations.sql`
5. `20261101134700_trust_system_v1_scan_jobs.sql`
6. `20261101135119_trust_system_v1_guest_referrals.sql`
7. `20261104160150_trust_system_v1_legacy_commission_bridge.sql`

Bu migration'lar **canlı Supabase'e uygulanmadı**. Geçmiş kayıtlar sahte onay/ödeme ile doldurulmadı. Geri alma veri silmez: önce feature flag kapatılır; [devre dışı bırakma SQL'i](./DISABLE.sql) hazırlanmıştır.

## Test kanıtları

Kanıtlar yerel `audit/trust-v1/` altında bulunur; deployment paketine eklenmez.

| Kontrol | Sonuç / sınır |
| --- | --- |
| SQL/RLS/aktör/immutable anlaşma/durum geçişleri | PGlite üzerinde gerçek migration'larla geçti; sentetik veriler |
| Yarış koşulları | PostgreSQL 17.11, 8 ayrı bağlantı; tek işlem dosyası, tek muhasebe kaydı, tek stok düşümü, tek ödeme olayı, ilk geçerli yönlendirme geçti (`concurrency-receipt.json`) |
| Komisyon | PostgreSQL ile 105 kesin tutar karşılaştırması, hatalı tutar/rate reddi geçti (`domain-nov5.log`) |
| Edge | Gerçek Deno handler'ları, ağ tamamen taklit; auth/CORS/OTP/hash/tarama sözleşmesi testleri geçti (`edge-tests.log`) |
| Web akışı | Chromium ve WebKit; 320/390/768/1440 genişlik, satış/ödeme ayrımı, gizli yorum, ağ hatasında form ve idempotency anahtarının korunması geçti |
| Statik kalite | TypeScript, lint ve Türkçe karakter kontrolü geçti (`*-nov5.log`) |
| Android/iOS paketleme | Expo export Android/iOS Hermes ve web çıktısı üretti; imzalı APK/IPA değildir |
| Android emülatör | Gerçek uygulama açılışı, misafir profil görünümü, özel merkeze giriş kontrolü ve geri dönüş geçti (`native-checks-nov5.json`); aktif backend ile native satış/ödeme akışı henüz denenmedi |
| Gerçek servis entegrasyonu | SMS, gerçek antivirüs ve özel Storage uçtan uca akışı henüz doğrulanmadı; testler bunları gerçekmiş gibi saymaz |

Giderilen önemli sorunlar: nullable alıcıdan kaynaklanan yetki kontrolü, eski/yeni muhasebe çakışması, eşzamanlı işlem yarışı, belge erişimi, sahte audit/bildirim üretimi ve eski yapay güven puanları. Mobildeki geçersiz EAS proje kimliği kaldırıldı. WebKit testlerinde store yüklenmesi tamamlanmadan sayfa değiştirme ve eksik CORS mock başlıkları düzeltildi; hata filtrelenmedi.

## Deployment ve açık işler

Önizleme adresi ve deploy kimliği [deployment kaydında](./DEPLOYMENT.md) tutulur. Önizleme Vercel Authentication korumasındadır. Backend feature flag kapalıdır; canlı kullanıcı verisi test amacıyla kullanılmadı.

Canlıya geçmeden önce:

1. Bu dosyaların migration sırasını, yedeği ve geri alma planını production sahibiyle gözden geçir.
2. SMS sağlayıcısı ve gönderici yapılandırmasını doğrula. Mevcut incelemede telefon sağlayıcısı aktif değildi.
3. Antivirüs URL/anahtarı, özel bucket, gerçek yetkili indirme ve reddedilen dosya senaryolarını izole servis ortamında doğrula.
4. Misafir OTP için `TRUST_GUEST_ENABLED`, `RESEND_API_KEY`, `TRUST_EMAIL_FROM`, en az 32 karakter `TRUST_OTP_SECRET`; bakım için ayrı `TRUST_MAINTENANCE_SECRET` yapılandır. Mevcut bir anahtarın bulunması ilgili hizmetin test edildiği anlamına gelmez.
5. `TRUST_ALLOWED_ORIGINS` yalnızca açıkça onaylı web origin'lerini içersin. Service role istemciye gönderilmesin. Bakım çağrısı için yetkili zamanlayıcı kurulsun.
6. Belge saklama/silme ve itiraz operasyonunu [runbook](./OPERATIONS.md) üzerinden onayla. Otomatik belge silme henüz etkin değildir; kullanıcı silme talepleri mevcut destek kanalından elle incelenir.
7. Ayrı Supabase staging olmadığı için, servis entegrasyonu doğrulanmadan özelliği canlıda açma. Veri erişimi testlerini gerçek Supabase policy/storage ortamında da tekrarla.
8. Production ortamında derlenmiş adaysürümü doğrula; kullanıcının açık production onayından sonra alan adına geçir. Migration uygulamak ve feature flag açmak ayrıca kontrollü adımlardır.

Mobil için kullanıcı EAS giriş yapmadan devam etmeyi seçti. Yerel emülatör ve export kullanılabilir; bulut EAS build, imzalı APK/IPA ve mağaza yayını yapılmadı. iOS cihaz testi yapılmadı.

Kapasite sınırları: işlem listesi 50'lik sayfalarla gelir; anlaşmalar son 50, olaylar son 250, yönetici kuyruğu son 100 kayıtla sınırlıdır. Kapsamlı geçmiş arama/dışa aktarma ek çalışma gerektirir. Otomatik belge maskeleme yok; yükleme öncesi kullanıcıya maskeleme talimatı verilir. Saklama süresi teknik taslaktır; hukuki uyumluluk sertifikası değildir.

## Dosya grupları

- `lib/trust-v1/{model,api}.ts`: tipler, hesaplama, RPC/OTP/belge istemcisi.
- `components/trust/{workspace,screen,entry,phone-verification}.tsx`: ortak arayüz.
- `app/{guven-merkezi,guven-profili,guven-yonlendirme}.tsx`: rota girişleri.
- `supabase/migrations/*trust_system_v1*.sql`: yedi migration.
- `supabase/functions/{trust-evidence,trust-referral,trust-maintenance}/`, `_shared/`, `deno.json`, `supabase/config.toml`: sunucu entegrasyonları.
- `scripts/check-trust-*.mjs`, `trust-database-fixture.mjs`, `fixtures/trust-legacy-guard.sql`, `mobile-auth-fixture.mjs`: izole testler.
- `lib/trust-score.ts`, profil/satıcı/mağaza/ilan ekranları, mobil ortaklık merkezi: eski yanıltıcı puanların kaldırılması ve yeni girişler.
- `lib/notification-target.ts`, `lib/types.ts`, `lib/mobile-access.tsx`: bildirim ve misafir erişimi.
- `app.json`, `package.json`, lock dosyası, `tsconfig.json`, `scripts/indexnow.mjs`: yapılandırma/paketleme.

Çalışma ağacında önceki görevlerden çok sayıda ek değişiklik vardır; bu liste tüm kirli dosyaların yalnızca bu görevde yazıldığı anlamına gelmez.
