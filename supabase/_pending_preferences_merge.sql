-- Tercihleri SUNUCUDA birleştir (2026-11-12): istemci tüm preferences JSON'unu bayat durumdan
-- yazıyordu → iki eşzamanlı kayıt (ör. bildirim ayarı + başka bir tercih) birbirini eziyordu.
-- merge_my_preferences(patch) yalnız verilen anahtarları değiştirir; null değer anahtarı siler.
begin;
create or replace function public.merge_my_preferences(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path to 'public' as $$
declare v_uid uuid := auth.uid(); v_next jsonb;
begin
  if v_uid is null then raise exception 'auth required' using errcode = '42501'; end if;
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then
    raise exception 'patch must be an object' using errcode = '22023';
  end if;
  if pg_column_size(p_patch) > 16384 then
    raise exception 'patch too large' using errcode = '22023';
  end if;
  update public.profiles
    set preferences = jsonb_strip_nulls(coalesce(preferences, '{}'::jsonb) || p_patch)
    where id = v_uid
    returning preferences into v_next;
  if v_next is null then raise exception 'profile not found' using errcode = '22023'; end if;
  if pg_column_size(v_next) > 65536 then
    raise exception 'preferences too large' using errcode = '22023';
  end if;
  return v_next;
end $$;
revoke all on function public.merge_my_preferences(jsonb) from public, anon;
grant execute on function public.merge_my_preferences(jsonb) to authenticated;
commit;
