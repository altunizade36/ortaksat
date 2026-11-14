-- AKTİFLİK GÖSTERGESİ: mağaza / ortak profilinde "Bugün aktif" · "Bu hafta aktif".
--
-- profiles.last_seen_at zaten tutuluyor (heartbeat) ama yalnız yönetim analizinde kullanılıyordu. Kesin saat
-- herkese AÇILMAZ: işlev yalnız KABA bir aralık döndürür (bugün / bu hafta / daha eski) — "şu an çevrim içi" ya da
-- dakika bilgisi yok. Kullanıcı tercihlerinde hideActivity = true ise hiçbir şey dönmez (ayar ekranı eklendiğinde
-- hazır). Silinmiş / askıdaki hesap için de boş döner.
create or replace function public.profile_activity(p_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.last_seen_at is null then null
    when coalesce(p.preferences ->> 'hideActivity', '') = 'true' then null
    when p.last_seen_at > now() - interval '24 hours' then 'today'
    when p.last_seen_at > now() - interval '7 days' then 'week'
    else 'older'
  end
  from public.profiles p
  where p.id = p_id and p.status::text = 'active';
$$;

revoke all on function public.profile_activity(uuid) from public;
grant execute on function public.profile_activity(uuid) to anon, authenticated;
