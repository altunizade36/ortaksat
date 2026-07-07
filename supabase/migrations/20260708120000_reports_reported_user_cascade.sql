-- reports.reported_user_id ON DELETE SET NULL → CASCADE.
--
-- NEDEN: reports check constraint'i (listing_id IS NOT NULL OR reported_user_id
-- IS NOT NULL) bir raporun ya bir ilana ya bir kullanıcıya bağlı olmasını şart
-- koşar. reported_user_id SET NULL iken, listing'siz bir kullanıcı-raporunda
-- (ör. doğrulama self-talebi ya da düz kullanıcı şikayeti) raporlanan kullanıcı
-- silinince reported_user_id null olur → her iki referans da null → check ihlali
-- → kullanıcı SİLİNEMEZ (hesap kapatma / admin silme / test teardown patlar).
--
-- ÇÖZÜM: raporlanan kullanıcı silinince rapor da CASCADE ile silinsin (kullanıcı
-- yoksa hakkındaki rapor zaten anlamsız). reporter_id/resolved_by SET NULL kalır
-- (raporu eden/çözen silinse bile rapor, hâlâ geçerli bir kullanıcı hakkındaysa korunur).

alter table public.reports drop constraint if exists reports_reported_user_id_fkey;
alter table public.reports
  add constraint reports_reported_user_id_fkey
  foreign key (reported_user_id) references public.profiles(id) on delete cascade;
