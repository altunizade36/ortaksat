# ortaksat Ürün Mantığı

## Roller

- Satıcı: Ürün/ilan açar, fiyatı, stok bilgisini, teslimatı ve komisyon kuralını belirler.
- Ortak satıcı: İlanlara açık, onaylı veya davetli modele göre ortak olur; referans linkini paylaşır.
- Alıcı: Referans linkinden gelir, ürünle ilgilenir, talep oluşturur veya satıcıyla iletişime geçer.
- Admin: Şikayet, sahte ilan, kullanıcı doğrulama, ödeme itirazı ve moderasyonu yönetir.

## Ortak Satış Akışı

1. Satıcı ilan açar.
2. Satıcı ortaklık modunu seçer:
   - Açık: kullanıcı anında ortak olur.
   - Onaylı: kullanıcı başvurur, satıcı kabul/reddeder.
   - Davetli: ileride sadece seçilen ortaklara açılır.
3. Kabul edilen ortak için referans kodu oluşur.
4. Ortak link paylaşır: `https://ortaksat.com/i/urun-slug?ref=REFCODE`
5. Alıcı talebi oluşur.
6. Satıcı talebi arar/mesajlaşır ve satışa çevirir.
7. Komisyon sistemde `pending -> approved -> paid` olarak takip edilir.

## Mobil Ekranlar

- Keşfet: Ürün arama, kategori, popüler/yeni/kazanç sıralaması.
- Ürün detayı: Fotoğraf, fiyat, komisyon, satış argümanları, satıcı güveni, favori, yorum, mesaj, ortaklık başvurusu.
- Ortak paneli: Aktif/bekleyen ortaklıklar, referans linkleri, lead ve komisyon takibi.
- Satıcı paneli: İlan yönetimi, başvuru kabul/red, lead durumları, satışa çevirme, komisyon ödeme.
- Mesajlar: Kullanıcı mesajları ve bildirimler.
- Profil: Güven, performans, kazanç, hesap verileri ve canlıya hazırlık durumu.

## Veri Saklama

Supabase migration dosyası:

`supabase/migrations/0001_ortaksat_core_schema.sql`

Temel tablolar:

- `profiles`
- `listings`
- `listing_images`
- `partnerships`
- `leads`
- `orders`
- `commissions`
- `reviews`
- `favorites`
- `messages`
- `notifications`

## Canlıya Geçiş İçin Dış Bağımlılıklar

- Supabase project URL ve anon/publishable key.
- MVP için e-posta/şifre auth ayarları; telefon OTP sonraki güven fazı.
- Storage bucket: ürün fotoğrafları, profil fotoğrafları.
- App Store / Google Play geliştirici hesapları.
- Gizlilik politikası, KVKK metni, kullanıcı sözleşmesi.
- Ödeme sağlayıcı kararı: ilk canlıda manuel komisyon takibi, sonra iyzico/Stripe/PayTR benzeri ödeme ve payout akışı.
