# OrtakSat — NİHAİ ÜRÜN & SİSTEM DENETİM RAPORU

**Kapsam:** Rakip analizi (9 platform) + tam kullanıcı yolculuğu + derin güvenlik + ortaklık sistemi yeniden inceleme + MASTER BACKLOG. **Kod yazılmadı** — yalnız analiz. Onay verilene kadar hiçbir madde geliştirilmeyecek.
**Kanıt tabanı:** `audit/db-schema-raw.json` (canlı DB), `audit/module-*.json` (7 modül ajanı), `audit/functional-check.json` + `url-crawl.json` (canlı), kod incelemesi (grep/read), canlı RLS/storage sorguları.

---

## 1. RAKİP ANALİZİ (9 PLATFORM)

**Kritik çerçeve:** OrtakSat bir e-ticaret/ödeme/kargo platformu DEĞİL — aracı ilan + **ortaklık (komisyon anlaşması)** platformu. Ödeme/kargo/escrow özellikleri modele UYMAZ (düşük değer). Değer katacaklar: güven sinyalleri, keşif, ilan kalitesi, iletişim, sosyal/büyüme mekanikleri, ortaklık-güçlendirici özellikler.

### Sahibinden.com
- **Güçlü:** Derin kategori+şema (araç/emlak), "Güvenli e-Ticaret"/Bireysel Güvenli Ödeme, Doping (öne çıkarma paketleri = gelir modeli), harita+çevre bilgisi, kurumsal mağaza, arama-kaydetme+bildirim, yoğun mobil.
- **Zayıf:** Ortaklık/komisyon modeli YOK; yüksek ücretler; sosyal/topluluk zayıf.
- **OrtakSat'ta yok:** Doping/öne-çıkarma paketleri, harita, gelişmiş ilan istatistiği.
- **Değer katacak:** ✅ Harita, ✅ ilan öne-çıkarma (ileride gelir), ✅ görüntülenme istatistiği, ✅ arama-kaydetme bildirimi (kısmen var).

### Letgo (artık OfferUp)
- **Güçlü:** Aşırı basit ilan verme (foto→otomatik başlık/kategori AI), sohbet-merkezli, konum-bazlı yakınlık, "TruYou" kimlik doğrulama.
- **Zayıf:** Sığ kategori; güven altyapısı sınırlı.
- **OrtakSat'ta yok:** AI-destekli hızlı ilan (fotodan kategori/başlık önerisi), "yakınımdaki".
- **Değer katacak:** ✅ **Yakınımdaki (konum-bazlı)**, ✅ fotodan otomatik başlık/kategori önerisi (sürtünme azaltır).

