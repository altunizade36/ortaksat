# OrtakSat — Konsolide Üretim & Ürün Denetim Raporu

**Üretim biçimi:** Çok-ajanlı denetim (teknik 10 modül + ürün 6 alan + 9 rakip) başlatıldı; oturum/kullanım limiti (15:40 Europe/Istanbul) nedeniyle bazı ajanlar tamamlanamadı. Tamamlananların GERÇEK çıktısı `audit/module-*.json` + workflow journal'larına yazıldı. Eksik kalan çerçeveler (DB/Web/Güvenlik özeti, Ortaklık envanteri) ana-döngü tarafından eldeki gerçek kanıttan (`db-schema-raw.json`, `functional-check.json`, `url-crawl.json`, kod grep) tamamlandı.

**Bu turda kod YAZILMADI** (talimat gereği: denetim/analiz). Dolayısıyla tüm bulgular **düzeltilmedi (backlog)**. Fix'ler ayrı bir onay/tur ister.

**15:40 sonrası üretilecek (limit sıfırlanınca):** rakip analizi (9 platform), profil/arama/UX resmi gap raporları (envanterleri hazır), her iki workflow sentezi (adversarial doğrulama dahil).

---

## BÖLÜM A — TEKNİK ÜRETİM-HAZIRLIK (10 modül)

Tamamlanan 7 modül ajan çıktısı; DB/Web/Güvenlik ana-döngü tarafından mevcut kanıttan.

### A1. Veritabanı (ana-döngü — db-schema-raw.json)
Genel sağlık **iyi**. 47 public tablo, 2 view, 69 FK, 182 indeks, 61 trigger, 107 fonksiyon (67 SECURITY DEFINER), 105 RLS politikası.
- ✅ **0 RLS-kapalı public tablo** (RLS her tabloda açık).
- ✅ FK delete kuralları sağlam: 43 CASCADE (junction), 12 SET NULL, 14 NO ACTION (para/geçmiş korunuyor — komisyon/sipariş hard-delete engelli).
- 🟠 **MEDIUM** — `listings` aşırı indeksli: 23 indeks / 112 satır, 10'u hiç kullanılmamış, mükerrer var → yazma maliyeti. Fix: mükerrer/kullanılmayan indeksleri düşür (canlı sorgu planına göre). *(perf modülüyle örtüşür)*
- ⚪ **INFO** — 104/182 indeks `idx_scan=0`; ama cold-start (düşük trafik), çoğu gerçek trafikte kullanılacak — şimdilik normal.

### A2. API ([module-api.json](audit/module-api.json)) — 3 MEDIUM / 2 LOW / 3 INFO
- 🟠 **MEDIUM** — `referral_clicks`: anon INSERT serbest (CHECK true) + hız-limiti yok → **tıklama sayısı sahteciliği**; ayrıca anon SELECT (USING true) tüm `ref_code`/`partnership_id`'yi açar. `lib/live-service.ts:46`. **Atıf bütünlüğünü (ürün farkı) doğrudan tehdit eder.**
- 🟠 **MEDIUM** — İlan oluşturma hız-limiti **atlanabilir**: guard yalnız `desktop-create-flow` UI'ında; `store createListing` ve **toplu CSV import limitsiz**, sunucuda insert throttle yok. `app/toplu-ilan.tsx:178`.
- 🟠 **MEDIUM** — `approve_location_suggestion` RPC hiç çağrılmıyor; konum önerisi onayı gerçek mahalleyi oluşturmuyor. `lib/live-service.ts:1511`.
- 🟡 **LOW** — Mesaj hız-limiti yalnız istemci-içi (`rateLimitSync`); sunucu `check_rate_limit` mesajlar için çağrılmıyor. `data/app-store.tsx:973`.
- 🟡 **LOW** — Tanımlı ama uygulanmayan hız-limitleri (support_ticket, report, review). `lib/live-service.ts:1179`.
- ⚪ **INFO** — Geniş sessiz hata yutma (okuma yolları hatada `[]`/null → yalnız `console.warn`). `lib/supabase-data.ts:304`.
- ⚪ **INFO** — Girişli her kullanıcı herhangi bir profilin telefonunu okuyabilir (profiles RLS USING true). `lib/supabase-data.ts:213`. *(gizlilik — güvenlikle örtüşür)*

