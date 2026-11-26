-- Web sitesindeki "App Store'dan indir" bağlantıları (alt bilgi rozeti + kare kod, telefon menüsündeki satır,
-- iPhone Safari'nin üst bandı) bu anahtar açılınca görünür. Uygulamanın düzeltilmiş sürümü yayına girene kadar
-- kapalı kalır; açmak için yeniden yayın gerekmez: python scripts/app-link.py ac
alter table public.platform_settings add column if not exists ios_app_link boolean not null default false;
grant select (ios_app_link) on public.platform_settings to anon, authenticated;
