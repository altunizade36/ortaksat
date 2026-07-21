-- ---------------------------------------------------------------------------
-- FİYATSIZ İLAN (price = 0) DB'de REDDEDİLİYORDU.
-- SORUN: Uygulama bazı kategorilerde fiyatı OPSİYONEL kabul eder (İş İlanı; hayvan/hizmet/
-- ders gibi "Teklif al" akışları). create/edit bu durumda price=0 gönderir. ANCAK
-- listings_price_check `price > 0` istiyordu → bu kategorilerdeki ilanlar HİÇ yayınlanamıyordu
-- (rollback-testli doğrulandı: "violates check constraint listings_price_check").
-- ÇÖZÜM: price >= 0. (Negatif fiyat hâlâ yasak; 0 = "fiyat belirtilmemiş / teklif al".)
-- Aynı sınıf tuzak: uygulama bir durumu destekler, DB kısıtı reddeder → runtime'da sessiz kırık.
-- ---------------------------------------------------------------------------
alter table public.listings drop constraint if exists listings_price_check;
alter table public.listings add constraint listings_price_check check (price >= 0);
