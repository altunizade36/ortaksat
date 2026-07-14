-- ---------------------------------------------------------------------------
-- YAPILANDIRILMIŞ TEKLİF SİSTEMİ
--
-- SORUN: Alıcı yalnızca sohbete SERBEST METİN yazabiliyordu ("fiyat teklifim ₺___").
-- Satıcı bunu takip edemiyor, kabul/ret edemiyor, panelinde göremiyor; teklifler
-- mesaj geçmişinde kayboluyordu. Pazaryerlerinde (Sahibinden/Letgo) teklif ayrı ve
-- yapılandırılmış bir nesnedir — dönüşümün ana kaldıracı.
--
-- NOT: `leads` tablosu bu iş İÇİN DEĞİL — o ORTAK ATIFI içindir (partnership_id,
-- source, intent; buyer_id ve tutar yok). Teklif ayrı bir kavram: kayıtlı alıcının
-- ilana doğrudan verdiği, tutarı olan, durum makinesi olan bir öneri.
--
-- PARA MODELİ: Platform para TUTMAZ. Teklif kabul edilse bile ödeme/teslimat taraflar
-- arasındadır; burada tutulan yalnızca ANLAŞMA KAYDIdır (kim, ne zaman, kaça).
-- ---------------------------------------------------------------------------

create table if not exists public.offers (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings(id) on delete cascade,
  buyer_id uuid not null references public.profiles(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  amount numeric not null check (amount > 0),
  note text,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'rejected', 'countered', 'withdrawn')),
  counter_amount numeric check (counter_amount is null or counter_amount > 0),
  responded_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists offers_listing_idx on public.offers (listing_id, created_at desc);
create index if not exists offers_seller_idx on public.offers (seller_id, status, created_at desc);
create index if not exists offers_buyer_idx on public.offers (buyer_id, created_at desc);

-- Bir alıcı aynı ilana AYNI ANDA yalnız BİR bekleyen teklif verebilir (spam engeli).
create unique index if not exists offers_one_pending_per_buyer
  on public.offers (listing_id, buyer_id) where status = 'pending';

alter table public.offers enable row level security;

-- ALICI: kendi teklifini oluşturur. Kendi ilanına teklif VEREMEZ; ilan aktif olmalı.
drop policy if exists "buyer creates own offer" on public.offers;
create policy "buyer creates own offer" on public.offers
  for insert to authenticated
  with check (
    buyer_id = (select auth.uid())
    and buyer_id <> seller_id
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = seller_id and l.status = 'active' and coalesce(l.demo, false) = false
    )
  );

-- OKUMA: yalnız teklifin tarafları (alıcı veya satıcı).
drop policy if exists "parties read offers" on public.offers;
create policy "parties read offers" on public.offers
  for select to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

-- GÜNCELLEME: satıcı yanıtlar (kabul/ret/karşı teklif), alıcı geri çeker.
-- Durum geçişleri RPC ile zorlanır; policy yalnız TARAF kontrolü yapar.
drop policy if exists "parties update offers" on public.offers;
create policy "parties update offers" on public.offers
  for update to authenticated
  using (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()))
  with check (buyer_id = (select auth.uid()) or seller_id = (select auth.uid()));

grant select, insert, update on public.offers to authenticated;

-- ---------------------------------------------------------------------------
-- BİLDİRİMLER (sunucu tarafı — hangi istemci yazarsa yazsın çalışır)
-- ---------------------------------------------------------------------------
create or replace function public.notify_offer_created()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_title text; v_buyer text;
begin
  select title into v_title from public.listings where id = new.listing_id;
  select full_name into v_buyer from public.profiles where id = new.buyer_id;
  insert into public.notifications (user_id, type, title, body, metadata)
  values (
    new.seller_id, 'offer', 'Yeni teklif aldın',
    format('%s, "%s" ilanına %s ₺ teklif verdi.', coalesce(v_buyer, 'Bir alıcı'), coalesce(v_title, 'ilan'), trim(to_char(new.amount, 'FM999G999G999'))),
    jsonb_build_object('listingId', new.listing_id, 'offerId', new.id)
  );
  return new;
end;
$fn$;

drop trigger if exists trg_notify_offer_created on public.offers;
create trigger trg_notify_offer_created
  after insert on public.offers
  for each row execute function public.notify_offer_created();

create or replace function public.notify_offer_answered()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare v_title text; v_body text;
begin
  if new.status = old.status then return new; end if;
  select title into v_title from public.listings where id = new.listing_id;
  if new.status = 'accepted' then
    v_body := format('"%s" ilanındaki %s ₺ teklifin KABUL EDİLDİ. Satıcıyla mesajlaşarak teslimatı ayarla.', coalesce(v_title, 'ilan'), trim(to_char(new.amount, 'FM999G999G999')));
  elsif new.status = 'rejected' then
    v_body := format('"%s" ilanındaki teklifin kabul edilmedi.', coalesce(v_title, 'ilan'));
  elsif new.status = 'countered' then
    v_body := format('Satıcı "%s" için %s ₺ karşı teklif verdi.', coalesce(v_title, 'ilan'), trim(to_char(coalesce(new.counter_amount, 0), 'FM999G999G999')));
  else
    return new; -- withdrawn → alıcının kendi işlemi, bildirim gerekmez
  end if;
  insert into public.notifications (user_id, type, title, body, metadata)
  values (new.buyer_id, 'offer', 'Teklifin yanıtlandı', v_body,
          jsonb_build_object('listingId', new.listing_id, 'offerId', new.id));
  return new;
