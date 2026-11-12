# Güven Sistemi işletim notları

## Özel belgeler

`trust-evidence` private bucket: JPG/PNG/PDF, dosya başına 5 MB; işlemde 20, kullanıcıda günlük 50 sınırı. Uploader için de doğrudan okuma/yazma/silme açık değildir. Kayıt, yetkili upload, karantina, tarama ve yetkili 60 saniyelik indirme ayrı adımlardır. Belge taraması bankadan ödeme doğrulaması değildir.

Tarayıcı sözleşmesi: `TRUST_SCANNER_URL` HTTPS POST ham dosya baytlarını alır; `Authorization: Bearer <TRUST_SCANNER_KEY>` ve `X-Content-SHA256` gönderilir. Başarılı JSON yanıtı `{clean:boolean,sha256:string,byteSize:number,engine:string}` olmalı; hash ve boyut dosyayla eşleşmelidir. Hatalı/erişilemeyen tarayıcı belgeyi temiz saymaz. Tarama lease/retry sınırları mükerrer işi sınırlar. Üretim sağlayıcısı henüz doğrulanmadı.

Hassas alanlar yükleme öncesinde maskelenir. Otomatik redaksiyon yoktur. Belgeler public profil veya public yorumlarla servis edilmez. Yetkili taraf/staff erişimi audit kaydı üretir; erişim URL'leri loglara veya bildirim metnine konmaz.

## Saklama ve silme

Teknik taslak: 180 günü geçen uygun belgeler `trust_v1_retention_candidates` ile yalnız service role tarafından listelenebilir. Açık itirazla bağlantılı kayıtlar dışarıda tutulur. Bu RPC dosya silmez; otomatik purge görevi kurulmadı.

Kullanıcı talebi mevcut uygulama destek ekranından veya destek@ortaksat.com üzerinden alınır. İşlem/belge kimliği istenir; yeni dekont, kimlik veya IBAN'ın e-postaya eklenmesi istenmez. Yetkili ekip kimliği ve erişim hakkını doğrular, açık itiraz ve saklama zorunluluğunu inceler. Gerekçeli karar ve uygulanan işlem denetlenebilir şekilde kaydedilmeden dosya silinmez. Hukuki inceleme bitmeden kalıcı otomatik silme takvimi açılmaz.

## Olay ve itiraz

Bildirim bakım uç noktası yalnız ayrı güçlü bakım sırrıyla çağrılır. Kalıcı anahtarlar vade/değerlendirme bildirimlerinin tekrarlanmasını önler. Gerçek zamanlayıcı henüz kurulmadı. Yönetici kendi taraf olduğu davada karar veremez. Kısıtlama mevcut borç/kanıt/itiraz hakkını ortadan kaldırmaz; gerekçeli kaldırma kaydı tutulur.

## Acil kapatma

Önce Trust flag'lerini [DISABLE.sql](./DISABLE.sql) ile kapat. Ardından gerekirse önceki Vercel production sürümüne dön. Yeni tabloları drop etme, eski komisyonları topluca güncelleme ve kullanıcı oturumlarını sıfırlama. Geri dönüş, önceki muhasebe kaydını ikinci kez oluşturmayı gerektirmez.
