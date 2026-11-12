# Bildirim okundu kaydı ve bağımsız yenileme — 27 Ekim 2026

Yerel çalışma; canlıya yayınlanmadı.

## Davranış

- Okundu işaretleme Promise<boolean> sonucunu döndürür. Sunucu güncellemesi başarısızsa iyimser okundu durumu geri alınır; kullanıcıya tekrar deneyebileceği bildirilir. Aynı kayda uçuşta tekrar yazma engellenir.
- Güncelleme hem bildirim kimliği hem kullanıcı kimliğiyle sınırlandırılır. Güncellenen kaydın döndüğü doğrulanır; RLS nedeniyle satır etkilenmemesi başarı sayılmaz. Sunucudaki mevcut RLS korunur.
- Webde sunucu başarısızlığını gizleyen ayrı readMap kaldırıldı. Sayaçlar ve okunmamış filtreleri ortak store durumunu izler.
- Toplu işaretlemede işlem kilidi vardır. Kısmi başarısızlıkta başarılı kayıtlar okunmuş kalır, başarısızlar geri döner ve yeniden denenebilir. Görünür bildirimler işlenir.
- Bildirim yenileme ayrı sorgu kullanır: diğer hesap tablolarını yeniden yüklemez. Hata durumunda mevcut liste korunur; yeni başarıda liste güncellenir. Hesap değişmişse eski isteğin yanıtı uygulanmaz. Mobilde ve webde görünür yenileme düğmesi ve hata bildirimi vardır.
- Hedefi olmayan bildirimler ayrıntı penceresini açmayı sürdürür; okundu kaydı başarısızlığı bu ayrıntıya erişimi engellemez.

## Kontroller

- `scripts/check-notification-recovery-ui.mjs`: mobil geliştirme önizlemesi ve 1440 piksel üretim web çıktısında tek bildirim hatası/geri alma, kısmi toplu işlem/yeniden deneme, yenileme hatasında listeyi koruma, başarıda yeni bildirimi yükleme geçti. Kanıtlar: `audit/mobile-v4/notification-recovery-ui.json`, `audit/web-review/notification-recovery-ui.json`.
- TypeScript ve değiştirilen ekranlarda ESLint geçti: `audit/mobile-v4/notification-recovery-typescript.log`, `audit/mobile-v4/notification-recovery-eslint.log`.
- Web çıktısı: `dist-check-mobile/notification-recovery-web`.
- Android çıktısı: `dist-check-mobile/notification-recovery-android`.
- Supabase güncel değişiklik özeti ve update/select belge akışı kontrol edildi: https://supabase.com/changelog.md ve https://supabase.com/docs/reference/javascript/update .

Tüm test HTTP/WebSocket trafiği taklit edildi; canlı bildirim kaydı değiştirilmedi. Veritabanı şeması veya RLS değiştirilmedi. Android dışa aktarımı emülatör/cihaz çalıştırma testi değildir. Genel hesap yenilemesinin diğer ekranlardaki kısmi veri davranışı bu kapsamda değiştirilmedi.
