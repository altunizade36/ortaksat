create or replace function public.check_rate_limit(p_action text, p_max_count integer default 10, p_window_seconds integer default 60)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_key text;
  v_count integer;
  v_window integer := least(greatest(coalesce(p_window_seconds, 60), 1), 86400);
begin
  -- Anonim cagrilar sayilmaz: tum ziyaretciler tek sayaci paylasiyordu (biri herkesi
  -- kilitleyebiliyor, tabloyu sisirebiliyordu). Anonim kayit/giris Supabase Auth'un IP
  -- bazli limitleriyle korunur; yazma yollari tablo tetikleyicileriyle sinirlanir.
  if v_uid is null then
    return true;
  end if;
  if p_action is null or length(p_action) > 40 then
    return false;
  end if;
  v_key := p_action || ':' || v_uid::text;

  delete from public.rate_limits
   where occurred_at < now() - make_interval(secs => v_window * 4);

  select count(*) into v_count
    from public.rate_limits
   where bucket_key = v_key
     and occurred_at > now() - make_interval(secs => v_window);

  if v_count >= greatest(coalesce(p_max_count, 10), 1) then
    return false;
  end if;

  insert into public.rate_limits(bucket_key, action) values (v_key, p_action);
  return true;
end;
$function$;
delete from public.rate_limits where bucket_key like '%:anon';