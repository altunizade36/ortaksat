-- IBAN/ÖDEME BİLGİSİ TOPLAMA KALDIRILDI — para modeliyle tutarlılık.
-- OrtakSat PARA TUTMAZ; ödeme akışına aracılık etmez; IBAN/banka bilgisi istemez/saklamaz.
-- Komisyon ödemesi ortak ile satıcı arasında Platform DIŞINDA doğrudan yapılır.
--
-- payout_info tablosu (yalnız IBAN saklıyordu) artık hiçbir kod tarafından kullanılmıyor
-- (fetchMyPayoutIban/saveMyPayoutIban + profil IBAN alanları kaldırıldı). Tablo boş
-- (0 satır) → şemadan düşürülür ki "IBAN yeri" hiç kalmasın.
drop table if exists public.payout_info cascade;
