# Canlı yayın · 31 Ekim 2026

- Site: https://www.ortaksat.com/partner
- Proje: ortaksat / fatih5
- Yeni production: `dpl_7UxnrWCKY6VwtNyhDVbfGXtevmC2`
- Deployment: https://ortaksat-jdzsraknm-fatih5.vercel.app
- Önceki production: `dpl_5T32Q9BfU4oiVYRnAXEoRu4BBoTK`
- Kaynak HEAD: `9e519965c`; mevcut çalışma ağacındaki değişiklikler dahil, yeni commit oluşturulmadı.

Kapsam: web logosu, masaüstü ortaklık sayfası, dar web tekrarlarının kaldırılması, ilan tutar/komisyon kontrolleri ve filtre sayı düzeltmeleri.

Vercel production ortamıyla hazırlanmış sürüm READY durumunda doğrulandı ve yeniden derlenmeden promote edildi. Yayın öncesi 11 sayfa HTTP 200; yayımlanan JS paketinde yeni web düzeni ve filtre işaretleri doğrulandı. Production hedefi API üzerinden yeniden kontrol edildi.

Canlı kontrol: Chromium ve WebKit, 1440/1024/390/320 genişliklerde ortaklık düzeni, marka, tek başlık ve taşmama geçti. Ana sayfa ile hakkımızda/yardım/iletişim/gizlilik/kullanım şartları/KVKK sayfaları 200; arama klavyesi ve gezinmesi geçti. Sayfa JavaScript hatası görülmedi. Yalnızca okuma işlemleri yapıldı; gerçek ilan, ortaklık, kullanıcı veya mesaj oluşturulmadı.

Kanıtlar: `audit/web-review/partner-brand-live-checks.json`, `partner-brand-live.log`, `partner-brand-live-pages.log`, `partner-brand-staged-checks.json`, `partner-brand-staged-bundle.log`, `partner-brand-promote.log` ve `partner-live-*.png`.

Yerel Node kurulumu bulunamadığı için SHA256 doğrulamalı Node 24.14.1, ayrıca tarayıcı test araçları `audit/runtime` altında geçici kuruldu. Bu dizin `.vercelignore` ile deploy dışında kalır. DB, DNS ve kimlik doğrulama ayarları değiştirilmedi.