### A3. Web (ana-döngü — functional-check.json + url-crawl.json)
Genel **sağlam**.
- ✅ **3984 kategori/sitemap URL canlı taramada hepsi 200**, 0 kırık.
- ✅ Fonksiyonel: web+mobil **7/7**, 0 parite uyuşmazlığı (sayfa açılış/arama/filtre/create).
- ✅ SEO Sahibinden düzeyinde (Product/Offer/BreadcrumbList crawler'a); robots.txt + sitemap canlı; özel 404.
- ⚪ Lighthouse/CWV tam ölçümü bu ortamda unverifiable; LCP kabaca ölçüldü (küçük veri seti).

### A4. Mobil ([module-mobile.json](audit/module-mobile.json)) — 3 MEDIUM / 1 LOW / 5 INFO
- 🟠 **MEDIUM** — EAS `projectId` placeholder (`replace-after-eas-init`) → **native push tamamen inert, native build/submit imkânsız**. `app.json:130` + `lib/push.ts:18`.
- 🟠 **MEDIUM** — Push tap/response handler yok → bildirime dokununca ilgili ekrana gitmiyor.
- 🟠 **MEDIUM** — Mobil-web üst bar nav ikonları çok küçük dokunma hedefi (20-23px). `components/app-header.tsx`.
- 🟡 **LOW** — Footer/menü linkleri ~19px dokunma hedefi.
- ✅ INFO — Yatay taşma yok (320/360/390 doğrulandı); deep link rotaları mevcut; native API'ler Platform-guard'lı; sunucu push hattı canlı kurulu.
- **SINIR:** Native iOS/Android EAS build **deploy edilmemiş** → gerçek cihaz push/deep-link/crash **unverifiable**.

### A5. Kimlik Doğrulama ([module-auth.json](audit/module-auth.json)) — 2 LOW / 4 INFO(doğrulandı-temiz)
- 🟡 **LOW** — Şifre sıfırlama akışı kayıt şifre-politikasını atlıyor (yalnız uzunluk≥6). `data/app-store.tsx:1243`.
- 🟡 **LOW** — `updatePasswordWithEmail` istemci-tarafı şifre gücü doğrulaması yapmıyor.
- ✅ Doğrulandı-temiz: kullanıcı izolasyonu (resetPrivateState tüm çıkışlarda), rol-bazlı erişim (istemci-gate + RLS + privilege-escalation trigger), canlı /auth 4/4, memory tuzakları kapalı.

### A6. İlan Sistemi ([module-listing.json](audit/module-listing.json)) — 2 MEDIUM / 1 LOW / 2 INFO
- 🟠 **MEDIUM** — Satıcı kendi ilanını `featured` yapabilir (admin-only sanılan alan RLS/grant ile korunmuyor). Canlı doğrulandı (column_privileges).
- 🟠 **MEDIUM** — **Yasaklı içerik moderasyonu yalnız istemcide**; doğrudan API ile yasaklı ilan `active` yayınlanabilir (sunucu INSERT trigger'ı yok).
- 🟡 **LOW** — Mesajda sunucu-taraflı hız limiti yok.
- ⚪ INFO — Video yükleme fiilen desteklenmiyor (seçici sadece görsel + bucket video MIME reddediyor).

### A7. Ödeme ([module-payment.json](audit/module-payment.json)) — 1 MEDIUM / 1 LOW / 1 INFO
- 🟠 **MEDIUM** — Komisyon durum makinesi sunucuda tam zorlanmıyor: **satıcı borçlu komisyonu tek taraflı `cancelled` yapıp borcu silebilir**. Fix: `guard_commission_paid` trigger + RLS "listing owner updates commissions".
- 🟡 **LOW** — İstemci iyimser komisyon tutarı sunucu-otoriter tutardan sapabilir. `lib/format.ts:107`.
- ⚪ INFO — Gerçek ödeme entegrasyonu YOK (ürün modeli, eksiklik değil).

### A8. Güvenlik (ana-döngü — db-schema grants + API/listing bulguları)
- ⚠️ **Yanlış-pozitif önleme:** "47 tabloda anon YAZMA yetkisi" **Supabase varsayılanıdır** — tablo-grant'ları geniş; asıl kapı **RLS**'tir. 0 RLS-kapalı tablo + 105 politika var → ham grant tek başına açık değil.
- 🟠 **MEDIUM** — Gerçek gevşek RLS: `referral_clicks` (anon INSERT CHECK true + anon SELECT USING true → sahte tık + ref_code sızıntısı). *(A2 ile aynı)*
- 🟠 **MEDIUM** — Sunucu-tarafı içerik moderasyonu yok → yasaklı ilan doğrudan API ile yayınlanabilir. *(A6)*
- 🟡 **INFO/LOW** — profiles telefonu girişli her kullanıcıya açık (PII). *(A2)*
- ✅ service_role key istemci bundle'ında **bulunmadı** (tarandı). SQLi: Supabase parametreli/RLS; ham SQL string-concat riski `.or()` string-interpolasyonunda (INFO). XSS: dangerouslySetInnerHTML taraması temiz.
- **SINIR:** En derin güvenlik ajanı (SSRF, IDOR politika-politika taraması, dosya-yükleme policy) limit nedeniyle tamamlanamadı → 15:40 sonrası tamamlanacak.

### A9. Performans ([module-performance.json](audit/module-performance.json)) — 1 MEDIUM / 2 LOW / 1 INFO
- 🟠 **MEDIUM** — `listings` aşırı indeksleme (yukarıda A1). 
- 🟡 **LOW** — Keşfet akışında liste sanallaştırması (windowing) yok → çok ilanla DOM şişer.
- 🟡 **LOW** — Hesap panosu tek açılışta ~10 paralel ağır sorgu (limit 500-1000).
- **SINIR:** Ölçümler küçük canlı veri setinde (112 ilan/16 profil); ölçek/3G unverifiable.

### A10. Kod Kalitesi ([module-codequality.json](audit/module-codequality.json)) — 3 LOW / 2 INFO
- ✅ **TypeScript strict: 0 hata.** console.log/debugger/TODO **yok**.
- 🟡 **LOW** — 20 dead export (lib/components); ESLint yapılandırılmamış (statik lint kapısı yok); landing sayfalarında 30-satır tekrar bloğu.

**Teknik özet:** Tamamlanan modüllerde **CRITICAL yok**; en yüksek **MEDIUM** (8 adet). En etkili tema: **sunucu-tarafı zorlama boşlukları** (moderasyon, komisyon-iptal, rate-limit, self-featured, referral fraud) — hepsi "istemci zorluyor, sunucu zorlamıyor" kalıbı.

---

## BÖLÜM B — ÜRÜN EKSİK ANALİZİ (6 alan)

### B0. Ortaklık Sistemi (DİFERANSİYATÖR) — sağlık: ORTA-İYİ ama ATIF ZAYIF
Koddaki karşılığı büyük ölçüde **VAR** (grep doğrulandı): istek gönderme, kabul (`seller.tsx`), red, iptal/ayrılma (`partner.tsx`), ortak limiti (MP_MAX), komisyon belirleme+güncelleme (`live-service.ts`), ortaklık şartları `partnerRules` (`listing-edit`), referans/ref_code (74 ref), lead/potansiyel (18 ref), ortak istatistikleri (clickCount/shareCount, `partner.tsx`).
**Kritik açık:** 🔴 **Atıf/referans takibi opsiyonel & belirsiz.** Partner paneli + model bir yandan "link/tıklama takibi YOK" derken düz `productUrl` paylaştırılıyor → **satışın hangi ortaktan geldiği doğrulanabilir değil.** Platformun TÜM değer önerisi (doğrulanabilir referansla komisyon) tam burada zayıf. `referral_clicks` sahteciliğe de açık (A2). **Bu #1 ürün riski.**

### B1. İlan Verme Süreci — 15 var / 4 kısmi / 4 yok (7 gap)
- 🟠 **Yüksek** — **Video yükleme hiçbir akışta yok** (create+edit yalnız görsel). Zorluk: Orta.
- 🟠 **Yüksek** — Düzenlemede foto ekleme fiili **5 tavana takılı** (create 15'e izinli) — tutarsızlık. `desktop-create-flow`/edit satır ~457. Zorluk: **Kolay**.
- 🟠 **Yüksek** — Ortaklık atıf takibi opsiyonel/varsayılan (B0). Zorluk: Orta.
- 🟡 **Orta** — İlanı **kopyala/çoğalt** ("benzer ilan ver") yok. Zorluk: Kolay.
- 🟡 **Orta** — Satılan ilan için tek-tık **restock & relist + bump (tazeleme)** yok. Zorluk: Kolay.
- 🟡 **Orta** — Haritada konum seçici (pin/koordinat) yok. Zorluk: Zor.
- ⚪ **Düşük** — Taslak yalnız cihaz-yerel, buluta senkron değil.

### B2. İlan Sayfası — 20 var / 2 kısmi / 4 yok (6 gap)
- 🟠 **Yüksek** — **Ortaklık kuralları (`partnerRules`) ilan sayfasında görünmüyor** (edit'te var, detayda basılmıyor). Zorluk: **Kolay**. *(diferansiyatörü doğrudan görünür kılar)*
- 🟡 **Orta** — **Ortak sayısı (`partnerCount`) ilanda gösterilmiyor** (model'de var, `lib/types.ts:89`). Zorluk: Kolay.
- 🟡 **Orta** — **Görüntülenme sayısı sistemde HİÇ YOK** — sosyal kanıt + "en çok görüntülenen" filtresi + ortak istatistiği hepsi buna bağlı. Zorluk: Orta.
- 🟡 **Orta** — Video oynatıcı yok; konum haritası yok.
- ⚪ **Düşük** — Fiyat geçmişi/düşüş rozeti detayda yok.

### B3. Kullanıcı Profili — 13 var / 5 kısmi / 2 yok
- 🟡 Kısmi: pasif ilanların herkese-açık profilde ayrı bölümü yok; reddedilen ortaklıklar başvurana geri bildirilmiyor; ortaklık **yaşam-döngüsü arşivi** (cancelled/completed) yok; **gerçek doğrulama yok** (telefon SMS/OTP, kimlik belge); takipçi listesi ekranı yok.
- 🟡 Yok: görüntülenme/paylaşım istatistikleri (profil/ilan bazında).

### B4. Arama & Filtreleme — 17 var / 4 kısmi / 2 yok
- 🟡 Kısmi: "en çok ortak alan" ayrı sıralama yok; komisyon **türüne** (sabit/oransal) göre filtre yok; **model'e göre filtre facet'e düşmüyor** (model text tipi); facet/sayısal filtreler yalnız istemci-tarafı (tüm katalog sunucuda süzülmüyor).
- 🔴 Yok: **"Yakınımdaki" (GPS/konum-bazlı) HİÇ YOK**; **"En çok görüntülenen" YOK** (görüntüleme sayacı yok — B2 ile aynı kök).

### B5. UX Yolculuğu — 14 var / 5 kısmi / 4 yok
- 🟠 **Yüksek** — **Kalıcı onboarding kontrol listesi yok** (üye ol→profil→ilk ilan→ilk ortaklık). Zorluk: Orta.
- 🟠 **Yüksek** — **"Arkadaşını davet et / davetle kazan" büyüme akışı yok** (cold-start stratejisiyle doğrudan ilgili). Zorluk: Orta.
- 🟡 **Orta** — Kayıtta **telefon toplanmıyor/doğrulanmıyor** → iletişim tercihi WhatsApp/Telefon seçilse de numara yok, alıcı satıcıya ulaşamayabilir.
- 🟡 **Orta** — Atıf/referans modeli tek yerde net açıklanmıyor; onaylı-mod ortaklık başvurusu sürtünmeli; welcome/rol-rehberi atlanabiliyor; ortak-fırsat listesi cold-start'ta boş kalabiliyor.

---

## EN KRİTİK 10 (birleşik, öncelik sıralı)

| # | Bulgu | Tür | Öncelik | Zorluk |
|---|---|---|---|---|
| 1 | Atıf/referans takibi opsiyonel & doğrulanamaz — diferansiyatörün özü | Ürün/Güvenlik | 🔴 Kritik | Orta |
| 2 | Sunucu-tarafı içerik moderasyonu yok (yasaklı ilan API'den yayınlanır) | Teknik | 🔴 Kritik | Orta |
| 3 | Komisyon tek taraflı iptal edilebilir (borç silinir) | Teknik | 🟠 Yüksek | Orta |
| 4 | referral_clicks sahteciliği + ref_code sızıntısı | Teknik/Güvenlik | 🟠 Yüksek | Kolay |
| 5 | İlan oluşturma rate-limit'i atlanabilir (CSV/store) | Teknik | 🟠 Yüksek | Orta |
| 6 | partnerRules + partnerCount ilan sayfasında gösterilmiyor | Ürün | 🟠 Yüksek | Kolay |
| 7 | Görüntülenme sayacı hiç yok (sosyal kanıt + filtre + istatistik) | Ürün | 🟠 Yüksek | Orta |
| 8 | Video yükleme hiçbir akışta yok | Ürün | 🟠 Yüksek | Orta |
| 9 | Native mobil build yok (EAS placeholder → push inert) | Teknik | 🟠 Yüksek | Orta |
| 10 | "Davet et" büyüme akışı + onboarding kontrol listesi yok | Ürün | 🟠 Yüksek | Orta |

**Quick-win'ler (Kolay + Yüksek etki):** #4, #6, düzenleme foto-limiti tutarsızlığı, ilanı kopyala, restock/bump.

**Düzeltilen:** 0 (bu tur analiz — kod yazılmadı). **Düzeltilmeyen:** hepsi (yukarıdaki backlog).
