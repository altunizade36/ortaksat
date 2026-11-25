-- ŞİKÂYET GELİNCE YÖNETİCİYE HABER (App Store kuralı 1.2: şikâyetler 24 saat içinde incelenir).
-- Şikâyetler yönetim panelinde listeleniyordu ama yöneticiye haber GİTMİYORDU → panel açılmadıkça fark edilmiyordu.
-- Her yeni kayıtta yönetici/moderatörlere uygulama içi bildirim; en çok üç saatte bir telefon bildirimi + e-posta
-- (inceleme kuyruğu bildirimiyle aynı kural). Gönderim hatası şikâyet kaydını engellemez.
create or replace function private.notify_admins_report() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare
  r record; v_tok record; v_loud boolean; v_open int;
  v_key text; v_from text; v_site text; v_email text;
begin
  select count(*) into v_open from public.reports where status::text in ('open', 'pending', 'new');
  for r in
    select p.id, coalesce(p.email_notifications, true) as optin
    from public.profiles p
    where p.role in ('admin', 'super_admin', 'moderator') and p.status = 'active' and p.id is distinct from new.reporter_id
  loop
    v_loud := not exists (
      select 1 from public.notifications n
      where n.user_id = r.id and n.metadata ->> 'kind' = 'report' and n.metadata ->> 'loud' = 'true'
        and n.created_at > now() - interval '3 hours'
    );
    insert into public.notifications (user_id, type, title, body, metadata)
    values (r.id, 'system', 'Yeni şikâyet var',
            format('Bir kullanıcı şikâyet gönderdi: %s. Yönetim panelindeki şikâyetler bölümünden 24 saat içinde incele.', left(coalesce(new.reason, 'gerekçe belirtilmedi'), 80)),
            jsonb_build_object('reportId', new.id, 'kind', 'report', 'loud', v_loud));
    if v_loud then
      begin
        for v_tok in select token from public.push_tokens where user_id = r.id loop
          perform net.http_post(
            url := 'https://exp.host/--/api/v2/push/send',
            headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
            body := jsonb_build_object('to', v_tok.token, 'title', 'OrtakSat', 'body', 'İncelenmeyi bekleyen şikâyet var', 'sound', 'default',
                                       'data', jsonb_build_object('type', 'system', 'kind', 'report')));
        end loop;
        if r.optin then
          select value into v_key from private.integration_secrets where name = 'RESEND_API_KEY';
          select email into v_email from auth.users where id = r.id;
          if coalesce(v_key, '') <> '' and v_email is not null then
            select value into v_from from private.integration_secrets where name = 'EMAIL_FROM';
            select value into v_site from private.integration_secrets where name = 'SITE_URL';
            v_from := coalesce(nullif(v_from, ''), 'OrtakSat <bildirim@ortaksat.com>');
            v_site := coalesce(nullif(v_site, ''), 'https://ortaksat.com');
            perform net.http_post(
              url := 'https://api.resend.com/emails',
              headers := jsonb_build_object('Authorization', 'Bearer ' || v_key, 'Content-Type', 'application/json'),
              body := jsonb_build_object('from', v_from, 'to', v_email,
                'subject', 'OrtakSat yönetim: incelenmeyi bekleyen şikâyet var',
                'html', format('<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;padding:24px"><h1 style="font-size:18px;color:#0F172A">Yeni şikâyet var</h1><p style="font-size:14px;line-height:22px;color:#475569">Bir kullanıcı şikâyet gönderdi. Şikâyetler 24 saat içinde incelenmelidir; uygunsuz içerik kaldırılır, kuralları çiğneyen hesap kapatılır.</p><a href="%s/admin" style="display:inline-block;background:#0645C9;color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:700;padding:11px 20px;border-radius:10px">Yönetim panelini aç</a><p style="font-size:11px;color:#94A3B8;margin-top:20px">Bu e-posta yalnız yönetici ve moderatör hesaplarına gönderilir; en çok üç saatte bir gelir.</p></div>', v_site)));
          end if;
        end if;
      exception when others then null;
      end;
    end if;
  end loop;
  return new;
exception when others then
  return new; -- bildirim hatası şikâyet kaydını ASLA engellemez
end $$;
revoke execute on function private.notify_admins_report() from public, anon, authenticated;
drop trigger if exists trg_notify_admins_report on public.reports;
create trigger trg_notify_admins_report after insert on public.reports
  for each row execute function private.notify_admins_report();
