-- Apple ile giriş web'de ve Android'de (tarayıcı yönlendirmesiyle) ancak Apple Developer'da bir "Services ID"
-- ve .p8 anahtarıyla imzalı gizli anahtar Supabase'e yazıldıktan sonra çalışır. O ana kadar düğme gizli kalsın
-- diye sunucudan okunan anahtar: scripts/setup-apple-web-login.py kurulum bitince true yapar (uygulamayı yeniden
-- derlemek gerekmez). iOS uygulamasındaki yerel Apple girişi bu anahtardan bağımsız, her zaman açık.
alter table public.platform_settings add column if not exists apple_web_login boolean not null default false;
grant select (apple_web_login) on public.platform_settings to anon, authenticated;
