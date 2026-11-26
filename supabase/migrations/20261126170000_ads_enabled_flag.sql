-- Web sitesindeki yan (dikey) reklam alanları bu anahtar açıkken görünür. Kapalıyken reklam betiği hiç yüklenmez.
-- İstenmeyen bir reklam görülürse yeniden yayın beklemeden kapatılabilir: python scripts/ads.py kapat
-- Uygulamanın içinde reklam yoktur.
alter table public.platform_settings add column if not exists ads_enabled boolean not null default false;
grant select (ads_enabled) on public.platform_settings to anon, authenticated;
