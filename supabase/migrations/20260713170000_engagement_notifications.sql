-- ---------------------------------------------------------------------------
-- ETKİLEŞİM BİLDİRİMLERİ — favori ve takip özelliklerini "ölü uç" olmaktan çıkarır.
-- Üç sunucu-taraflı tetikleyici (hangi istemci güncellerse güncellesin çalışır):
--   1) FİYAT DÜŞTÜ  → ilanı favorileyen herkese bildir (yeni fiyat < eski fiyat)
--   2) SATILDI      → ilanı favorileyenlere "kaçırdın" bildirimi
--   3) YENİ İLAN    → satıcıyı takip edenlere, satıcı yeni ilan yayınlayınca bildir
-- Bildirim içeriği GENELDİR; deep-link için metadata.listingId taşır. notify eden
-- fonksiyonlar SECURITY DEFINER (başka kullanıcıya notification INSERT'i için RLS aşımı).
-- E-posta: price_drop + sold whitelist'e eklenir (follow yalnız uygulama-içi, spam olmasın).
-- ---------------------------------------------------------------------------

-- 1) FİYAT DÜŞÜŞÜ — favorileyene bildir
create or replace function public.notify_price_drop()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if new.status = 'active' and new.price is not null and old.price is not null and new.price < old.price then
    insert into public.notifications (user_id, type, title, body, metadata)
    select f.user_id, 'price_drop', 'Favorindeki üründe fiyat düştü',
           format('"%s" ilanının fiyatı düştü. Kaçırmadan incele.', new.title),
           jsonb_build_object('listingId', new.id)
    from public.favorites f
    where f.listing_id = new.id and f.user_id <> new.owner_id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_notify_price_drop on public.listings;
create trigger trg_notify_price_drop
  after update of price on public.listings
  for each row execute function public.notify_price_drop();

-- 2) SATILDI — favorileyene bildir
create or replace function public.notify_listing_sold()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if new.status = 'sold' and old.status is distinct from 'sold' then
    insert into public.notifications (user_id, type, title, body, metadata)
    select f.user_id, 'sold', 'Favorindeki ürün satıldı',
           format('"%s" ilanı satıldı. Benzer ilanlara göz atabilirsin.', new.title),
           jsonb_build_object('listingId', new.id)
    from public.favorites f
    where f.listing_id = new.id and f.user_id <> new.owner_id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_notify_listing_sold on public.listings;
create trigger trg_notify_listing_sold
  after update of status on public.listings
  for each row execute function public.notify_listing_sold();

-- 3) TAKİP EDİLEN SATICI YENİ İLAN — takipçilere bildir (ilan 'active' olduğunda)
create or replace function public.notify_followers_new_listing()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  -- Yalnızca İLK yayın: doğrudan aktif INSERT veya taslak/inceleme→aktif geçiş.
  -- (paused→active yeniden-yayını takipçilere "yeni ilan" gibi spam OLMASIN.)
  if new.status = 'active' and (tg_op = 'INSERT' or old.status in ('draft', 'pending_review')) then
    insert into public.notifications (user_id, type, title, body, metadata)
    select fl.follower_id, 'follow', 'Takip ettiğin satıcıdan yeni ilan',
           format('Takip ettiğin bir satıcı "%s" ilanını yayınladı.', new.title),
           jsonb_build_object('listingId', new.id)
    from public.follows fl
    where fl.seller_id = new.owner_id and fl.follower_id <> new.owner_id;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_notify_followers_new_listing on public.listings;
create trigger trg_notify_followers_new_listing
  after insert or update of status on public.listings
  for each row execute function public.notify_followers_new_listing();

-- E-posta whitelist'e price_drop + sold ekle (follow uygulama-içi kalır).
create or replace function private.email_on_notification()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_email text; v_optin boolean; v_key text; v_from text; v_site text;
  v_subject text; v_lead text; v_html text; v_recent int;
begin
  if new.type not in ('application', 'message', 'sale', 'payout', 'lead', 'review', 'price_drop', 'sold') then return new; end if;

  select count(*) into v_recent from public.notifications
  where user_id = new.user_id
    and type in ('application', 'message', 'sale', 'payout', 'lead', 'review', 'price_drop', 'sold')
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
