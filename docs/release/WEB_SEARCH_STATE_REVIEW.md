# Web arama durumu ve kayıtlı filtreler — 28 Ekim 2026

29 Ekim 2026'da `dpl_5T32Q9BfU4oiVYRnAXEoRu4BBoTK` ile canlıya yayınlandı. Yayın ve canlı kontrol ayrıntıları: `RESPONSIVE_AUTH_REVIEW.md`.

## Düzeltilen davranışlar

- Sekmelerin üzerindeki ortak başlık, etkin sayfanın genel arama parametresini okur. Sorgu sonuç sayfasında, ekran genişliği değişince ve sayfa yenilenince kutuda korunur.
- Statik HTML ile tarayıcıdaki ilk render eşleşir; ziyaretçinin URL sorgusu hydration sonrasında uygulanır.
- Komisyon oranı, satıcı puanı ve öne çıkan filtresi URL'e yazılır ve seçim kaldırılınca URL'den silinir.
- Kayıtlı arama il/ilçe, komisyon oranı, puan, doğrulanmış satıcı, öne çıkan ve akış sekmesini de içerir. Geri yüklemede bu seçimler uygulanır; eski kayıtlarda eksik olan seçenekler temizlenir.
- İlçe kayıtlı ilin ilçeleri arasından doğrulanır. Kayıtlı sıralama/stok/sekme değerleri izin verilen seçeneklerle sınırlanır.
- Dar görünümde Tümünü temizle, komisyon oranı/puan/öne çıkan seçimlerini de temizler; arama kelimesi korunur.
- JSON filtreler anahtar ve seçim sırasından bağımsız karşılaştırılır. Sunucudan farklı JSON anahtar sırasıyla gelen kayıt, yerel aynı kayıtla birleştirilir; tekrar gösterilmez ve zaten kayıtlı işareti korunur.
- Yeni daraltmalarda görünür sonuç sayacı sıfırlanır.

## Doğrulama

- `scripts/check-web-search-keyboard-ui.mjs`: önceki klavye/geçmiş testlerine ek olarak sorgunun sonuçta, 390 px'e geçişte ve yenilemede korunması; ilan detayından tarayıcı geri dönüşü geçti.
- `scripts/check-web-search-state-ui.mjs`: tam filtre kaydetme, farklı sırada sunucu JSON'u ile tek kayıt kalması, 390 px temizleme/geri yükleme, üç filtrenin tek tek kaldırılıp yenilemede kapalı kalması geçti.
- `scripts/check-web-recovery-ui.mjs`: arama ve favori hata/yeniden deneme, gecikmiş eski sorgunun yalıtılması, sayfalama ve parçalı favori yüklemesi geçti.
- `scripts/check-search-filter-equality.mjs`: 7 karşılaştırma durumu geçti.
- TypeScript, hedefli ESLint ve web export başarılı: `dist-check-mobile/search-state-web`.
- Görsel kontrol: `audit/web-review/search-state-390.png`; arama kutusunda BMW ve tek kayıtlı BMW satırı görünüyor.

Tüm API testleri taklit yanıtlarla yapıldı. Gerçek kullanıcı kaydı, ilan veya sunucu ayarı değiştirilmedi. Veritabanı/API sorgusu veya RLS politikası değişmedi; kayıt birleştirme istemcide düzeltilmiştir. Her türlü filtre geçmişi/geri-ileri geçişinin eksiksiz denetlendiği iddia edilmez; bu testlerde geri dönüş sorgu akışı ve kayıtlı filtre açma akışı doğrulandı.
