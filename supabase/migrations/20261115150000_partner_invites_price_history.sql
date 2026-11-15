-- Ortaklık daveti + ilan fiyat geçmişi (2026-11-15).
--
-- 1) ORTAKLIK DAVETİ. Bugüne kadar ortaklık yalnız ortağın başvurmasıyla kuruluyordu; satıcı beğendiği bir ortağı
--    (dizinden / vitrininden) kendi ilanına ÇAĞIRAMIYORDU. `invite_partner_to_listing` satıcının bir ortağı ilanına
--    davet etmesini sağlar: davet kaydı tutulur, ortağa uygulama içi bildirim gider (ilana götürür). Ortaklık yine
--    ortağın başvurusu / satıcının kabulüyle kurulur — davet yalnız bir çağrıdır, kimseyi ortak YAPMAZ.
--    Kötüye kullanım korumaları: yalnız ilan sahibi, yalnız yayında ve ortaklığa açık ilan, engelleşmiş taraflara
--    gitmez, aynı ortağa aynı ilan için bir kez, satıcı başına günde en çok 20 davet.
--    Bildirimi istemci yazamaz (başkasına bildirim yalnız sunucudan); bu yüzden işlev SECURITY DEFINER.
--
-- 2) FİYAT GEÇMİŞİ. İlan fiyatı değiştiğinde eski/yeni fiyat kaydedilir; ilan sayfasında "fiyat ne zaman, ne kadar
--    değişti" gösterilir (alıcı için güven sinyali). Tabloya istemci doğrudan erişemez; `listing_price_history(p_listing)`
--    yalnız YAYINDAKİ ilanın (ya da sahibinin kendi ilanının) son değişikliklerini verir.

-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.partnership_invites (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  seller_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (listing_id, partner_id)
);
create index if not exists partnership_invites_seller_day on public.partnership_invites (seller_id, created_at desc);
create index if not exists partnership_invites_partner on public.partnership_invites (partner_id, created_at desc);
alter table public.partnership_invites enable row level security;
revoke all on public.partnership_invites from anon, authenticated;
grant select on public.partnership_invites to authenticated;
drop policy if exists partnership_invites_read on public.partnership_invites;
create policy partnership_invites_read on public.partnership_invites
  for select to authenticated
  using (seller_id = (select auth.uid()) or partner_id = (select auth.uid()));

create or replace function public.invite_partner_to_listing(p_listing uuid, p_partner uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_me uuid := auth.uid();
  v_listing record;
  v_seller_name text;
  v_inserted uuid;
begin
  if v_me is null then raise exception 'Davet göndermek için giriş yapmalısın.'; end if;
  if p_partner is null or p_partner = v_me then raise exception 'Kendini davet edemezsin.'; end if;

  select id, owner_id, title, status::text as status, partnership_mode::text as mode
    into v_listing from public.listings where id = p_listing;
  if v_listing.id is null or v_listing.owner_id <> v_me then raise exception 'Yalnız kendi ilanına davet gönderebilirsin.'; end if;
  if v_listing.status <> 'active' then raise exception 'İlan yayında değil; davet gönderilemez.'; end if;
  if coalesce(v_listing.mode, 'none') = 'none' then raise exception 'Bu ilan ortaklığa açık değil. Önce ilanda komisyon belirle.'; end if;

  if not exists (select 1 from public.profiles where id = p_partner and coalesce(status::text, 'active') = 'active') then
    raise exception 'Bu kullanıcıya davet gönderilemiyor.';
  end if;
  if exists (select 1 from public.blocked_users
              where (blocker_id = v_me and blocked_id = p_partner) or (blocker_id = p_partner and blocked_id = v_me)) then
    raise exception 'Bu kullanıcıya davet gönderilemiyor.';
  end if;

  -- Zaten başvurmuş / ortak olmuşsa davete gerek yok.
  if exists (select 1 from public.partnerships
              where listing_id = p_listing and partner_id = p_partner and status::text in ('pending', 'active')) then
    return 'joined';
  end if;

  if (select count(*) from public.partnership_invites
       where seller_id = v_me and created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Günlük davet sınırına ulaştın (20). Yarın yeniden deneyebilirsin.';
  end if;

  insert into public.partnership_invites (listing_id, seller_id, partner_id)
  values (p_listing, v_me, p_partner)
  on conflict (listing_id, partner_id) do nothing
  returning id into v_inserted;
  if v_inserted is null then return 'already'; end if;

  select coalesce(nullif(trim(full_name), ''), 'Bir satıcı') into v_seller_name from public.profiles where id = v_me;
  insert into public.notifications (user_id, type, title, body, metadata, actor_id)
  values (p_partner, 'application', 'Ortaklık daveti',
          format('%s seni "%s" ilanında ortak satışa davet etti. İlanı inceleyip başvurabilirsin.',
                 v_seller_name, private.display_listing_title(v_listing.title)),
          jsonb_build_object('listingId', p_listing), v_me);
  return 'sent';
end;
$function$;
revoke all on function public.invite_partner_to_listing(uuid, uuid) from public, anon;
grant execute on function public.invite_partner_to_listing(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.listing_price_history (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  old_price numeric not null,
  new_price numeric not null,
  changed_at timestamptz not null default now()
);
create index if not exists listing_price_history_listing on public.listing_price_history (listing_id, changed_at desc);
alter table public.listing_price_history enable row level security;
revoke all on public.listing_price_history from anon, authenticated;

create or replace function public.record_listing_price_change()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  -- Yalnız yayınlanmış ilanın gerçek fiyat değişimi kaydedilir (taslak düzenlemeleri geçmişi kirletmesin).
  if new.price is not null and old.price is not null and new.price <> old.price
     and old.status::text in ('active', 'paused') and new.status::text in ('active', 'paused') then
    insert into public.listing_price_history (listing_id, old_price, new_price) values (new.id, old.price, new.price);
  end if;
  return new;
end;
$function$;
drop trigger if exists trg_record_listing_price_change on public.listings;
create trigger trg_record_listing_price_change
  after update of price on public.listings
  for each row execute function public.record_listing_price_change();

create or replace function public.listing_price_history(p_listing uuid)
returns table (old_price numeric, new_price numeric, changed_at timestamptz)
language sql
stable
security definer
set search_path to 'public'
as $function$
  select h.old_price, h.new_price, h.changed_at
  from public.listing_price_history h
  join public.listings l on l.id = h.listing_id
  where h.listing_id = p_listing
    and (l.status::text = 'active' or l.owner_id = (select auth.uid()))
  order by h.changed_at desc
  limit 10;
$function$;
revoke all on function public.listing_price_history(uuid) from public;
grant execute on function public.listing_price_history(uuid) to anon, authenticated;

notify pgrst, 'reload schema';
