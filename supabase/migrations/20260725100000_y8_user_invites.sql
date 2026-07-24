-- Y8 — ARKADAŞINI DAVET ET / DAVETLE KAZAN (kullanıcı-daveti büyüme akışı)
-- Cold-start büyüme motoru; ortaklık modeliyle uyumlu. Platform PARA TUTMAZ → "kazanç"
-- SAHTE ÖDEME DEĞİL: davet edilenler platforma katıldıkça ağ büyür (davet ettiğin kişi
-- ürünlerine ortak olabilir ya da sen onun ilanına ortak olup komisyon kazanabilirsin).
-- Not: mevcut referral_* altyapısı ÜRÜN-ortaklığı içindir (ilan-bazlı); bu KULLANICI-daveti.

-- 1) profiles: kişisel davet kodu + davet eden.
alter table public.profiles add column if not exists invite_code text;
alter table public.profiles add column if not exists invited_by uuid references public.profiles(id) on delete set null;

-- Mevcut profilleri benzersiz kodla doldur (10 hex ≈ 1e12 kombinasyon; unique index yakalar).
update public.profiles set invite_code = substr(md5(gen_random_uuid()::text), 1, 10) where invite_code is null;

-- Yeni profiller için default (handle_new_user invite_code vermez → default üretir) + benzersiz + zorunlu.
alter table public.profiles alter column invite_code set default substr(md5(gen_random_uuid()::text), 1, 10);
alter table public.profiles alter column invite_code set not null;
create unique index if not exists profiles_invite_code_key on public.profiles(invite_code);

-- Kendi invite_code'unu okumak için: profiles RLS zaten okunur (public). invited_by de okunur.

-- 2) capture_invite: giriş yapan kullanıcının davet edenini (invited_by) BİR KEZ ayarlar.
--    İlk-dokunuş sabit (zaten varsa dokunmaz), kendi kodu geçersiz.
create or replace function public.capture_invite(p_invite_code text)
returns boolean
language plpgsql
security definer
set search_path to 'public'
as $fn$
declare
  v_me uuid := auth.uid();
  v_inviter uuid;
begin
  if v_me is null or p_invite_code is null or length(btrim(p_invite_code)) = 0 then
    return false;
  end if;
  if exists (select 1 from public.profiles where id = v_me and invited_by is not null) then
    return false;  -- ilk-dokunuş sabit
  end if;
  select id into v_inviter from public.profiles where invite_code = lower(btrim(p_invite_code)) limit 1;
  if v_inviter is null or v_inviter = v_me then
    return false;  -- geçersiz kod veya kendi kodu
  end if;
  update public.profiles set invited_by = v_inviter where id = v_me and invited_by is null;
  return true;
end
$fn$;
grant execute on function public.capture_invite(text) to authenticated;

-- 3) my_invites: davet ettiklerim + durumları (ilan verdi mi / ortak oldu mu).
create or replace function public.my_invites()
returns table(id uuid, full_name text, joined_at timestamptz, has_listing boolean, is_partner boolean)
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select p.id, p.full_name, p.created_at,
    exists (select 1 from public.listings l where l.owner_id = p.id and l.deleted_at is null),
    exists (select 1 from public.partnerships pt where pt.partner_id = p.id)
  from public.profiles p
  where p.invited_by = auth.uid()
  order by p.created_at desc
$fn$;
grant execute on function public.my_invites() to authenticated;
