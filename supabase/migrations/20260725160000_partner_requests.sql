-- İLANSIZ "ORTAK ARANIYOR" TALEBİ — iki-taraflı likiditenin ARZ ayağı
-- Denetim boşluğu (keşif, high): satıcı ilan (ürün) OLMADAN "şu iş/kategori için ortak
-- arıyorum" talebi açamıyordu; ortaklar bu talepleri görüp başvuramıyordu. Ortak keşfi tek
-- yönlüydü (her fırsat bir ürün-ilanına bağlıydı). Bu, satıcının ortak ÇAĞRISINI ekler.
-- Platform PARA TUTMAZ — bu yalnız eşleşme/keşif; anlaşma taraflar arası mesajla ilerler.

-- ============================================================================
-- 1) ORTAK TALEBİ (ilansız)
-- ============================================================================
create table if not exists public.partner_requests (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  category text,            -- uzmanlık kökü (opsiyonel)
  commission_hint text,     -- serbest metin: "%10-15" / "500 TL/satış"
  location text,            -- il/ilçe serbest
  status text not null default 'open',  -- open | closed | fulfilled
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.partner_requests drop constraint if exists pr_title_len;
alter table public.partner_requests add constraint pr_title_len check (char_length(title) between 3 and 120);
alter table public.partner_requests drop constraint if exists pr_desc_len;
alter table public.partner_requests add constraint pr_desc_len check (description is null or char_length(description) <= 2000);
alter table public.partner_requests drop constraint if exists pr_status_chk;
alter table public.partner_requests add constraint pr_status_chk check (status in ('open','closed','fulfilled'));
create index if not exists idx_partner_requests_status_created on public.partner_requests(status, created_at desc);
create index if not exists idx_partner_requests_seller on public.partner_requests(seller_id);

alter table public.partner_requests enable row level security;
-- Herkes AÇIK talepleri görür; sahibi kendi tüm taleplerini (kapalı dahil) görür.
drop policy if exists "pr read" on public.partner_requests;
create policy "pr read" on public.partner_requests for select using (status = 'open' or seller_id = auth.uid());
drop policy if exists "pr owner insert" on public.partner_requests;
create policy "pr owner insert" on public.partner_requests for insert with check (seller_id = auth.uid());
drop policy if exists "pr owner update" on public.partner_requests;
create policy "pr owner update" on public.partner_requests for update using (seller_id = auth.uid()) with check (seller_id = auth.uid());
drop policy if exists "pr owner delete" on public.partner_requests;
create policy "pr owner delete" on public.partner_requests for delete using (seller_id = auth.uid());
grant select on public.partner_requests to anon;
grant select, insert, update, delete on public.partner_requests to authenticated;

-- ============================================================================
-- 2) BAŞVURU (ortak → talebe)
-- ============================================================================
create table if not exists public.partner_request_applications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.partner_requests(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  message text,
  status text not null default 'pending',  -- pending | accepted | declined
  created_at timestamptz not null default now(),
  unique (request_id, partner_id)
);
alter table public.partner_request_applications drop constraint if exists pra_msg_len;
alter table public.partner_request_applications add constraint pra_msg_len check (message is null or char_length(message) <= 1000);
alter table public.partner_request_applications drop constraint if exists pra_status_chk;
alter table public.partner_request_applications add constraint pra_status_chk check (status in ('pending','accepted','declined'));
create index if not exists idx_pra_request on public.partner_request_applications(request_id);
create index if not exists idx_pra_partner on public.partner_request_applications(partner_id);

alter table public.partner_request_applications enable row level security;
-- Başvuran kendi başvurularını görür; talep sahibi kendi talebine gelenleri görür.
drop policy if exists "pra read" on public.partner_request_applications;
create policy "pra read" on public.partner_request_applications for select using (
  partner_id = auth.uid()
  or exists (select 1 from public.partner_requests r where r.id = request_id and r.seller_id = auth.uid())
);
-- Başvuran kendi başvurusunu geri çekebilir (sil). Ekleme/durum-değişimi RPC'den (sunucu-otoriteli).
drop policy if exists "pra partner delete" on public.partner_request_applications;
create policy "pra partner delete" on public.partner_request_applications for delete using (partner_id = auth.uid());
grant select, delete on public.partner_request_applications to authenticated;

-- ============================================================================
-- 3) AKIŞ RPC'LERİ (SECURITY DEFINER — sunucu-otoriteli + bildirim)
-- ============================================================================
-- Başvur: talep açık + kendi talebi değil + tekil → başvuru ekle + satıcıya bildir.
create or replace function public.apply_to_partner_request(p_request_id uuid, p_message text default null)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_seller uuid; v_status text; v_title text; v_uid uuid := auth.uid(); v_pname text;
begin
  if v_uid is null then return 'auth_required'; end if;
  select seller_id, status, title into v_seller, v_status, v_title from public.partner_requests where id = p_request_id;
  if v_seller is null then return 'not_found'; end if;
  if v_status <> 'open' then return 'closed'; end if;
  if v_seller = v_uid then return 'own_request'; end if;
  if exists (select 1 from public.partner_request_applications where request_id = p_request_id and partner_id = v_uid) then
    return 'already';
  end if;
  insert into public.partner_request_applications (request_id, partner_id, message)
    values (p_request_id, v_uid, nullif(btrim(coalesce(p_message,'')), ''));
  select full_name into v_pname from public.profiles where id = v_uid;
  insert into public.notifications (id, user_id, type, title, body, read, metadata)
    values (gen_random_uuid(), v_seller, 'application', 'Ortak talebine başvuru',
      coalesce(v_pname,'Bir ortak') || ' "' || coalesce(v_title,'talebin') || '" için ortak olmak istiyor.',
      false, jsonb_build_object('request_id', p_request_id));
  return 'applied';
