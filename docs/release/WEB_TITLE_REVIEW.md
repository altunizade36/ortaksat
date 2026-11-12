# Web ilan başlıkları — 23 Ekim 2026

İlan oluşturma ve düzenlemede ortak 10–70 karakter kuralı uygulanır. Türkçe harfler ve ürün/model/ölçü noktalaması korunur; emoji, ok, yıldız, süsleme, HTML ve görünmez karakterler için alan uyarısı gösterilir. 71 karakterlik yapıştırma sessizce kesilmez, kayıt engellenir.

Bu turda web ilan detayının ana başlığı, tarayıcı sekmesi, OG/Twitter etiketleri, JSON-LD, fotoğraf erişilebilirlik metinleri ve paylaşım metinleri ortak `displayListingTitle` gösterimine bağlandı. Satıcı/ortak panelindeki kısa satırlar, teklifler ve favori koleksiyon başlığı da aynı gösterimi kullanır. Vercel crawler yanıtlarında ilan/mağaza/vitrin kartlarının başlıkları aynı şekilde temizlenir. Mevcut veritabanı başlıkları değiştirilmez; düzenleme formunda özgün metin ve düzeltme uyarısı korunur.

Doğrulama:

- `node scripts/check-listing-titles.mjs`: 28 başlık örneği ve kesilmeden uzunluk doğrulaması.
- `node scripts/check-listing-title-seo.mjs`: canlı ağa çıkmadan WhatsApp crawler yanıtında H1, OG, JSON-LD, fiyatın korunması ve normal tarayıcı geçişi.
- `MOBILE_TEST_URL=http://localhost:8088 node scripts/check-listing-titles-web-ui.mjs`: mobil önizleme bayrağı kapalı gerçek web arayüzü. Masaüstü kategori akışı, 320/390/1440 px oluşturma formu, mobil tarayıcı ilan detayı, sekme/OG/JSON-LD, özgün eski başlıkla düzenleme ve geçersiz kaydın istek göndermeden engellenmesi. Supabase HTTP/WebSocket trafiği test içinde taklit edilir; gerçek ilan kaydı yapılmaz.
- Hook lint, Türkçe kodlama ve TypeScript kontrolleri.
- `expo export --platform web --output-dir dist-check-mobile/web-title --max-workers 2`: web statik dışa aktarımı. Üretim sitesine dağıtım yapılmadı.

Görseller: `audit/mobile-v4/title-desktop-warning-1440.png`, `audit/mobile-v4/title-web-listing-clean-1440.png`.


## Canlı yayın

- Proje: `fatih5/ortaksat` (`prj_jfXjc5NkBfaNOJaUXmUE4O09fKep`).
- Üretim dağıtımı: `dpl_5pvjPQacnENNnbUWLc991TQzts2X`, `https://ortaksat-ikbwyf6v9-fatih5.vercel.app`.
- Kullanıcı yayın talebinden sonra üretim olarak derlendi ve `https://www.ortaksat.com` alan adına geçirildi. Önceki dağıtım: `dpl_2zC3QA2gbqZnqYsgnKsvdcwRMkZR`.
- Canlı tarayıcı kontrolü geçti: hatalı başlık uyarısı, 71 karakterin kesilmeden reddedilmesi, geçerli ürün başlığı, 320/390/1440 px ve gerçek eski arsa ilanının temiz başlık/sekme gösterimi. Testte ilan yayınlanmadı; Supabase yazma istekleri engellendi.
- Ana sayfa, ilan oluşturma ve gerçek ilan crawler isteği HTTP 200 döndü. Crawler H1/OG/JSON-LD başlığında süsleme yok. Yerel kanıtlar: `audit/mobile-v4/live-title-release-check.json`, `live-http-release-check.json`, `live-title-warning-web.png`, `live-title-clean-listing.png`.
- `.vercelignore` gizli ayar dosyaları ile Android/iOS derleme ve test çıktılarını yükleme dışında tutar. Yayın mevcut çalışma dosyalarından yapıldı; temel Git revizyonu `9e51996`, yeni commit oluşturulmadı.


## 24 October 2026 ? local web recovery and mobile footer

Search now distinguishes initial request failure from an empty result, offers retry, preserves loaded rows/offset after a pagination failure, and ignores pages from a previous query. Favorites retry failed IDs, load all IDs in chunks of at most 300, preserve resolved cards after a later failure, and distinguish unavailable records from an empty list/filter.

Local production export verified with mocked Supabase HTTP/WebSocket traffic: initial failure/retry, pagination retry at offset 40, delayed-query isolation, missing-favorite retry, 301 favorites in 300+1 batches, and 320 px responsive layout. See audit/web-review/recovery-final.log.

Compact footer verified on home, explore, partner, seller, messages, profile, menu and create at 320/390 px: six correct links, one footer, 120?180 px, no footer overflow. See audit/web-review/compact-footer-results.json. Desktop multi-column footer remains available.

Production export and TypeScript checks pass. These additions have not yet been deployed; the production title-policy release above is unchanged.