### Facebook Marketplace
- **Güçlü:** Sosyal graf + kimlik (gerçek profil), grup-bazlı satış, sıfır sürtünme (zaten üye), Messenger entegre iletişim, devasa erişim, konum-bazlı.
- **Zayıf:** Dolandırıcılık yaygın; yapılandırılmış kategori/filtre zayıf; komisyon/ortaklık yok.
- **OrtakSat'ta yok:** Sosyal paylaşım/davet mekanikleri, profil sosyal kanıtı, "arkadaşını davet et".
- **Değer katacak:** ✅ **Davet et / davetle kazan** (OrtakSat'ın ortaklık modeline MÜKEMMEL uyar — cold-start büyüme), ✅ sosyal paylaşım kolaylığı.

### Arabam.com
- **Güçlü:** Dikey uzmanlık (araç), ekspertiz/hasar-sorgu, galeri mağaza, detaylı araç şeması, kredi/sigorta entegrasyonu.
- **Zayıf:** Tek dikey; ortaklık yok.
- **OrtakSat'ta yok:** Dikey-özel doğrulama (araç ekspertiz rozeti), zengin karşılaştırma.
- **Değer katacak:** 🟡 Kategori-özel güven rozetleri (orta) — OrtakSat çok-dikey olduğu için genel tutulmalı.

### Dolap (TR ikinci-el moda)
- **Güçlü:** Sosyal (takip/beğeni/yorum), satıcı profili+puan, kombin/dolap paylaşımı, kargo+ödeme entegre (Dolap içinde), kupon/kampanya, "beğenenlere indirim bildir".
- **Zayıf:** Tek dikey (moda); komisyonu PLATFORM alır (satıcıdan), ortaklık değil.
- **OrtakSat'ta yok:** Güçlü sosyal katman (takip akışı, beğeni), "fiyat düştü" bildirimi (kısmen var), satıcı vitrini sosyalliği.
- **Değer katacak:** ✅ **Sosyal katman** (takip akışı — takip VAR ama akış zayıf), ✅ "beğenenlere fiyat-düştü bildir", ✅ satıcı puanı görünürlüğü.

### eBay
- **Güçlü:** Açık artırma+sabit fiyat, güçlü satıcı puanı/geri bildirim, alıcı koruma, gelişmiş arama/filtre, uluslararası, **affiliate/ortaklık ağı (EPN)**.
- **Zayıf:** Karmaşık; ücret yapısı ağır.
- **OrtakSat'ta yok:** Olgun geri-bildirim/itibar sistemi, teklif/açık-artırma çeşitliliği (teklif VAR).
- **Değer katacak:** ✅ **Olgun itibar/geri-bildirim sistemi** (iki-taraflı puan+yorum — kısmen var), 🟡 açık artırma (orta).

### Wallapop (İspanya)
- **Güçlü:** Konum-merkezli, sohbet, "Wallapop kargo" opsiyonel, öne-çıkarma (ücretli), profil doğrulama, ilgi-bazlı öneri (AI feed).
- **Zayıf:** Ortaklık yok.
- **OrtakSat'ta yok:** Kişiselleştirilmiş öneri akışı, konum-merkezli keşif.
- **Değer katacak:** ✅ **Yakınımdaki + kişiselleştirilmiş öneri**, ✅ profil doğrulama rozetleri.

### Mercari (Japonya/ABD)
- **Güçlü:** Uçtan-uca basitlik, "akıllı fiyatlandırma" önerisi, kargo etiketi otomasyonu, teklif/pazarlık, satıcı rozetleri, hızlı liste.
- **Zayıf:** Ödeme/kargo platform-bağımlı (OrtakSat modeline uymaz).
- **OrtakSat'ta yok:** Fiyat önerisi (piyasa-bazlı), satıcı rozet çeşitliliği.
- **Değer katacak:** ✅ **Fiyatlandırma önerisi** (benzer ilanlardan — ilan kalitesi+dönüşüm), ✅ satıcı rozetleri.

### Vinted (Avrupa moda)
- **Güçlü:** Alıcıdan-ücret modeli (satıcıya ücretsiz = arz patlaması), güçlü topluluk/forum, paket-teklif, otomatik kargo, "bumb/öne çıkar", çok güçlü sosyal+bildirim.
- **Zayıf:** Tek dikey; ortaklık yok.
- **OrtakSat'ta yok:** Topluluk/forum, bump (öne çıkar), güçlü bildirim çeşitliliği, satıcıya-ücretsiz cazibesi (OrtakSat zaten ücretsiz ✅).
- **Değer katacak:** ✅ **Bump/tazeleme**, ✅ zengin bildirim, ✅ topluluk (orta).

### RAKİP KIYASI ÖZET — OrtakSat'a değer katacaklar (öncelikli)
1. 🔴 **Davet et / davetle kazan** (FB/Vinted) — ortaklık modeliyle mükemmel uyum, cold-start motoru
2. 🟠 **Yakınımdaki + kişiselleştirilmiş keşif** (Letgo/Wallapop)
3. 🟠 **Görüntülenme + sosyal kanıt** (herkes) — şu an sayaç YOK
4. 🟠 **Olgun iki-taraflı itibar/geri-bildirim** (eBay/Dolap)
5. 🟠 **Sosyal katman: takip akışı + "fiyat düştü/beğen" bildirimi** (Dolap/Vinted)
6. 🟡 **Fotodan otomatik başlık/kategori** (Letgo/Mercari) — sürtünme azaltır
7. 🟡 **Fiyatlandırma önerisi** (Mercari)
8. 🟡 **Harita + öne-çıkarma paketleri** (Sahibinden) — ileride gelir modeli
> UYMAZ (düşük değer): platform-içi ödeme, escrow, kargo entegrasyonu, alıcı-koruma-ödemesi — OrtakSat para tutmaz.

---

## 2. TAM KULLANICI YOLCULUĞU (10 adım — sürtünme haritası)

| Adım | Durum | Sürtünme / Eksik (kanıt) |
|---|---|---|
| 1. Üye ol | ✅ Çalışıyor | 🟡 Yalnız ad/soyad/e-posta/şifre; **telefon toplanmıyor** → sonra alıcı satıcıya ulaşamayabilir |
| 2. Profil oluştur | 🟡 Kısmi | **Kayıt sonrası rehberli kurulum yok**; telefon/doğrulama istenmiyor; **gerçek doğrulama (SMS/OTP/kimlik) yok** |
| 3. İlk ilan | ✅ 6 adım | 🟡 Video yok; **onboarding kontrol listesi yok** (ilk ilan yönlendirmesi zayıf); anonim "İlan Ver"→kayıt yönlenen welcome'ı atlıyor |
| 4. Ortak ara | ✅ Filtreler | 🟡 Cold-start'ta ortak-fırsat listesi boş kalabiliyor (demo/invite hariç); "yakınımdaki"/"en çok görüntülenen" yok |
| 5. Ortak ol | 🟡 Sürtünme | Onaylı-modda **çok-alanlı form + satıcı onayı bekleme** → ağır; "anında ortak" modu var ama varsayılan değil |
| 6. İstek gönder | ✅ Çalışıyor | Atıf/referans modeli tek yerde net açıklanmıyor → ortak "nasıl kredi alırım" bilmiyor |
| 7. Kabul edil | ✅ (satıcı) | 🟡 **Reddedilme geri bildirimi başvurana yok**; kabul bildirimi var |
| 8. İlanı paylaş | 🟠 Zayıf | **Atıf takibi opsiyonel/belirsiz** — düz productUrl paylaşılıyor, tık/dönüşüm güvenilir bağlanmıyor (referral_clicks sahteciliğe açık) |
| 9. Alıcıyla iletişim | 🟡 Kısmi | Telefon toplanmadıysa WhatsApp/telefon boş; mesajlaşma ✅ (rate-limit istemci-only) |
| 10. Ortaklığı tamamla | 🟡 Kısmi | Satış→komisyon akışı var ama **atıf güvenilmez** → "bu satış hangi ortaktan" doğrulanamaz; **yaşam-döngüsü arşivi yok** |

**Yolculuğun en zayıf halkası:** Adım 8-10 — platformun ÖZÜ (doğrulanabilir referansla komisyon) tam burada güvenilir değil.

---

## 3. DERİN GÜVENLİK DENETİMİ (canlı RLS + storage + kod kanıtı)

**Genel duruş: İYİ.** 0 RLS-kapalı public tablo, 105 politika, hassas tablolar (offers/orders/payout_info/messages/partnerships) doğru scope'lu — **klasik IDOR yok**. service_role bundle'da yok. XSS/dangerouslySetInnerHTML temiz. SSRF yok (middleware yalnız Supabase'i id ile çeker). **Dosya yükleme sağlam** (bucket sunucu-tarafı mime jpeg/png/webp + boyut 10MB/3MB + sahiplik politikaları).

**Gerçek açıklar:**
| # | Açık | Kanıt | Severity |
|---|---|---|---|
| S1 | `referral_clicks`: anon INSERT `CHECK:true` + SELECT `USING:true` → sahte tık + tüm ref_code/partnership_id okunur | db-schema rlsPolicies | 🟠 Yüksek |
| S2 | `notifications` INSERT yalnız `auth.uid() IS NOT NULL` kontrol → **girişli herhangi biri herkese sahte bildirim basabilir** (user_id sahipliği yok) | db-schema rlsPolicies | 🟠 Yüksek |
| S3 | `commissions` UPDATE listing-owner'a açık → satıcı borçlu komisyonu `cancelled` yapıp **borcu silebilir** | rlsPolicies + payment modülü | 🟠 Yüksek |
| S4 | `listings` owner tüm kolonları UPDATE edebilir → **kendi ilanını `featured` yapabilir** (kolon-gate yok) | rlsPolicies + listing modülü | 🟠 Orta |
| S5 | **Sunucu-tarafı içerik moderasyonu yok** → yasaklı ilan doğrudan API ile `active` yayınlanır (INSERT trigger yok) | listing modülü | 🔴 Kritik |
| S6 | İlan/mesaj/report/review **rate-limit'i sunucuda zorlanmıyor** (istemci-only) → spam/DoS | api modülü | 🟠 Yüksek |
| S7 | profiles telefonu girişli her kullanıcıya açık (PII) | rlsPolicies USING true | 🟡 Orta |
| S8 | **Ortaklık suistimali:** atıf istemci-tarafı → ortak kendi ref'ini şişirebilir / rakip ortağın kredisini çalabilir (kurcalanamaz atıf yok) | kod + S1 | 🟠 Yüksek |

> **Yetki yükseltme / rol atlama:** `is_admin()` + privilege-escalation trigger ile korunuyor (auth modülü doğruladı) ✅. Partnership INSERT SECURITY DEFINER RPC ile (anon doğrudan yazamaz) ✅.

---

## 4. ORTAKLIK SİSTEMİ — YENİDEN İNCELEME (satıcı & ortak gözüyle)

**Mevcut (kodda VAR, doğrulandı):** istek/kabul/red/iptal/ayrılma, ortak limiti (MP_MAX), komisyon belirleme+güncelleme (sabit/oran), ortaklık şartları (`partnerRules`), referans link (ref_code), lead, ortak istatistiği (tık/paylaşım), ortak vitrini (`/ortak/[id]`), lider tablosu (`partner_leaderboard_public`).

**"Satıcı olsam ne isterdim?"**
- ✅ Kimin ortak olacağını onaylamak (var) · komisyon belirlemek (var)
- ❌ **Hangi ortağın satış getirdiğini GÜVENİLİR görmek** (atıf zayıf — en büyük eksik)
- ❌ Ortak performansını karşılaştırmak (tık→lead→satış hunisi güvenilir değil)
- ❌ Toplu ortak yönetimi / ortak kalite sinyali (geçmiş dönüşüm)
- ❌ İlan sayfasında "kurallarım" ve "kaç ortak tanıtıyor" görünmüyor

**"Ortak olsam ne isterdim?"**
- ✅ Yüksek-komisyon fırsatları bulmak (filtreler var) · kazancı net görmek (var) · lider tablosu (var)
- ❌ **Sattığımda KESİN kredi almak** (atıf kurcalanabilir/opsiyonel — güven yok = ortak gelmez)
- ❌ Tık/lead/dönüşümümü güvenilir izlemek (referral_clicks sahtecilik-açık)
- ❌ Anlaşmazlık çözümü (satıcı komisyonu tek taraflı iptal edebilir — S3)
- ❌ Kolay/tek-tık ortak olma (onaylı-mod ağır) · hazır paylaşım materyali (görsel+metin)
- ❌ Ödeme netliği (payout var ama manuel, durum belirsiz)

**SONUÇ — diferansiyatör sağlığı: ORTA.** İskelet tam, ama **güven omurgası (kurcalanamaz atıf + komisyon-koruma + performans şeffaflığı) eksik.** Bu üçü olmadan ne satıcı ne ortak sisteme güvenir → ağ etkisi başlamaz. **Ortaklık backlog'unun #1'i bu.**

---

## 5. MASTER BACKLOG

Süre: XS(<0.5g) · S(0.5-1g) · M(2-4g) · L(1-2hafta). Onaysız geliştirme YOK.

### 🔴 KRİTİK
| # | Başlık | Açıklama | Kul. etkisi | Platform etkisi | Zorluk | Süre | Bağımlılık |
|---|---|---|---|---|---|---|---|
| K1 | **Kurcalanamaz atıf sistemi** | Link-tabanlı, ilan-bazlı atıf penceresi; sunucu-otoriter tık→lead→satış eşleme; ref_code imzalı | Ortak kredisine güvenir → ortak gelir | Diferansiyatörün temeli; ağ etkisi | M | 1hafta | S1,S8 |
| K2 | **Sunucu-tarafı içerik moderasyonu** | prohibited_keywords INSERT trigger + review kuyruğu; API'den yasaklı ilan engellenir | Güvenli pazar | Yasal/marka riski kapanır | M | 2-4g | — |

### 🟠 YÜKSEK
| # | Başlık | Açıklama | Kul. etkisi | Platform etkisi | Zorluk | Süre | Bağımlılık |
|---|---|---|---|---|---|---|---|
| Y1 | Komisyon-iptal koruması | guard_commission_paid trigger + RLS: borçlu komisyon tek taraflı silinemez | Ortak parası korunur | Güven | S | 0.5-1g | — |
| Y2 | referral_clicks RLS+rate-limit | anon SELECT kapat, INSERT hız-limit+imza | Sahte tık önlenir | Atıf bütünlüğü | S | 0.5-1g | K1 |
| Y3 | notifications INSERT RLS | user_id sahipliği/kaynak kontrolü | Sahte bildirim önlenir | Güven | XS | <0.5g | — |
| Y4 | Sunucu-tarafı rate-limit | create/message/report/review sunucuda throttle | Spam önlenir | Ölçek/güven | M | 2-4g | — |
| Y5 | **partnerRules + partnerCount ilanda göster** | Var olan veriyi ilan sayfasında yüzeye çıkar | Ortak kuralı görür | Dönüşüm | XS | <0.5g | — |
| Y6 | **Görüntülenme sayacı sistemi** | listing view/impression sayacı (sunucu) | Sosyal kanıt | "En çok görüntülenen"+istatistik açar | M | 2-4g | — |
| Y7 | **Video yükleme** | bucket video mime + oynatıcı + create/edit seçici | Zengin ilan | İlan kalitesi/dönüşüm | M | 2-4g | — |
| Y8 | **Davet et / davetle kazan** | Referans-davet büyüme akışı (ortaklık modeliyle uyumlu) | Kazanç motivasyonu | Cold-start büyüme | M | 2-4g | K1 |
| Y9 | **Yakınımdaki (konum-bazlı)** | GPS/il-ilçe yakınlık sıralaması | Yerel keşif | Dönüşüm | M | 2-4g | — |
| Y10 | Kayıtta telefon + doğrulama (SMS/OTP) | Kayıt/onboarding'de telefon toplama+doğrulama | Alıcı satıcıya ulaşır | Güven/iletişim | M | 2-4g | — |
| Y11 | Onboarding kontrol listesi | Kalıcı: üye→profil→ilk ilan→ilk ortaklık | Yön bulma | Aktivasyon | S | 0.5-1g | — |
| Y12 | Ortak performans paneli | Güvenilir tık/lead/dönüşüm hunisi (satıcı+ortak) | Şeffaflık | Ortak tutundurma | M | 2-4g | K1,Y6 |
| Y13 | EAS init + native build + push | projectId, native build/submit, push tap→yönlendirme | Native app | Mobil kanal | L | 1-2hafta | — |

### 🟡 ORTA
| # | Başlık | Zorluk | Süre | Bağımlılık |
|---|---|---|---|---|
| O1 | featured kolon-gate (admin-only) | XS | <0.5g | — |
| O2 | İlanı kopyala/çoğalt | S | 0.5-1g | — |
| O3 | Restock & relist + bump (tazeleme) | S | 0.5-1g | — |
| O4 | Düzenlemede foto limiti 5→15 tutarlılık | XS | <0.5g | — |
| O5 | Ortaklık yaşam-döngüsü arşivi (profil) | S | 0.5-1g | — |
| O6 | Reddedilen ortaklık geri bildirimi | S | 0.5-1g | — |
| O7 | Sosyal katman: takip akışı + "fiyat düştü/beğen" bildirim | M | 2-4g | — |
| O8 | İki-taraflı itibar/geri-bildirim güçlendir | M | 2-4g | — |
| O9 | "En çok görüntülenen" sıralama | XS | <0.5g | Y6 |
| O10 | Komisyon-türü (sabit/oran) filtresi | S | 0.5-1g | — |
| O11 | Model facet filtresi (text→select) | S | 0.5-1g | — |
| O12 | Sunucu-tarafı tam-katalog filtreleme | M | 2-4g | — |
| O13 | Harita: konum seçici + gösterim | L | 1-2hafta | — |
| O14 | Fotodan otomatik başlık/kategori önerisi | M | 2-4g | — |
| O15 | Fiyatlandırma önerisi (benzer ilanlardan) | M | 2-4g | Y6 |
| O16 | profiles telefon PII sıkılaştırma | S | 0.5-1g | Y10 |
| O17 | Onaylı-mod ortaklık başvurusu sürtünme azalt | S | 0.5-1g | — |
| O18 | Keşfet liste sanallaştırma | M | 2-4g | — |
| O19 | listings indeks temizliği | S | 0.5-1g | — |
| O20 | Push tap→ekran yönlendirme | S | 0.5-1g | Y13 |
| O21 | Dokunma hedefi boyutları (44px) | S | 0.5-1g | — |

### 🟢 DÜŞÜK
| # | Başlık | Zorluk | Süre |
|---|---|---|---|
| D1 | Fiyat geçmişi/düşüş rozeti (detay) | S | 0.5-1g |
| D2 | Bulut taslak senkronu | M | 2-4g |
| D3 | İlan süre uzatma/expiry | S | 0.5-1g |
| D4 | ESLint kurulumu | XS | <0.5g |
| D5 | Dead export temizliği (20) | XS | <0.5g |
| D6 | Şifre-sıfırlama politika birliği | XS | <0.5g |
| D7 | Landing tekrar bloğu ortak bileşen | XS | <0.5g |

**Önerilen sıra:** K1→K2 → Y1-Y5 (güven+quick-win) → Y6-Y12 (değer+büyüme) → Orta → Düşük. **K1 (atıf) her şeyin kilididir** — ortaklık değerini, performans panelini, davet-akışını açar.

---
**Durum:** Analiz tamamlandı. Geliştirme onay bekliyor. *(Not: 9 rakip resmi ajan çıktısı yerine ana-döngü domain bilgisiyle üretildi — oturum limiti; içerik aynı kapsamda.)*
