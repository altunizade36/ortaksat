# Favoriler: mobil toparlanma ve web tutarlılığı — 27 Ekim 2026

Yerel çalışma; canlıya yayınlanmadı.

## Düzeltmeler

- Mobil favori araması kapanırken sorgu temizlenir; görünmeyen arama filtresi kalmaz. Sonuç bulunmayan filtreli görünümde arama ve filtreleri temizleme vardır. Gerçek boş favori durumu ayrı metin kullanır.
- Mobil yenilemede yüklenmiş ek ilanlar hemen silinmez. Geçici yükleme hatasında mevcut kartlar korunur, hata ve yeniden deneme gösterilir. Başarılı yanıt güncel listeyi yeniler; hesap değişiminde ek veriler temizlenir. İlk yüklemede henüz çözülmemiş ilanlar yayından kalkmış gibi gösterilmez.
- Ortak satışa açık filtresi web ve mobilde aynı uygunluk kuralını kullanır: açık veya onayla katılım; aktif, stokta bulunan (alıcı talebi stok istisnası korunur), örnek olmayan ilan. Davetle katılım, kapalı ve stoksuz ürünler bu filtreye dahil değildir.
- Web favori sıralaması ilan yayın tarihinden favoriye ekleme tarihine taşındı. Son eklenenler masaüstünde son 7 günde kaydedilen ilanları gösterir.
- Masaüstü favori araması eklendi; ürün, şehir ve kategori araması, aramayı temizleme ve boş sonuçta mevcut filtre sıfırlama akışı birlikte çalışır. Sekmelerin erişilebilir düğme ve seçim bilgileri eklendi.

## Kontroller

- Mobil taklit API testi: `audit/mobile-v4/favorites-recovery-ui.json`; açık katılım sayısı, boş görünümden dönüş, arama kapatma, yenileme hatasında kartların korunması, yeniden deneme.
- Üretim web çıktısında 390/1440 piksel testi: `audit/web-review/favorites-recovery-ui.json`; onayla katılım, uygun olmayan ilanların dışarıda kalması, kayıt tarihine göre sıralama, son 7 gün, masaüstü arama/temizleme ve yatay taşma kontrolü.
- Paylaşılan uygunluk birim testi: `node scripts/check-listing-actions.mjs`.
- TypeScript ve değiştirilen TSX dosyalarında ESLint geçti: `audit/mobile-v4/favorites-recovery-typescript.log`, `audit/mobile-v4/favorites-recovery-eslint.log`.
- Web dışa aktarımı: `dist-check-mobile/favorites-recovery-web`.
- Android dışa aktarımı: `dist-check-mobile/favorites-recovery-android`.

Testler gerçek favori/mesaj kayıtlarını değiştirmedi; HTTP/WebSocket yanıtları taklit edildi. Veritabanı değişmedi. Android dışa aktarımı cihaz veya emülatörde çalıştırma testi değildir. Kaydedilen arama eşitleme modülü bu tur değiştirilmedi.
