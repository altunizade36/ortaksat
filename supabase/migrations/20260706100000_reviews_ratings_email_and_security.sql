-- ============================================================================
-- 2026-07-06 — Karşılıklı puanlama + e-posta bildirimleri + güvenlik sertleştirme
-- (Bu oturumda Management API ile canlıya uygulandı; sürüm kontrolü için burada.)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) Alınan seller/partner yorumlarından profiles.rating'i yeniden hesapla.
--    prevent_profile_trust_escalation guard'ına transaction-local sistem bayrağı
--    eklendi (PostgREST istemcileri SET edemez → güvenli).
-- ---------------------------------------------------------------------------
create or replace function private.prevent_profile_trust_escalation()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
begin
  if coalesce(current_setting('app.trusted_rating_update', true), '') = 'on' then
    return new;
  end if;
  if public.is_admin() then
    return new;
  end if;
  if new.verified_identity is distinct from old.verified_identity then
    raise exception 'Only admins can update identity verification';
  end if;
  if new.verified_instagram is distinct from old.verified_instagram then
    raise exception 'Only admins can update Instagram verification';
  end if;
  if new.rating is distinct from old.rating or new.response_rate is distinct from old.response_rate then
    raise exception 'Only system or admins can update profile trust metrics';
  end if;
  if new.phone is distinct from old.phone then
    new.verified_phone = false;
  elsif new.verified_phone is distinct from old.verified_phone then
    raise exception 'Phone verification cannot be edited directly';
  end if;
  return new;
end;
$fn$;

create or replace function private.refresh_user_rating_from_reviews()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare uid uuid; avg_rating numeric;
begin
  uid := coalesce(new.reviewed_user_id, old.reviewed_user_id);
  if uid is null then return coalesce(new, old); end if;
  select round(avg(rating)::numeric, 1) into avg_rating
    from public.reviews
    where reviewed_user_id = uid and type in ('seller', 'partner') and deleted_at is null;
  perform set_config('app.trusted_rating_update', 'on', true);
  update public.profiles set rating = coalesce(avg_rating, rating) where id = uid;
  perform set_config('app.trusted_rating_update', '', true);
  return coalesce(new, old);
end;
$fn$;

drop trigger if exists refresh_user_rating_on_reviews on public.reviews;
create trigger refresh_user_rating_on_reviews
  after insert or update or delete on public.reviews
  for each row execute function private.refresh_user_rating_from_reviews();

-- ---------------------------------------------------------------------------
-- 2) GÜVENLİK: yorum/puan sahtekârlığı engeli. seller/partner yorumu için
--    reviewer ile reviewed_user arasında GERÇEK bir satış (commissions) şart;
--    her satışa reviewer başına tek yorum, ürün yorumunda ilan başına tek.
-- ---------------------------------------------------------------------------
drop policy if exists "users create reviews" on public.reviews;
create policy "users create reviews" on public.reviews
for insert to public
with check (
  reviewer_id = auth.uid()
  and (
    (type = 'product' and reviewed_user_id is null)
    or (type in ('seller', 'partner') and sale_id is not null and exists (
      select 1 from public.commissions c
      join public.partnerships p on p.id = c.partnership_id
      join public.listings l on l.id = c.listing_id
      where c.id = reviews.sale_id
        and ((reviews.reviewer_id = p.partner_id and reviews.reviewed_user_id = l.owner_id)
          or (reviews.reviewer_id = l.owner_id and reviews.reviewed_user_id = p.partner_id))
    ))
  )
);
create unique index if not exists reviews_unique_reviewer_sale
  on public.reviews(reviewer_id, sale_id) where sale_id is not null;
create unique index if not exists reviews_unique_product_per_listing
  on public.reviews(reviewer_id, listing_id) where sale_id is null and type = 'product';

-- ---------------------------------------------------------------------------
-- 3) E-posta bildirim altyapısı: pg_net + gizli anahtar deposu + opt-in.
-- ---------------------------------------------------------------------------
create extension if not exists pg_net;

create table if not exists private.integration_secrets (
  name text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);
revoke all on private.integration_secrets from anon, authenticated;
insert into private.integration_secrets(name, value) values
  ('RESEND_API_KEY', ''),
  ('EMAIL_FROM', 'OrtakSat <bildirim@ortaksat.com>'),
  ('SITE_URL', 'https://ortaksat.com')
on conflict (name) do nothing;

alter table public.profiles add column if not exists email_notifications boolean not null default true;

-- ---------------------------------------------------------------------------
-- 4) Bildirim → e-posta trigger'ı. GÜVENLİK: bildirim client tarafından sahte
--    olabildiği için (notifications INSERT politikası cross-user'a izin verir)
--    e-posta İÇERİĞİ SUNUCU-taraflı ve GENELDİR — client title/body ASLA
--    kullanılmaz (phishing engeli), CTA sabit. Alıcı başına saatlik limit +
--    mesaj 15dk throttle (spam engeli). RESEND_API_KEY boşsa sessizce no-op.
-- ---------------------------------------------------------------------------
create or replace function private.email_on_notification()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_email text; v_optin boolean; v_key text; v_from text; v_site text;
  v_subject text; v_lead text; v_html text; v_recent int;
begin
  if new.type not in ('application', 'message', 'sale', 'payout', 'lead') then return new; end if;

  select count(*) into v_recent from public.notifications
  where user_id = new.user_id
    and type in ('application', 'message', 'sale', 'payout', 'lead')
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

drop trigger if exists email_on_notification on public.notifications;
create trigger email_on_notification
  after insert on public.notifications
  for each row execute function private.email_on_notification();