end;
$fn$;

drop trigger if exists trg_notify_offer_answered on public.offers;
create trigger trg_notify_offer_answered
  after update of status on public.offers
  for each row execute function public.notify_offer_answered();

-- 'offer' tipini e-posta whitelist'ine ekle (içerik yine SUNUCU-taraflı ve genel).
create or replace function private.email_on_notification()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_email text; v_optin boolean; v_key text; v_from text; v_site text;
  v_subject text; v_lead text; v_html text; v_recent int;
begin
  if new.type not in ('application', 'message', 'sale', 'payout', 'lead', 'review', 'price_drop', 'sold', 'offer') then return new; end if;

  select count(*) into v_recent from public.notifications
  where user_id = new.user_id
    and type in ('application', 'message', 'sale', 'payout', 'lead', 'review', 'price_drop', 'sold', 'offer')
    and created_at > now() - interval '1 hour';
  if v_recent > 6 then return new; end if;

  if new.type = 'message' then
    if exists (select 1 from public.notifications
               where user_id = new.user_id and type = 'message' and id <> new.id
                 and created_at > now() - interval '15 minutes') then
      return new;
    end if;
  end if;

  select value into v_key from private.integration_secrets where name = 'RESEND_API_KEY';
  if v_key is null or v_key = '' then return new; end if;
  select email into v_email from auth.users where id = new.user_id;
  if v_email is null then return new; end if;
  select coalesce(email_notifications, true) into v_optin from public.profiles where id = new.user_id;
  if v_optin is false then return new; end if;

  select value into v_from from private.integration_secrets where name = 'EMAIL_FROM';
  select value into v_site from private.integration_secrets where name = 'SITE_URL';
  v_from := coalesce(nullif(v_from, ''), 'OrtakSat <bildirim@ortaksat.com>');
  v_site := coalesce(nullif(v_site, ''), 'https://ortaksat.com');

  case new.type
    when 'message'    then v_subject := 'OrtakSat: yeni mesajın var';            v_lead := 'Hesabına yeni bir mesaj geldi. Okumak için OrtakSat''a giriş yap.';
    when 'application' then v_subject := 'OrtakSat: ortaklık güncellemesi';       v_lead := 'Ortaklık başvurularında veya durumunda bir güncelleme var. Ayrıntılar için giriş yap.';
    when 'sale'        then v_subject := 'OrtakSat: satış/komisyon güncellemesi'; v_lead := 'Bir satış veya komisyon kaydında güncelleme var. Ayrıntılar için giriş yap.';
    when 'payout'      then v_subject := 'OrtakSat: ödeme bildirimi';             v_lead := 'Komisyon/ödeme durumunda bir güncelleme var. Ayrıntılar için giriş yap.';
    when 'lead'        then v_subject := 'OrtakSat: yeni talep';                  v_lead := 'İlgili bir ilanda yeni bir alıcı talebi var. Ayrıntılar için giriş yap.';
    when 'review'      then v_subject := 'OrtakSat: yeni değerlendirme';          v_lead := 'Hakkında yeni bir değerlendirme (yorum/puan) var. Görmek için giriş yap.';
    when 'price_drop'  then v_subject := 'OrtakSat: favorinde fiyat düştü';       v_lead := 'Favori listendeki bir üründe fiyat düştü. İncelemek için giriş yap.';
    when 'sold'        then v_subject := 'OrtakSat: favorindeki ürün satıldı';    v_lead := 'Favori listendeki bir ürün satıldı. Benzerlerine bakmak için giriş yap.';
    when 'offer'       then v_subject := 'OrtakSat: teklif bildirimi';            v_lead := 'Bir ilanda teklifle ilgili bir gelişme var. Ayrıntılar için giriş yap.';
    else v_subject := 'OrtakSat bildirimi'; v_lead := 'Hesabında yeni bir gelişme var. Ayrıntılar için giriş yap.';
  end case;

  v_html := format($html$<div style="margin:0;padding:24px;background:#F4F6F8;font-family:Inter,-apple-system,Segoe UI,Roboto,Arial,sans-serif"><div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E6EAEE;border-radius:16px;overflow:hidden"><div style="background:linear-gradient(135deg,#00866F,#075E54);padding:20px 24px"><span style="color:#FFFFFF;font-size:20px;font-weight:800">Ortak<span style="color:#CFF3EA">Sat</span></span></div><div style="padding:24px"><h1 style="margin:0 0 10px;font-size:18px;font-weight:800;color:#0F172A">%s</h1><p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#475569">%s</p><a href="%s/notifications" style="display:inline-block;background:#00866F;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;padding:11px 20px;border-radius:10px">OrtakSat'a giriş yap</a></div><div style="padding:16px 24px;border-top:1px solid #EEF1F4;background:#FAFBFC"><p style="margin:0;font-size:11px;line-height:16px;color:#94A3B8">Güvenliğin için bu e-posta hiçbir kişisel ayrıntı veya bağlantı içermez; tüm bilgiyi yalnızca giriş yaptıktan sonra uygulamada görürsün. OrtakSat sana asla şifre/kod sormaz. Destek: destek@ortaksat.com.</p></div></div></div>$html$, v_subject, v_lead, v_site);

  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
    body := jsonb_build_object('from', v_from, 'to', v_email, 'subject', v_subject, 'html', v_html)
  );
  return new;
exception when others then
  return new;
end;
$fn$;
