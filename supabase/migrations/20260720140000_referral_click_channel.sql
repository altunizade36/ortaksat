-- ---------------------------------------------------------------------------
-- REFERRAL TIKLAMA KANALI (büyüme ölçümü)
-- Paylaşım linkleri artık &c=<kanal> taşır (whatsapp/instagram/tiktok/share). Landing
-- kanalı yakalayıp buraya yazar → hangi kanal tıklama/dönüşüm getiriyor ölçülür, büyüme
-- ona göre optimize edilir. Anon-insert politikası check(true) → yeni kolon otomatik yazılır.
-- ---------------------------------------------------------------------------
alter table public.referral_clicks
  add column if not exists channel text;

create index if not exists referral_clicks_channel_idx on public.referral_clicks (channel);
