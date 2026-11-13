-- Riskli ilan uyarısı: yönetici/moderatöre uygulama içi bildirime ek olarak E-POSTA ve telefon bildirimi.
--
-- Önceki sürüm yalnız uygulama içi bildirim yazıyordu; yönetici siteye girmedikçe haberi olmuyordu.
-- Kurallar:
--  * Uygulama içi bildirim: kişi başına 30 dakikada en çok bir (değişmedi).
--  * E-posta + telefon bildirimi: kişi başına 3 saatte en çok bir; e-posta kuyruğun güncel sayısını söyler.
--  * E-posta kişisel ayrıntı (ilan başlığı, satıcı) içermez; yalnız "kuyrukta N ilan bekliyor" der.
--  * Gönderim hatası ilan kaydını ASLA engellemez (hata yutulur).

create or replace function private.notify_admins_listing_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  v_key text; v_from text; v_site text; v_html text; v_subject text; v_lead text;
  v_waiting int; v_loud boolean; v_email text; v_tok record;
begin
  if not (new.status = 'pending_review' and (tg_op = 'INSERT' or old.status is distinct from 'pending_review')) then
    return new;
  end if;

  select count(*) into v_waiting from public.listings where status = 'pending_review';

  for r in
    select p.id, coalesce(p.email_notifications, true) as optin
    from public.profiles p
    where p.role in ('admin', 'super_admin', 'moderator') and p.status = 'active'
      and not exists (
        select 1 from public.notifications n
        where n.user_id = p.id and n.metadata ->> 'kind' = 'listing_review' and n.created_at > now() - interval '30 minutes'
      )
  loop
    -- Bu kişiye son 3 saatte e-posta/telefon bildirimi gitmediyse bu bildirim "sesli" olur.
    v_loud := not exists (
      select 1 from public.notifications n
      where n.user_id = r.id and n.metadata ->> 'kind' = 'listing_review' and n.metadata ->> 'loud' = 'true'
        and n.created_at > now() - interval '3 hours'
    );

    insert into public.notifications (user_id, type, title, body, metadata)
    values (
      r.id, 'system', 'İncelenmesi gereken ilan var',
      format('"%s" ilanı otomatik taramaya takıldığı için yayına alınmadı. Yönetim panelindeki inceleme kuyruğundan kontrol et.', left(new.title, 60)),
      jsonb_build_object('listingId', new.id, 'kind', 'listing_review', 'loud', v_loud)
    );

    if v_loud then
      begin
        -- telefon bildirimi (uygulama kuruluysa)
        for v_tok in select token from public.push_tokens where user_id = r.id loop
          perform net.http_post(
            url := 'https://exp.host/--/api/v2/push/send',
            headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
            body := jsonb_build_object('to', v_tok.token, 'title', 'OrtakSat', 'body', 'İnceleme kuyruğunda bekleyen ilan var', 'sound', 'default',
                                       'data', jsonb_build_object('type', 'system', 'kind', 'listing_review'))
          );
        end loop;

        -- e-posta
        if r.optin then
          select value into v_key from private.integration_secrets where name = 'RESEND_API_KEY';
          select email into v_email from auth.users where id = r.id;
          if coalesce(v_key, '') <> '' and v_email is not null then
            select value into v_from from private.integration_secrets where name = 'EMAIL_FROM';
            select value into v_site from private.integration_secrets where name = 'SITE_URL';
            v_from := coalesce(nullif(v_from, ''), 'OrtakSat <bildirim@ortaksat.com>');
            v_site := coalesce(nullif(v_site, ''), 'https://ortaksat.com');
            v_subject := format('OrtakSat yönetim: inceleme kuyruğunda %s ilan bekliyor', v_waiting);
            v_lead := format('Otomatik taramaya takılan ilanlar yayına alınmadan inceleme kuyruğuna düştü. Şu anda kuyrukta %s ilan bekliyor. Diğer ilanlar kendiliğinden yayınlanmaya devam ediyor; yalnız bu kuyruktakiler senin kararını bekliyor.', v_waiting);
            v_html := format($html$<div style="margin:0;padding:24px;background:#F4F6F8;font-family:Inter,-apple-system,Segoe UI,Roboto,Arial,sans-serif"><div style="max-width:520px;margin:0 auto;background:#FFFFFF;border:1px solid #E6EAEE;border-radius:16px;overflow:hidden"><div style="background:linear-gradient(135deg,#0645C9,#09275E);padding:20px 24px"><span style="color:#FFFFFF;font-size:20px;font-weight:800">Ortak<span style="color:#E5F0FF">Sat</span></span></div><div style="padding:24px"><h1 style="margin:0 0 10px;font-size:18px;font-weight:800;color:#0F172A">İncelenmesi gereken ilan var</h1><p style="margin:0 0 20px;font-size:14px;line-height:22px;color:#475569">%s</p><a href="%s/admin" style="display:inline-block;background:#0645C9;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;padding:11px 20px;border-radius:10px">İnceleme kuyruğunu aç</a></div><div style="padding:16px 24px;border-top:1px solid #EEF1F4;background:#FAFBFC"><p style="margin:0;font-size:11px;line-height:16px;color:#94A3B8">Bu e-posta yalnız yönetici ve moderatör hesaplarına gönderilir; en çok üç saatte bir gelir. İlan ayrıntılarını giriş yaptıktan sonra yönetim panelinde görürsün.</p></div></div></div>$html$, v_lead, v_site);
            perform net.http_post(
              url := 'https://api.resend.com/emails',
              headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
              body := jsonb_build_object('from', v_from, 'to', v_email, 'subject', v_subject, 'html', v_html)
            );
          end if;
        end if;
      exception when others then
        null; -- gönderim hatası ilan kaydını engellemez
      end;
    end if;
  end loop;
  return new;
end;
$$;
