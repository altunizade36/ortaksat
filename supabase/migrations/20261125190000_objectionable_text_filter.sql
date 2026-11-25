-- UYGUNSUZ DİL FİLTRESİ (App Store kuralı 1.2: kullanıcı içeriğinde sakıncalı içeriği süzme yöntemi).
-- Yasaklı ÜRÜN taraması (scan_prohibited, ilanlarda) zaten vardı; küfür/cinsel hakaret/nefret söylemi için süzgeç
-- yoktu. Bu süzgeç SUNUCUDA çalışır (istemci atlatamaz): ilan başlığı + açıklaması, mesajlar, satış yorumları
-- (ve satıcı yanıtı), ilan soru-cevapları, profil adı ve tanıtım yazısı.
--
-- Bilinçli sınırlar: yalnız AÇIK küfür ve hakaret kalıpları (tam sözcük eşleşmesi); gündelik sözcüklerle çakışan
-- kısa/çok anlamlı biçimler ("sık", "am", "mal", "piç almak" …) listeye ALINMADI — yanlış engelleme, kaçan bir
-- küfürden daha zararlı (kaçanı şikâyet + engelleme + yönetici incelemesi yakalar). Sunucu işleri (auth.uid() boş)
-- ve yöneticiler muaftır.
create or replace function private.objectionable_text(p_text text) returns boolean
language sql immutable set search_path = public, pg_temp as $$
  with t as (
    select
      -- Türkçe büyük harfler doğru küçülsün (İ→i, I→ı); ı/i BİRLEŞTİRİLMEZ ("sık" ≠ "sik").
      lower(translate(coalesce(p_text, ''), 'İIŞĞÜÖÇ', 'iışğüöç')) as tr,
      lower(coalesce(p_text, '')) as en
  )
  select
    t.tr ~ ('(^|[^[:alnum:]çğıöşü])(' ||
      'siktir[a-zçğıöşü]*|sikeyim|sikerim|sikiyim|sikik|sikim|sikiş[a-zçğıöşü]*|siktiğim[a-zçğıöşü]*|sikti[mn]|' ||
      'amk|amına|amını|amcık[a-zçğıöşü]*|amcığ[a-zçğıöşü]*|' ||
      'orospu[a-zçğıöşü]*|orosbu[a-zçğıöşü]*|oruspu[a-zçğıöşü]*|' ||
      'yarrak[a-zçğıöşü]*|yarrağ[a-zçğıöşü]*|yarağ[ıi][a-zçğıöşü]*|' ||
      'göt|götü|götün|götüne|götünü|götveren[a-zçğıöşü]*|götlek[a-zçğıöşü]*|' ||
      'pezevenk[a-zçğıöşü]*|gavat[a-zçğıöşü]*|kahpe[a-zçğıöşü]*|ibne[a-zçğıöşü]*|puşt[a-zçğıöşü]*|yavşak[a-zçğıöşü]*|' ||
      'taşak[a-zçğıöşü]*|taşşak[a-zçğıöşü]*|taşağ[a-zçğıöşü]*' ||
      ')([^[:alnum:]çğıöşü]|$)')
    or t.en ~ ('(^|[^[:alnum:]])(' ||
      'fuck[a-z]*|motherfuck[a-z]*|bitch(es)?|asshole[s]?|cunt[s]?|nigger[s]?|nigga[s]?|faggot[s]?|whore[s]?|slut[s]?|dickhead[s]?' ||
      ')([^[:alnum:]]|$)')
  from t;
$$;
revoke execute on function private.objectionable_text(text) from public, anon, authenticated;

create or replace function private.reject_objectionable() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_text text;
begin
  if auth.uid() is null or public.is_admin() then return new; end if;
  if tg_table_name = 'messages' then
    v_text := new.body;
    -- 42501 + Türkçe ileti: sohbet arayüzü bu metni "Gönderilemedi"nin yerine aynen gösterir.
    if private.objectionable_text(v_text) then
      raise exception 'Mesajın uygunsuz ifade içeriyor. Düzenleyip yeniden gönder.' using errcode = '42501';
    end if;
  elsif tg_table_name = 'reviews' then
    if private.objectionable_text(coalesce(new.comment, '') || ' ' || coalesce(new.seller_reply, '')) then
      raise exception 'Yorum uygunsuz ifade içeriyor. Lütfen düzenle.' using errcode = '22023';
    end if;
  elsif tg_table_name = 'listing_questions' then
    if private.objectionable_text(coalesce(new.question, '') || ' ' || coalesce(new.answer, '')) then
      raise exception 'Metin uygunsuz ifade içeriyor. Lütfen düzenle.' using errcode = '22023';
    end if;
  elsif tg_table_name = 'listings' then
    if (tg_op = 'INSERT' or new.title is distinct from old.title or new.description is distinct from old.description)
       and private.objectionable_text(coalesce(new.title, '') || ' ' || coalesce(new.description, '')) then
      raise exception 'İlan başlığı ya da açıklaması uygunsuz ifade içeriyor. Lütfen düzenle.' using errcode = '22023';
    end if;
  elsif tg_table_name = 'profiles' then
    if (new.full_name is distinct from old.full_name or new.bio is distinct from old.bio)
       and private.objectionable_text(coalesce(new.full_name, '') || ' ' || coalesce(new.bio, '')) then
      raise exception 'Ad ya da tanıtım yazısı uygunsuz ifade içeriyor. Lütfen düzenle.' using errcode = '22023';
    end if;
  end if;
  return new;
end $$;
revoke execute on function private.reject_objectionable() from public, anon, authenticated;

drop trigger if exists objectionable_messages on public.messages;
create trigger objectionable_messages before insert on public.messages
  for each row execute function private.reject_objectionable();
drop trigger if exists objectionable_reviews on public.reviews;
create trigger objectionable_reviews before insert or update of comment, seller_reply on public.reviews
  for each row execute function private.reject_objectionable();
drop trigger if exists objectionable_questions on public.listing_questions;
create trigger objectionable_questions before insert or update of question, answer on public.listing_questions
  for each row execute function private.reject_objectionable();
drop trigger if exists objectionable_listings on public.listings;
create trigger objectionable_listings before insert or update of title, description on public.listings
  for each row execute function private.reject_objectionable();
drop trigger if exists objectionable_profiles on public.profiles;
create trigger objectionable_profiles before update of full_name, bio on public.profiles
  for each row execute function private.reject_objectionable();
