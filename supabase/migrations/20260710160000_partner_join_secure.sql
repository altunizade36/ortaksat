-- Ortaklık katılımını SUNUCUDA doğrula (invite kodu + onay-modu + reddedilen yeniden-açma).
-- Sorunlar: (1) invite kodu yalnız istemcide doğrulanıyordu → doğrudan REST POST ile
-- status='active' bypass. (2) partnerships UPDATE RLS'i yalnız SAHİBE izin veriyor →
-- ortak reddedilen başvurusunu yeniden AÇAMIYORDU (client update RLS'e takılıyor).
-- Çözüm: tek SECURITY DEFINER RPC (partner_join) — invite kodunu SQL'de FNV ile doğrular,
-- onay modunu 'pending' yapar, reddedileni yeniden açar. Platform PARA TUTMAZ; yalnız kayıt.

-- FNV-1a (32-bit) — lib/format.ts listingInviteCode ile birebir aynı çıktı (test edildi).
create or replace function public.listing_invite_code(p_listing_id uuid, p_owner_id uuid)
returns text language plpgsql immutable set search_path = public as $fn$
declare
  s text := 'ortak-davet:' || p_listing_id::text || ':' || p_owner_id::text;
  h bigint := 2166136261; i int; c int; n bigint; r text := ''; d int;
  digits constant text := '0123456789abcdefghijklmnopqrstuvwxyz';
begin
  for i in 1..length(s) loop
    c := ascii(substr(s, i, 1));
    h := (h # c::bigint);
    h := (h * 16777619) % 4294967296;
  end loop;
  n := h;
  if n = 0 then return '0'; end if;
  while n > 0 loop
    d := (n % 36)::int;
    r := substr(digits, d + 1, 1) || r;
    n := n / 36;
  end loop;
  return r;
end $fn$;

-- Onay/invite modunda doğrudan INSERT ile status='active' → 'pending'e zorla.
-- Güvenilir RPC (partner_join) app.trusted_join GUC'unu set ederek bu zorlamayı atlar.
create or replace function public.enforce_partnership_approval()
returns trigger language plpgsql security definer set search_path = public as $$
declare l_mode text;
begin
  if coalesce(current_setting('app.trusted_join', true), '') = '1' then
    return new; -- doğrulanmış RPC yolundan geldi
  end if;
  select partnership_mode::text into l_mode from public.listings where id = new.listing_id;
  if new.status = 'active' and coalesce(l_mode, 'approval') in ('approval', 'invite') then
    new.status := 'pending';
  end if;
  return new;
end $$;

drop function if exists public.partner_join(uuid, uuid, text, text, text, text, text, text, int);
create function public.partner_join(
  p_partnership_id uuid,
  p_listing_id uuid,
  p_ref_code text,
  p_invite_code text,
  p_note text,
  p_share_channel text,
  p_audience text,
  p_platform_handle text,
  p_reach int
) returns table(r_id uuid, r_status text)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_owner uuid; v_mode text; v_lstatus text; v_demo boolean; v_minrating numeric; v_prating numeric;
  v_target text; v_existing_id uuid; v_existing_status text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select l.owner_id, l.partnership_mode::text, l.status::text, coalesce(l.demo, false), coalesce(l.min_partner_rating, 0)
    into v_owner, v_mode, v_lstatus, v_demo, v_minrating
    from public.listings l where l.id = p_listing_id;
  if v_owner is null then raise exception 'Listing not found'; end if;
  if v_demo then raise exception 'Demo listing'; end if;
  if v_lstatus <> 'active' then raise exception 'Listing not active'; end if;
  if v_owner = v_uid then raise exception 'Cannot join own listing'; end if;
  select coalesce(rating, 0) into v_prating from public.profiles where id = v_uid;
  if v_prating > 0 and v_prating < v_minrating then raise exception 'Insufficient partner rating'; end if;

  if v_mode = 'open' then
    v_target := 'active';
  elsif v_mode = 'invite' then
    if p_invite_code is not distinct from public.listing_invite_code(p_listing_id, v_owner) then
      v_target := 'active';
    else
      raise exception 'Invalid invite code';
    end if;
  else
    v_target := 'pending';
  end if;

  perform set_config('app.trusted_join', '1', true);

  select p.id, p.status::text into v_existing_id, v_existing_status
    from public.partnerships p where p.listing_id = p_listing_id and p.partner_id = v_uid;

  if v_existing_id is not null then
    if v_existing_status <> 'rejected' then
      return query select v_existing_id, v_existing_status;
      return;
    end if;
    update public.partnerships set
      status = v_target::partnership_status,
      rejection_reason = null,
      note = coalesce(nullif(p_note, ''), note),
      share_channel = coalesce(nullif(p_share_channel, ''), share_channel),
      audience = coalesce(nullif(p_audience, ''), audience),
      platform_handle = coalesce(nullif(p_platform_handle, ''), platform_handle),
      reach_estimate = coalesce(p_reach, reach_estimate),
      approved_at = case when v_target = 'active' then now() else approved_at end
      where public.partnerships.id = v_existing_id;
    return query select v_existing_id, v_target;
    return;
  end if;

  insert into public.partnerships (id, listing_id, partner_id, ref_code, status, note, share_channel, audience, platform_handle, reach_estimate, approved_at)
    values (p_partnership_id, p_listing_id, v_uid, p_ref_code, v_target::partnership_status,
      coalesce(p_note, ''), p_share_channel, p_audience, p_platform_handle, coalesce(p_reach, 0),
      case when v_target = 'active' then now() else null end);
  return query select p_partnership_id, v_target;
end $$;

grant execute on function public.partner_join(uuid, uuid, text, text, text, text, text, text, int) to authenticated;
