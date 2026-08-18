-- ---------------------------------------------------------------------------
-- EKSİK GİDERME (native push): push_on_notification tetikleyicisinin tür beyaz-listesi
-- BAYATTI — 'offer' (teklif/karşı-teklif) ve 'question' (ilan soru-cevap) türleri
-- push altyapısından SONRA eklendi → bu bildirimler push GÖNDERMİYORDU. Satıcı karşı
-- teklif verince alıcı, ilana soru gelince satıcı native push almıyordu (yalnız uygulama-içi).
-- Whitelist + genel (kilit-ekranı-güvenli) gövdeler eklenir. 'system' bilinçli hariç
-- (admin duyurusu; push seli olmasın). Diğer her şey aynen korunur.
-- ---------------------------------------------------------------------------
create or replace function private.push_on_notification()
returns trigger language plpgsql security definer set search_path to 'public' as $fn$
declare
  v_title text; v_body text; v_recent int; v_tok record;
begin
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
                                 'data', jsonb_build_object('type', new.type))
    );
  end loop;
  return new;
exception when others then
  return new;
end;
$fn$;
