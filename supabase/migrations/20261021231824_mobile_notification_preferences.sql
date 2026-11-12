create or replace function public.mobile_notification_enabled(prefs jsonb,kind text)
returns boolean language sql immutable security invoker set search_path='' as $$
select coalesce(prefs->>'notify_all_off','false')<>'true'
 and coalesce(prefs->>('notify_'||case
   when kind='message' then 'messages'
   when kind in ('application','lead','sale','payout') then 'partnerships'
   when kind in ('review','price_drop','sold','offer','question') then 'listings'
   else 'system' end),'true')<>'false'
 and coalesce(prefs->>('notify_type_'||kind),'true')<>'false'
$$;
revoke all on function public.mobile_notification_enabled(jsonb,text) from public,anon;
grant execute on function public.mobile_notification_enabled(jsonb,text) to authenticated;

-- Internal trigger reads recipient preferences; it never returns private profile data.
create or replace function private.mobile_notification_preference_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare prefs jsonb;
begin
 if auth.uid() is null and coalesce(auth.role(),'')<>'service_role' and session_user not in ('postgres','supabase_admin') then return new; end if;
 select p.preferences into prefs from public.profiles p where p.id=new.user_id;
 if not public.mobile_notification_enabled(coalesce(prefs,'{}'::jsonb),new.type::text) then return null; end if;
 return new;
end $$;
revoke all on function private.mobile_notification_preference_guard() from public,anon,authenticated;
drop trigger if exists mobile_notification_preference_guard on public.notifications;
create trigger mobile_notification_preference_guard before insert on public.notifications for each row execute function private.mobile_notification_preference_guard();

create or replace function private.push_on_notification()
returns trigger language plpgsql security definer set search_path = '' as $fn$
declare
  v_title text; v_body text; v_recent int; v_tok record; v_prefs jsonb;
begin
  select preferences into v_prefs from public.profiles where id=new.user_id;
  if not public.mobile_notification_enabled(coalesce(v_prefs,'{}'::jsonb),new.type::text) or (new.type='message' and coalesce(v_prefs->>'notify_message_inapp_only','false')='true') then return new; end if;
  if new.type not in ('application', 'message', 'sale', 'payout', 'lead', 'review', 'price_drop', 'sold', 'follow', 'offer', 'question') then return new; end if;

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
    when 'offer'       then v_title := 'OrtakSat'; v_body := 'Teklif güncellemesi var';
    when 'question'    then v_title := 'OrtakSat'; v_body := 'İlan sorusu/yanıtı';
    else v_title := 'OrtakSat'; v_body := 'Yeni bir gelişme var';
  end case;

  for v_tok in select token from public.push_tokens where user_id = new.user_id loop
    perform net.http_post(
      url := 'https://exp.host/--/api/v2/push/send',
      headers := jsonb_build_object('Content-Type', 'application/json', 'Accept', 'application/json'),
      body := jsonb_build_object('to', v_tok.token, 'title', v_title, 'body', v_body, 'sound', 'default',
                                 'data', jsonb_build_object('type', new.type,'notificationId',new.id))
    );
  end loop;
  return new;
exception when others then
  return new;
end;
$fn$;

revoke all on function private.push_on_notification() from public,anon,authenticated;