end; $$;
grant execute on function public.apply_to_partner_request(uuid, text) to authenticated;

-- Yanıtla: YALNIZ talep sahibi kabul/ret → başvuru durumu + ortağa bildir.
create or replace function public.respond_to_partner_application(p_application_id uuid, p_action text)
returns text language plpgsql security definer set search_path to 'public' as $$
declare v_seller uuid; v_partner uuid; v_req uuid; v_title text; v_uid uuid := auth.uid(); v_new text;
begin
  if v_uid is null then return 'auth_required'; end if;
  if p_action not in ('accept','decline') then return 'invalid'; end if;
  select a.request_id, a.partner_id, r.seller_id, r.title
    into v_req, v_partner, v_seller, v_title
    from public.partner_request_applications a join public.partner_requests r on r.id = a.request_id
    where a.id = p_application_id;
  if v_req is null then return 'not_found'; end if;
  if v_seller <> v_uid then return 'forbidden'; end if;
  v_new := case when p_action = 'accept' then 'accepted' else 'declined' end;
  update public.partner_request_applications set status = v_new where id = p_application_id;
  insert into public.notifications (id, user_id, type, title, body, read, metadata)
    values (gen_random_uuid(), v_partner, 'application',
      case when v_new = 'accepted' then 'Başvurun kabul edildi' else 'Başvurun yanıtlandı' end,
      case when v_new = 'accepted'
        then '"' || coalesce(v_title,'talep') || '" için ortaklık başvurun KABUL edildi. Satıcıyla mesajlaşarak detayları konuş.'
        else '"' || coalesce(v_title,'talep') || '" için başvurun bu kez uygun bulunmadı.' end,
      false, jsonb_build_object('request_id', v_req));
  return v_new;
end; $$;
grant execute on function public.respond_to_partner_application(uuid, text) to authenticated;

-- ============================================================================
-- 4) OKUMA RPC'LERİ (feed + sahibin talepleri + başvuranlar)
-- ============================================================================
-- Açık talepler akışı: satıcı bilgisi + başvuru sayısı + "ben başvurdum mu" + "benim mi".
create or replace function public.partner_request_feed(p_category text default null, p_limit int default 60)
returns table(
  id uuid, seller_id uuid, seller_name text, seller_avatar text, seller_verified boolean,
  title text, description text, category text, commission_hint text, location text,
  created_at timestamptz, application_count bigint, mine_applied boolean, is_owner boolean
)
language sql stable security definer set search_path to 'public' as $$
  select r.id, r.seller_id, pr.full_name, pr.avatar_url, (pr.verified_identity or pr.verified_phone),
    r.title, r.description, r.category, r.commission_hint, r.location, r.created_at,
    (select count(*) from partner_request_applications a where a.request_id = r.id)::bigint,
    exists (select 1 from partner_request_applications a where a.request_id = r.id and a.partner_id = auth.uid()),
    (r.seller_id = auth.uid())
  from partner_requests r join profiles pr on pr.id = r.seller_id
  where r.status = 'open' and (p_category is null or r.category = p_category)
  order by r.created_at desc
  limit greatest(1, least(coalesce(p_limit, 60), 200));
$$;
grant execute on function public.partner_request_feed(text, int) to anon, authenticated;

-- Sahibin kendi talepleri (tüm durumlar) + başvuru/bekleyen sayısı.
create or replace function public.my_partner_requests()
returns table(
  id uuid, title text, description text, category text, commission_hint text, location text,
  status text, created_at timestamptz, application_count bigint, pending_count bigint
)
language sql stable security definer set search_path to 'public' as $$
  select r.id, r.title, r.description, r.category, r.commission_hint, r.location, r.status, r.created_at,
    (select count(*) from partner_request_applications a where a.request_id = r.id)::bigint,
    (select count(*) from partner_request_applications a where a.request_id = r.id and a.status = 'pending')::bigint
  from partner_requests r where r.seller_id = auth.uid()
  order by r.created_at desc;
$$;
grant execute on function public.my_partner_requests() to authenticated;

-- Bir talebe gelen başvuranlar (YALNIZ talep sahibi) + ortağın profili/performansı.
create or replace function public.partner_request_applicants(p_request_id uuid)
returns table(
  application_id uuid, partner_id uuid, partner_name text, partner_avatar text, partner_verified boolean,
  confirmed_sales bigint, expertise_categories text[], message text, status text, created_at timestamptz
)
language sql stable security definer set search_path to 'public' as $$
  select a.id, a.partner_id, pr.full_name, pr.avatar_url, (pr.verified_identity or pr.verified_phone),
    (select count(*) from commissions c join partnerships pt on pt.id = c.partnership_id
       where pt.partner_id = pr.id and c.status = any (array['approved','seller_paid','paid']::commission_status[]))::bigint,
    coalesce(pr.expertise_categories, '{}'),
    a.message, a.status, a.created_at
  from partner_request_applications a
  join partner_requests r on r.id = a.request_id
  join profiles pr on pr.id = a.partner_id
  where a.request_id = p_request_id and r.seller_id = auth.uid()
  order by a.created_at desc;
$$;
grant execute on function public.partner_request_applicants(uuid) to authenticated;
