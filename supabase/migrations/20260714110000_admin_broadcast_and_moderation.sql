-- ---------------------------------------------------------------------------
-- ADMIN P0 HATA DÜZELTMELERİ (denetim bulguları)
--
-- 1) YAYIN MESAJI EKSİK GİDİYORDU: adminBroadcast bildirim satırlarını istemcideki
--    `users` dizisinden (bellek penceresi, ≤1000) üretiyordu → "tüm kullanıcılara
--    duyuru" aslında en fazla 1000 kişiye ulaşıyordu. Artık sunucuda, TÜM
--    profillere tek sorguyla yazılır.
--
-- 2) MESAJ MODERASYONU YANLIŞ VERİ GÖSTERİYORDU: bölüm, hesap anlık görüntüsünden
--    gelen `conversations`/`messages`i kullanıyordu — bunlar RLS/filtre gereği
--    ADMİNİN KENDİ yazışmalarıydı. Yani "platform mesaj moderasyonu" aslında
--    adminin kendi gelen kutusuydu (sahte güvenlik sinyali). Artık platform
--    genelinden okuyan admin RPC'si var.
-- ---------------------------------------------------------------------------

-- 1) SUNUCU TARAFLI YAYIN — tüm kullanıcılara (isteğe bağlı rol filtresi)
create or replace function public.admin_broadcast(
  p_title text,
  p_body text,
  p_role text default null
)
returns int language plpgsql security definer set search_path to 'public' as $fn$
declare v_n int; v_me uuid := auth.uid();
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  if coalesce(btrim(p_title), '') = '' or coalesce(btrim(p_body), '') = '' then
    raise exception 'title and body required';
  end if;

  insert into public.notifications (user_id, type, title, body)
  select p.id, 'system', btrim(p_title), btrim(p_body)
  from public.profiles p
  where p.id <> v_me
    and coalesce(p.status, 'active') <> 'suspended'
    and (p_role is null or p_role = '' or p.role::text = p_role);

  get diagnostics v_n = row_count;
  return v_n;
end;
$fn$;
grant execute on function public.admin_broadcast(text, text, text) to authenticated;

-- 2) PLATFORM GENELİ MESAJ MODERASYONU — son mesajlar + risk taraması için
--    (adminin kendi kutusu DEĞİL). Gönderen/alıcı adları ve ilan başlığı ile.
create or replace function public.admin_recent_messages(
  p_q text default null,
  p_limit int default 100,
  p_offset int default 0
)
returns table (
  id uuid, conversation_id uuid, body text, created_at timestamptz,
  sender_id uuid, sender_name text, receiver_id uuid, receiver_name text,
  listing_id uuid, listing_title text, total_count bigint
)
language plpgsql security definer set search_path to 'public' as $fn$
declare v_limit int := least(greatest(coalesce(p_limit, 100), 1), 200);
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  return query
  with base as (
    select m.id, m.conversation_id, m.body, m.created_at, m.sender_id, m.receiver_id, m.listing_id
    from public.messages m
    where (p_q is null or p_q = '' or m.body ilike '%' || p_q || '%')
  ), counted as (select count(*) c from base)
  select b.id, b.conversation_id, b.body, b.created_at,
         b.sender_id, sp.full_name::text, b.receiver_id, rp.full_name::text,
         b.listing_id, l.title::text, (select c from counted)
  from base b
  left join public.profiles sp on sp.id = b.sender_id
  left join public.profiles rp on rp.id = b.receiver_id
  left join public.listings l on l.id = b.listing_id
  order by b.created_at desc
  limit v_limit offset greatest(coalesce(p_offset, 0), 0);
end;
$fn$;
grant execute on function public.admin_recent_messages(text, int, int) to authenticated;

-- 3) PLATFORM MESAJ HACMİ (gerçek sayılar — "N görüşme · N mesaj" başlığı için)
create or replace function public.admin_message_stats()
returns json language plpgsql security definer set search_path to 'public' as $fn$
declare result json;
begin
  if not public.is_admin() then raise exception 'not authorized'; end if;
  select json_build_object(
    'conversations', (select count(*) from public.conversations),
    'messages', (select count(*) from public.messages),
    'messages_24h', (select count(*) from public.messages where created_at > now() - interval '24 hours'),
    'blocked_pairs', (select count(*) from public.blocked_users)
  ) into result;
  return result;
end;
$fn$;
grant execute on function public.admin_message_stats() to authenticated;
