# OrtakSat — Büyüme & Seed Operasyon Playbook'u (F0–F2)

> Amaç: Platformu teknik olarak değil, **arz/talep/trafik** tarafından hareket ettirmek.
> Kanıt metriği: **30 ilan → 50 ortak → 10 satış → 1. ödenen komisyon** = sistem çalışıyor.
> Niş: **butik kadın moda + takı/aksesuar** (TR'de hazır reseller/mümessil kültürü, ikna maliyeti ~0).
> Kural: **sahte veri YOK.** Bu doküman şablon + script verir; sen gerçek ürünlerle doldurursun.

---

## FAZ 0 — İlk 30 gerçek ilan (Hafta 1)

**Hedef:** Katalog "boş" görünmesin; ortakların paylaşacağı, alıcıların arayacağı gerçek ürün olsun.

**Nereden:** Tanıdığın 3–5 küçük satıcı (Instagram butik, el emeği takı, evden satış yapan).
Onlar adına ücretsiz ilan gir (concierge onboarding) — karşılığında hiçbir şey isteme, sadece
"ürünlerini ücretsiz listeleyelim, ortaklar senin için paylaşsın" de.

**Nasıl hızlı:** Çoklu ekleme var — `/toplu-ilan` (CSV: `baslik, fiyat, kategori, il, ilce, stok, komisyon`).
Tek tek için `/create` (anonim de doldurulabilir; yayında ücretsiz kayıt).

**Kategori dağılımı (30 ilan öneri):**
- Kadın Giyim: 12 (Elbise, Bluz, Etek, Ceket, Takım, Abiye)
- Takı & Mücevher: 8 (Kolye, Küpe, Yüzük, Bilezik, Gümüş)
- Çanta: 5 (El Çantası, Sırt Çantası, Cüzdan)
- Ayakkabı: 5 (Kadın Ayakkabı, Bot & Çizme, Sandalet)

**Komisyon önerisi (satıcıya):** %10–20 arası. Butik moda için **%15 tatlı nokta** — ortak motive
olur, satıcı kârdan verir. Takıda marj yüksek → %20 önerilebilir. İlk 5 satışa **+bonus** koy
(ör. satış başına +25 ₺) → ortaklar "önce buraya" der.

---

## İlan şablonları (kopyala, gerçek ürünle doldur)

### Şablon A — Kadın Giyim (Elbise/Bluz/…)
```
Başlık: [Marka/Model yoksa boş bırak] — ör. "Saten Midi Abiye Elbise - Bordo"
Fiyat: [₺]
Kategori: Moda > Kadın Giyim > [Elbise/Bluz/Etek…]
İl/İlçe: [zorunlu]
Stok: [adet]
Komisyon: %15
Açıklama (2–3 satır, ARZU uyandır):
  • Kumaş/kalıp: [ör. yüksek kaliteli saten, rahat kesim]
  • Beden aralığı: [S–XL / 36–44]
  • Öne çıkan: [ör. düğün/nişan için, terletmez, ütü istemez]
Fotoğraf: 3+ (giyili + detay + arka). İlk foto = vitrin, net ışık.
```

### Şablon B — Takı & Mücevher (Kolye/Küpe/…)
```
Başlık: ör. "925 Ayar Gümüş Kalp Kolye - Rose"
Fiyat: [₺]
Kategori: Moda > Takı & Mücevher > [Kolye/Küpe/Yüzük/Bilezik]
Komisyon: %20  (marj yüksek → ortağa cömert ol)
Açıklama:
  • Malzeme/ayar: [925 gümüş / çelik / altın kaplama]
  • Alerjik değil / kararmaz [uygunsa]
  • Hediye kutulu [uygunsa — dönüşüm artırır]
Fotoğraf: 3+ (takılı/model + yakın çekim + kutu).
```

### Şablon C — Çanta / Ayakkabı
```
Başlık: ör. "Hakiki Deri Omuz Çantası - Taba"
Kategori: Moda > Çanta > [El Çantası/Sırt/Cüzdan]  (veya Ayakkabı > …)
Komisyon: %15
Açıklama: malzeme + boyut + kullanım (günlük/ofis/gece) + renk seçenekleri.
Fotoğraf: 3+ (ürün + iç göz + kullanımda).
```

**Kalite kuralı:** Her ilan ≥3 foto + ≥2 satır açıklama + doğru kategori + il/ilçe.
Zayıf ilan = ortak paylaşmaz. Landing artık galeri + açıklama gösteriyor → içerik önemli.

---

## FAZ 1 — İlk 50 aktif ortak (Hafta 2–4)

**Ortak = ücretsiz dağıtım ordusu. Büyüme motoru budur.**
Hedef kitle: evden ek gelir arayan, IG'de takipçisi olan, WhatsApp grupları aktif kişiler.

**Nereden bul:**
1. Facebook grupları: "Evden ek gelir", "Komisyonla satış", "Reseller / mümessil", "Kadın girişimci"
2. Instagram: butik/moda mikro-influencer (1K–20K takipçi) DM
3. Telegram/WhatsApp: satış-komisyon grupları
4. Üniversite öğrenci grupları (esnek zaman + sosyal ağ)

### DM Script — ORTAK daveti (IG/WhatsApp)
```
Merhaba 👋 Ek gelir için ürün satışına ilgin var mı?

OrtakSat diye bir platform var: ürünleri paylaşıyorsun, senin linkinle
satış olursa komisyon kazanıyorsun. Stok tutmak, para yatırmak YOK —
sadece paylaşıyorsun. Butik moda & takıda %15–20 komisyon.

Ücretsiz. İstersen 2 dakikada başlangıç linkini atayım.
```
Follow-up (yanıt gelirse):
```
Süper! Şu adımlar:
1) ortaksat.com/partner → ilgini çeken ürüne "Ortak ol"
2) Sana özel link çıkıyor → Instagram bio'na / WhatsApp durumuna koy
3) Satış olunca komisyonun otomatik takip ediliyor, satıcı ödüyor.
İlk satışında ben de yanındayım, takıldığın yeri sor.
```

### DM Script — SATICI daveti
```
Merhaba, ürünlerinizi ekstra maliyet olmadan daha çok kişiye ulaştırmak
ister misiniz?

OrtakSat'ta ilanınızı ücretsiz açıyoruz; "ortaklar" (satış yapan kişiler)
sizin için paylaşıyor, YALNIZCA satış olursa belirlediğiniz komisyonu
ödüyorsunuz. Peşin ücret yok, para platformda durmuyor — tahsilat sizde.

Dilerseniz ilk 5 ürününüzü ben gireyim, siz sadece onaylayın.
```

**Ölçüm:** Paylaşım linkleri artık kanal etiketli (`&c=whatsapp/instagram/tiktok`).
`referral_clicks.channel` ile hangi kanalın tıklama/dönüşüm getirdiğini gör → oraya yüklen.

---

## FAZ 2 — İlk 10 satış (Ay 2+) — concierge

İlk satışları **elle mühendisle**. Amaç: "1. ödenen komisyon" kanıtı + sosyal kanıt.

**Satış akışı (sistem hazır, sen kolaylaştır):**
1. Ortak paylaşır → alıcı `/i/[slug]` landing → "Ürünü İncele" / talep bırakır.
2. Satıcı satışı `/(tabs)/seller` → "Satış ekle" ile kaydeder.
3. **KRİTİK:** Kayıt anında çıkan **"Onay linkini gönder"** ile alıcıya WhatsApp'tan yolla.
4. Alıcı `/onay/[token]` → "Aldığımı onaylıyorum" → komisyon doğrulanır.
5. Satıcı komisyonu öder (dışarıda) → "Ödedim" işaretler → ortak "Aldım" onaylar.

**Sosyal kanıt üret:** İlk ödenen komisyondan sonra (izinle) → "X ortağı ilk ayında Y ₺ kazandı"
paylaşımı. Bu, F1'deki ortak DM'lerine eklenince ikna maliyetini düşürür.

**Ortak→ortak zinciri:** Memnun ortağa "bir arkadaşını davet et" de — vitrin linki (`/ortak/[id]`)
paylaşılabilir; landing'de "sen de paylaş/sat" viral kancası var.

---

## Kaçınılacaklar (şimdilik)
- Otomobil / emlak / beyaz eşya nişleri → yavaş, düşük tekrar, yüksek güven eşiği.
- Yatay büyüme (her kategori aynı anda) → odak dağılır, katalog seyrek görünür.
- Ücretli reklam (henüz) → önce organik + ortak ordusu; dönüşüm kanalını `channel` verisiyle öğren.

## Haftalık ritim
- **Hafta 1:** 30 ilan (5 satıcı × 6 ürün).
- **Hafta 2–4:** günde 5–10 ortak DM'i → 50 aktif ortak.
- **Ay 2:** 10 satışı concierge ile kapat → 1. komisyon → sosyal kanıt → ölçekle.

_Bu playbook operasyoneldir; kod tarafı hazır. Detay: memory `growth-strategy`._
