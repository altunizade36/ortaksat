-- Anlık bildirim kalitesi (2026-11-25)
-- 1) Mesaj kısıtlaması SOHBET BAŞINA: eskiden son 5 dakikada HERHANGİ bir sohbetten mesaj bildirimi
--    gittiyse ikinci kişinin mesajı hiç push almıyordu.
-- 2) Android'de açılır bildirim: priority=high + channelId=default (uygulama kanalı HIGH önemle kurar).
-- 3) Uygulama simgesinde okunmamış bildirim sayısı (badge).
-- Başlık/metin bilinçli olarak genel kalır (kilit ekranına mesaj içeriği sızmaz).
create or replace function private.push_on_notification()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_title text; v_body text; v_recent int; v_tok record; v_prefs jsonb; v_badge int;
begin
  select preferences into v_prefs from public.profiles where id=new.user_id;
  if not public.mobile_notification_enabled(coalesce(v_prefs,'{}'::jsonb),new.type::text) or (new.type='message' and coalesce(v_prefs->>'notify_message_inapp_only','false')='true') then return new; end if;
  if new.type not in ('application', 'message', 'sale', 'payout', 'lead', 'review', 'price_drop', 'sold', 'follow', 'offer', 'question') then return new; end if;

  -- Push seli olmasın: saatte en çok 10.
  select count(*) into v_recent from public.notifications
  where user_id = new.user_id and created_at > now() - interval '1 hour';
  if v_recent > 10 then return new; end if;
  -- Mesaj: AYNI sohbetten 5 dk içinde ikinci push gönderilmez (farklı sohbetler etkilenmez).
  if new.type = 'message' and exists (
    select 1 from public.notifications
    where user_id = new.user_id and type = 'message' and id <> new.id
      and created_at > now() - interval '5 minutes'
      and coalesce(metadata->>'conversationId','') = coalesce(new.metadata->>'conversationId','')) then
    return new;
  end if;

  case new.type
    when 'message'     then v_title := 'OrtakSat'; v_body := 'Yeni mesajın var';
    when 'application' then v_title := 'OrtakSat'; v_body := 'Ortaklık güncellemesi';
    when 'sale'        then v_title := 'OrtakSat'; v_body := 'Satış/komisyon güncellemesi';
    when 'payout'      then v_title := 'OrtakSat'; v_body := 'Ödeme bildirimi';
    when 'lead'        then v_title := 'OrtakSat'; v_body := 'Yeni talep var';
    when 'review'      then v_title := 'OrtakSat'; v_body := 'Yeni değerlendirme aldın';
    when 'price_drop'  then v_title := 'OrtakSat'; v_body := 'Favorinde fiyat düştü';
    when 'sold'        then v_title := 'OrtakSat'; v_body := 'Favorindeki ürün satıldı';
    when 'follow'      then v_title := 'OrtakSat'; v_body := 'Takip ettiğin satıcıdan yeni ilan';
    when 'offer'       then v_title := 'OrtakSat'; v_body := 'Teklif güncellemesi var';
    when 'question'    then v_title := 'OrtakSat'; v_body := 'İlan sorusu/yanıtı';
    else v_title := 'OrtakSat'; v_body := 'Yeni bir gelişme var';
  end case;

  select count(*) into v_badge from public.notifications where user_id = new.user_id and read = false;

  for v_tok in select token from public.push_tokens where user_id = new.user_id loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := jsonb_build_object('to', v_tok.token, 'title', v_title, 'body', v_body, 'sound', 'default',
                                 'priority', 'high', 'channelId', 'default', 'badge', least(v_badge, 99),
                                 'data', jsonb_build_object('type', new.type,'notificationId',new.id))
    );
  end loop;
  return new;
exception when others then
  return new;
end;
$function$;
