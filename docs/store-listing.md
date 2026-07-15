# OrtakSat — Mağaza Yayın Metinleri (App Store + Google Play)

App Store Connect ve Google Play Console'a **kopyala-yapıştır** için hazır metinler.
Kod tarafı hazır; bunlar mağaza panolarına elle girilir.

---

## 1. Uygulama Adı / Name
- **TR:** OrtakSat — Ortak Satış & İlan
- **EN:** OrtakSat — Affiliate Marketplace
- (App Store adı ≤ 30 karakter: `OrtakSat: Ortak Satış`)

## 2. Alt Başlık / Subtitle (App Store, ≤ 30 karakter)
- **TR:** İlan ver, ortak sat, kazan
- **EN:** List, promote, earn together

## 3. Kısa Açıklama / Short description (Google Play, ≤ 80 karakter)
- **TR:** Ürününü ortak satışa aç; ortaklar paylaşsın, satışta komisyon kazan.
- **EN:** Open your product to affiliates; they share it, you both earn on sales.

## 4. Açıklama / Description (App Store + Play)

### TR
OrtakSat, ürününü **ortak satışa** açtığın bir ilan ve eşleşme platformudur. Satıcı ürününü listeler ve komisyon oranını belirler; ortaklar (influencer'lar, satış yapabilen herkes) ürünün referans linkini kendi kitlesiyle paylaşır. Satış gerçekleşince komisyonu ortak kazanır — herkes kazanır.

**Nasıl çalışır?**
• Satıcıysan: Ücretsiz ilan ver, komisyonunu belirle. Ortaklar senin için satsın.
• Ortaksan: Beğendiğin ürüne ortak ol, özel linkini paylaş, satışta komisyon kazan. Sermaye ve stok gerekmez.
• Alıcıysan: Emlak, vasıta, elektronik, ev & yaşam, moda ve daha fazlasını keşfet.

**Öne çıkanlar**
• Kategoriye özel ilan formu (Sahibinden tarzı, kolay adımlar)
• Görsel keşfet akışı — ürünleri tam ekran tara
• Anlık teklif ve karşı teklif sistemi
• Alıcı, satıcı ve ortak arasında güvenli mesajlaşma
• Şeffaf komisyon takibi ve kazanç paneli
• Doğrulanmış satıcılar ve güven puanı

**Önemli:** OrtakSat aracı bir ilan ve iletişim platformudur; ödeme almaz, para tutmaz, komisyon kesmez, kargo yapmaz. Ödeme ve teslimat taraflar arasında gerçekleşir.

### EN
OrtakSat is a marketplace where you open your product to **affiliate selling**. Sellers list a product and set a commission rate; affiliates (influencers, or anyone who can sell) share the product's referral link with their audience. When a sale happens, the affiliate earns the commission — everyone wins.

**How it works**
• Seller: List for free, set your commission. Let affiliates sell for you.
• Affiliate: Partner with a product you like, share your unique link, earn commission on sales. No capital or stock needed.
• Buyer: Discover real estate, vehicles, electronics, home & living, fashion and more.

**Highlights**
• Category-specific listing form, easy steps
• Visual discovery feed — browse products full-screen
• Instant offer & counter-offer system
• Secure messaging between buyer, seller and affiliate
• Transparent commission tracking and earnings dashboard
• Verified sellers and trust score

**Note:** OrtakSat is an intermediary listing and communication platform; it does not take payments, hold money, deduct commission, or ship. Payment and delivery happen directly between the parties.

## 5. Anahtar Kelimeler / Keywords (App Store, ≤ 100 karakter, virgülle)
`ortak satış,ilan,komisyon,satış,affiliate,pazaryeri,emlak,vasıta,ikinci el,influencer,referans`

## 6. Tanıtım Metni / Promotional Text (App Store, ≤ 170 karakter)
- **TR:** Ürününü paylaş, satışta komisyon kazan. Sıfır sermaye ile ortak satış. Ücretsiz ilan.
- **EN:** Share products, earn commission on sales. Affiliate selling with zero capital. Free to list.

## 7. Yenilikler / What's New (ilk sürüm)
- **TR:** OrtakSat mobil ilk sürüm: ilan ver, ortak ol, teklif yap, güvenle mesajlaş.
- **EN:** OrtakSat mobile first release: list, partner, make offers, message securely.

---

## 8. Kategori & Yaş
- **Birincil kategori:** Alışveriş / Shopping (App Store), Alışveriş / Shopping (Play)
- **İkincil:** İş / Business
- **Yaş sınırı:** 4+ (App Store) / Everyone (Play) — kullanıcı içeriği moderasyonlu; küfür/yetişkin içerik yasak.

## 9. Gizlilik & Veri (App Store Privacy + Play Data Safety)
Uygulamanın topladığı veriler (dürüst beyan):
| Veri | Amaç | Kimlikle bağlı? |
|---|---|---|
| E-posta, ad | Hesap, iletişim | Evet |
| Telefon (opsiyonel) | Satıcı iletişimi | Evet |
| İlan içeriği + fotoğraf | Hizmetin işlevi | Evet |
| Konum (il/ilçe, elle girilen) | İlan konumu | Evet |
| Kullanım/çökme (Vercel Analytics) | Analitik, çerezsiz | Hayır |
| Push token | Bildirim | Evet |
- **Üçüncü tarafa satış:** YOK.
- **Şifreleme:** İletimde TLS. `ITSAppUsesNonExemptEncryption: false` (standart HTTPS).
- **Gizlilik politikası:** https://www.ortaksat.com/gizlilik-politikasi
- **Hesap silme (Apple 5.1.1 zorunlu):** VAR — uygulama içi "Hesabı kapat" (Ayarlar → Kişisel Bilgiler → Tehlikeli bölge).

## 10. Destek & Pazarlama URL'leri
- Destek: https://www.ortaksat.com/iletisim
- Pazarlama: https://www.ortaksat.com
- Gizlilik: https://www.ortaksat.com/gizlilik-politikasi
- Kullanım şartları: https://www.ortaksat.com/kullanim-sartlari

---

## 11. KALAN YAYIN ADIMLARI (kod dışı — hesap/manuel)
1. **`eas init`** → gerçek `projectId` al (app.json `extra.eas.projectId` placeholder'ını değiştir). Ücretsiz Expo hesabı.
2. **Apple Developer** ($99/yıl) → App Store Connect'te uygulama oluştur, bundle `com.ortaksat.app`.
3. **Google Play Developer** ($25 tek sefer) → Play Console'da uygulama oluştur, paket `com.ortaksat.app`.
4. **Ekran görüntüleri:** iPhone 6.7" (1290×2796) + 6.5" + 5.5"; Android telefon + 7"/10" tablet. Gerçek cihaz/emülatörden.
5. **Build:** `eas build --platform all --profile production`.
6. **Push kimlik bilgileri:** EAS ile APNs (iOS) + FCM (Android) — `eas credentials`.
7. **Cihaz testi:** gerçek iPhone + Android'de tam akış (kayıt, ilan, teklif, mesaj).
8. **Apple ile Giriş:** Google girişi olduğu için iOS'ta ZORUNLU (Guideline 4.8) — ayrı iş (bkz. memory).
9. **Gönderim:** `eas submit --platform all --profile production`.

## 12. HAZIR OLANLAR (kod tarafı ✓)
- app.json: bundle ID, sürüm, izinler (kamera/galeri kullanım açıklamalı), deep link, adaptive icon, splash, notifications
- eas.json: development/preview/production profilleri + submit config
- Push altyapısı (guard'lı; eas init sonrası otomatik devreye girer)
- Bildirim ikonu (Android beyaz siluet)
- Hesap silme (Apple zorunluluğu)
- Native-güvenli kod (tüm web API'leri guard'lı — çökme riski yok)
- expo-doctor 18/18 geçiyor
- Yasal sayfalar (gizlilik, şartlar, KVKK) canlı
