# Emülatör mobil kullanılabilirlik incelemesi — 28 Ekim 2026

OrtakSat, OrtakSat_Mobile_API35 / emulator-5554 üzerinde Expo Go ve yerel Metro (8088) ile açıldı. Son değişiklikler canlı siteye yayınlanmadı.

## Bu tur uygulananlar

- Ana sayfa telefon görünümü üç dar sütundan iki sütuna geçti; ilan adı, konum, fiyat ve komisyon yazıları büyütüldü.
- Geçersiz komisyon oranı (örn. %350) ana sayfa, kategori satırı ve mobil ilan detayında gerçek kazanç gibi gösterilmez. Satıcıya sor metni kullanılır. Oran değeri para tutarına çevrilmedi; sabit tutarda mevcut para birimi korunur. Veri tabanındaki eski kayıtlar değiştirilmedi.
- İlan detayında başlık tam satır genişliğini kullanır; durum etiketi ve seçenekler ayrı satırdadır.
- Alt iletişim alanında Mesaj etiketi kısaltılarak dar düğmede iki satıra düşme azaltıldı.

## Doğrulama

- Emülatörde gerçek ana sayfa, kategori, ilan detayı ve ilan verme ekranı açılıp incelendi. Mevcut taslak silinmedi, fotoğraf yüklenmedi, ilan yayınlanmadı, gerçek mesaj/başvuru gönderilmedi.
- Yeni ana sayfa: `audit/mobile-v4/emulator-home-final.png`.
- Yeni detay: `audit/mobile-v4/emulator-detail-improved.png` ve XML.
- İlan verme incelemesi: `audit/mobile-v4/emulator-review-create.png`.
- İzole mobil arayüz testi 320/390 pikselde iki sütun, geçersiz oran, sabit EUR komisyonu, tam genişlik başlık ve Mesaj düğmesini doğruladı: `audit/mobile-v4/home-emulator-review-ui.json`.
- Komisyon değeri birim testi `scripts/check-saved-search-gallery.mjs` içine eklendi. TypeScript ve değiştirilen ekranlarda ESLint geçti.
- Android çıktısı: `dist-check-mobile/home-review-android`; günlük `audit/mobile-v4/home-review-android-export.log`.

## Sonraki öncelikler

1. İlan verme formunda adım ilerlemesini daha belirgin yapma ve eksik alana yönlendirme. Fotoğraf sınırı 5 olarak korunmalı, video eklenmemeli.
2. Klavye açıkken etkin alanın ve devam işleminin görünürlüğünü gerçek cihazda doğrulama; uygun tek elle kullanım.
3. Fotoğraf sıralama/kapak/yeniden yükleme işlemlerinin daha açık olması. Kullanıcının taslağını kaybetmeden devam etmesi.
4. Uzun ana sayfada bölümleri kısaltma ve daha fazlasını bilinçli açma; sonuçların sayısını yükleme maliyetiyle dengeleme.
5. Geçersiz eski komisyon kayıtlarının ilan sahibi tarafından doğru oran/tutar bilgisiyle düzeltilmesi. İstemci bu bilgiyi tahmin etmemeli.

Bu maddeler öneri/sonraki işlerdir; tamamlanmış oldukları iddia edilmez.
