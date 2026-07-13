-- ---------------------------------------------------------------------------
-- Eksik giderme: (1) yorum düzenle/sil RPC'leri, (2) kullanıcı engelleme,
-- (3) native push altyapısı (token tablosu + gönderici tetikleyici).
-- ---------------------------------------------------------------------------

-- =========================================================================
-- 1) YORUM DÜZENLE / SİL — reviews yalnız SELECT+INSERT policy'sine sahipti.
--    Sahibinin düzenleyip silebilmesi için SECURITY DEFINER RPC'ler (anti-fraud
--    tasarımı korunur: yalnız reviewer_id=auth.uid() olan satırı etkiler).
--    Silme = soft delete (deleted_at); rating tetikleyicisi zaten deleted_at'i dışlar.
-- =========================================================================
create or replace function public.edit_own_review(p_review_id uuid, p_rating int, p_comment text)
returns boolean language plpgsql security definer set search_path to 'public' as $fn$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;
  if p_rating < 1 or p_rating > 5 then return false; end if;
  if p_comment is null or length(btrim(p_comment)) = 0 then return false; end if;
  update public.reviews
    set rating = p_rating, comment = btrim(p_comment)
    where id = p_review_id and reviewer_id = v_uid and deleted_at is null;
  return found;
end;
$fn$;

create or replace function public.delete_own_review(p_review_id uuid)
returns boolean language plpgsql security definer set search_path to 'public' as $fn$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then return false; end if;
  update public.reviews set deleted_at = now()
    where id = p_review_id and reviewer_id = v_uid and deleted_at is null;
  return found;
end;
$fn$;

grant execute on function public.edit_own_review(uuid, int, text) to authenticated;
grant execute on function public.delete_own_review(uuid) to authenticated;

-- =========================================================================
-- 2) KULLANICI ENGELLEME — blocked_users + is_blocked() + mesaj RESTRICTIVE policy.
--    Şema-var-UI-yok durumundaki 'blocked' yerine gerçek engelleme.
-- =========================================================================
create table if not exists public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);
alter table public.blocked_users enable row level security;

drop policy if exists "manage own blocks" on public.blocked_users;
create policy "manage own blocks" on public.blocked_users
  for all using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

grant select, insert, delete on public.blocked_users to authenticated;

-- İki kullanıcı arasında (her iki yönde) engel var mı? SECURITY DEFINER: RLS'e takılmadan bakar.
create or replace function public.is_blocked(a uuid, b uuid)
returns boolean language sql security definer set search_path to 'public' stable as $fn$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$fn$;
grant execute on function public.is_blocked(uuid, uuid) to authenticated, anon;

-- Engellenen taraf mesaj GÖNDEREMEZ: RESTRICTIVE policy (mevcut permissive'lerle AND'lenir).
drop policy if exists "blocked cannot send" on public.messages;
create policy "blocked cannot send" on public.messages
  as restrictive for insert to authenticated
  with check (receiver_id is null or not public.is_blocked(sender_id, receiver_id));

-- =========================================================================
-- 3) NATIVE PUSH — token tablosu + notifications INSERT → Expo push gönderimi.
--    İçerik SUNUCU-taraflı ve GENELDİR (kilit ekranı phishing engeli), e-posta
--    ile aynı whitelist/limit. Token yoksa sessiz no-op → web/eski cihaz etkilenmez.
-- =========================================================================
create table if not exists public.push_tokens (
  user_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);
alter table public.push_tokens enable row level security;

drop policy if exists "manage own push tokens" on public.push_tokens;
create policy "manage own push tokens" on public.push_tokens
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

grant select, insert, update, delete on public.push_tokens to authenticated;

create or replace function private.push_on_notification()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_title text; v_body text; v_recent int; v_tok record;
begin
  if new.type not in ('application', 'message', 'sale', 'payout', 'lead', 'review', 'price_drop', 'sold', 'follow') then return new; end if;

  -- Aynı kullanıcıya push seli olmasın: saatte 10, mesaj 5dk throttle.
  select count(*) into v_recent from public.notifications
  where user_id = new.user_id and created_at > now() - interval '1 hour';
  if v_recent > 10 then return new; end if;
  if new.type = 'message' and exists (
    select 1 from public.notifications
    where user_id = new.user_id and type = 'message' and id <> new.id
      and created_at > now() - interval '5 minutes') then
    return new;
  end if;

  -- SUNUCU-taraflı genel başlık (client title/body kilit ekranına sızmaz).
  case new.type
    when 'message'    then v_title := 'OrtakSat'; v_body := 'Yeni mesajın var';
    when 'application' then v_title := 'OrtakSat'; v_body := 'Ortaklık güncellemesi';
    when 'sale'        then v_title := 'OrtakSat'; v_body := 'Satış/komisyon güncellemesi';
    when 'payout'      then v_title := 'OrtakSat'; v_body := 'Ödeme bildirimi';
    when 'lead'        then v_title := 'OrtakSat'; v_body := 'Yeni talep var';
    when 'review'      then v_title := 'OrtakSat'; v_body := 'Yeni değerlendirme aldın';
    when 'price_drop'  then v_title := 'OrtakSat'; v_body := 'Favorinde fiyat düştü';
    when 'sold'        then v_title := 'OrtakSat'; v_body := 'Favorindeki ürün satıldı';
    when 'follow'      then v_title := 'OrtakSat'; v_body := 'Takip ettiğin satıcıdan yeni ilan';
    else v_title := 'OrtakSat'; v_body := 'Yeni bir gelişme var';
  end case;

  for v_tok in select token from public.push_tokens where user_id = new.user_id loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := jsonb_build_object('to', v_tok.token, 'title', v_title, 'body', v_body, 'sound', 'default',
                                 'data', jsonb_build_object('type', new.type))
    );
  end loop;
  return new;
exception when others then
  return new;
end;
$fn$;

drop trigger if exists push_on_notification on public.notifications;
create trigger push_on_notification
  after insert on public.notifications
  for each row execute function private.push_on_notification();
