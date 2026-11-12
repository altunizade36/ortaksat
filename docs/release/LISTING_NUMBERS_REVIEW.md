# İlan sayısal giriş kontrolleri · 30 Ekim 2026

31 Ekim 2026 tarihinde canlıya yayınlandı: https://www.ortaksat.com/partner — `dpl_7UxnrWCKY6VwtNyhDVbfGXtevmC2`.

- İlan oluşturma ve düzenlemede fiyat/sabit komisyon için ortak, katı Türkçe sayı ayrıştırma eklendi.
- Eksi işareti, harf, bilimsel gösterim ve bozuk binlik/ondalık ayırıcılar sessizce değiştirilmez; açıklayıcı hata gösterilir.
- Geçerli örnekler: `1500`, `1.500`, `1.500,50`. Ondalık düzenleme değerleri virgülle açılır, tutar değişmez.
- Yüzdelik komisyonda nokta veya virgül ile en fazla iki ondalık desteklenir; mevcut üst sınır %90 korunur.
- Ortak sayısında pozitif, güvenli tam sayı kontrolü web/mobil oluşturma ve mobil düzenlemede ortaklaştırıldı. Web düzenlemede stok tam sayı kontrolü eklendi.
- Genel `parseTrPrice` değiştirilmedi; eski filtreler ve diğer alanlar bu kapsamda değildir. Sunucu/DB kuralları değiştirilmedi.
- Fotoğraf sınırı ve video davranışı değiştirilmedi.

Doğrulama:
- `node scripts/check-listing-numbers.mjs`: geçerli/geçersiz tutar, yüzde, ortak sayısı, ondalıklı düzenleme döngüsü ve merkezi ilan kontrolü geçti.
- `scripts/check-listing-numbers-ui.mjs`: yerel mock API ile 320/390/1440 genişlikte hatalı fiyatların yayından önce durması, form değerinin korunması, geçerli ondalıklı taslağın girişe devri; gerçek ilan yayınlanmaz.
- TypeScript, tam ESLint, Türkçe karakter kontrolü, 7467 kategori yolu, 81 il/973 ilçe ilişkisi geçti.
- Web dışa aktarımı: `dist-check-mobile/listing-numbers-web`.
- Android dışa aktarımı ayrıca doğrulandı; gerçek cihazda bu sayısal akış henüz test edilmedi.
