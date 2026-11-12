# Filtre aralıkları · 30 Ekim 2026

31 Ekim 2026 tarihinde canlıya yayınlandı: https://www.ortaksat.com/partner — `dpl_7UxnrWCKY6VwtNyhDVbfGXtevmC2`.

Web keşfet ekranının fiyat açılır menüsü ve dar ekran filtre paneli artık ham girdiyi korur. Eksi işareti, harf, bilimsel gösterim ve bozuk ayırıcılar sessizce silinmez. Hatalı aralık uygulandığında alanın yanında erişilebilir uyarı gösterilir; URL ve uygulanmış filtre değişmez. Minimumun maksimumdan büyük olması otomatik takas edilmez.

Geçerli Türkçe tutarlar (`1.500`, `1.500,50`) ortak ayrıştırıcıdan geçer. URL standart sayısal ondalık biçimi kullanır; yeniden açılan form virgüllü ondalığı geri gösterir. Boş uç, sıfır sınırı ve iki ucu boş aralık ayrı korunur.

Mobil filtre formunun fiyat ve kategori özellik aralıkları da aynı doğrulamayı kullanır. Yerel sonuç süzmede ondalık sınırlar ve yalnızca boşluk içeren alanlar doğru ele alınır. Sunucu/DB davranışı değiştirilmedi; gerçek cihazda bu yeni akış ayrıca denenmedi.

Kontroller:
- `scripts/check-mobile-filters.mjs`: mevcut 57 kategori şemasındaki 987 alan, filtre sıfırlama/bağlam koruma ve eklenen bozuk sayı/ondalık/açık uç/sıfır/boşluk testleri geçti.
- `scripts/check-filter-numbers-ui.mjs`: Chromium ve WebKit, 1440/390/320 genişliklerde geçersiz girdiyi koruma, hata halinde URL değişmemesi, ters aralığı reddetme, ondalıklı filtre uygulama ve yeniden yükleme geçti. Yerel mock API kullanıldı.
- Önceki ilan sayı testleri, TypeScript, tam ESLint ve Türkçe karakter kontrolü geçti.
- Web dışa aktarımı: `dist-check-mobile/filter-numbers-web`.
- Android dışa aktarımı: `dist-check-mobile/filter-numbers-android`.

Kanıtlar: `audit/web-review/filter-numbers-*.log`.
