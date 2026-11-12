# Mobil web — kompakt ilan filtreleri

Ana sayfadaki uzun gelişmiş filtre alanı ve Keşfet'teki ekranı kaplayan mobil filtre penceresi, ilanların üstünde açılan ortak bir panelle değiştirildi.

- Başlıklar yataydır; aynı anda tek grubun içeriği gösterilir. İçerik alanının yüksekliği ekrana göre sınırlıdır; uzun seçeneklerde panelin içi kayar.
- Panelin üstünde temizle/kapat, altında sonuçlara dön düğmesi bulunur. Sayfa ve ilanlar aynı gezinme akışında kalır.
- Ana sayfa filtreleri kategori vitrininden hemen sonra, ilan şeritlerinin önünde yer alır. Filtreleme sırasında vitrin önerileri yerine eşleşen katalog öne çıkar.
- Fiyat, konum, kategori, komisyon, satıcı ve diğer mevcut kriterler korunur. İl/ilçe seçicinin kendi seçenek penceresi korunur; ana filtre tam sayfa olarak açılmaz.
- Fiyat alanları 16 piksel metin kullanır. Sekme değişimi ve panelin kapanması girilen kriterleri silmez.
- Masaüstü filtre sütunu ve native uygulamanın mevcut filtre akışı korunur. Bu değişiklik mobil tarayıcıya yöneliktir.

Dosyalar: `components/compact-filter-panel.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/explore.tsx`.

Yerel test: `scripts/check-compact-inline-filters.mjs`. Chromium ve WebKit'te 320/390/430/768 piksel genişlikler, en fazla 345 piksel panel yüksekliği, bölüm geçişleri, fiyat değerlerinin korunması, İstanbul/Kadıköy seçimi, temizleme, kapatma ve 1440 piksel masaüstü görünümü kontrol edildi. Backend istekleri taklit edildi; kullanıcı/ilan yazılmadı. TypeScript, lint, karakter ve whitespace kontrolleri geçti.

Kullanıcının “devam gelişmeye deploy unutma” talebi üzerine production adayı oluşturuldu: `dpl_HTheM7FK6cCvNeoBdbQwS9jXdQtp` / `https://ortaksat-p48p3cf6y-fatih5.vercel.app`. Bu paket Chromium ve WebKit'te 45'er sayfa/ölçü kontrolü ve iki kompakt filtre etkileşiminden geçti; aynı paket yeniden derlenmeden `https://www.ortaksat.com` alan adına terfi ettirildi.

Canlı alan adında her motor için 12 sayfa/ölçü kontrolü ve ana sayfa/Keşfet kompakt filtre etkileşimi geçti. Sayfa istisnası, yatay taşma veya tam ekran filtre penceresi görülmedi. Önceki sürüm: `dpl_13aXxwFzhCf9SVtidYHtnKhbu6Xt`. Yayın kanıtları: `audit/compact-filters-release/`. Migration uygulanmadı; Güven Sistemi kapalı kaldı. Native mağaza yayını yapılmadı.

Araştırma: [eBay mobil arama/filtre açıklaması](https://www.ebay.com/help/Buying/Finding_Items_Managing_Purchases/Advanced_search?id=4049), [sahibinden arama sonuçlarında filtreleme](https://yardim.sahibinden.com/hc/tr/articles/115004846274-%C4%B0lan-Filtreleme-Se%C3%A7enekleri-Nelerdir). OrtakSat'taki ekran içi panel, kullanıcının ilanların üstünde kompakt filtre talebine göre uygulanmıştır.
