-- Q&A bildirimleri (denetim bulgusu #6): listing_questions insert/answer'da bildirim YOKTU →
-- satıcı "soru bekliyor" sinyali almıyor (yanıt oranı düşük), soran "yanıtlandı" bilmiyor.
-- Mevcut notify_* trigger desenini birebir izler (SECURITY DEFINER, search_path, notifications insert).

-- 1) Yeni soru → İLAN SAHİBİNE bildirim
create or replace function public.notify_question_asked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_owner uuid; v_title text; v_asker text;
begin
  select owner_id, title into v_owner, v_title from public.listings where id = new.listing_id;
  if v_owner is null or v_owner = new.asker_id then return new; end if; -- kendi ilanına soru → bildirim yok
  select full_name into v_asker from public.profiles where id = new.asker_id;
  insert into public.notifications (user_id, type, title, body, metadata)
  values (
    v_owner, 'question', 'Yeni soru aldın',
    format('%s, "%s" ilanına soru sordu. Yanıtlayınca herkes görebilir.',
      coalesce(nullif(trim(coalesce(v_asker, new.asker_name)), ''), 'Bir kullanıcı'),
      coalesce(v_title, 'ilan')),
    jsonb_build_object('listingId', new.listing_id, 'questionId', new.id)
  );
  return new;
end;
$$;

-- 2) Cevap eklendi (answer null → dolu) → SORAN KİŞİYE bildirim
create or replace function public.notify_question_answered()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_title text;
begin
  if new.answer is null or trim(new.answer) = '' then return new; end if;
  if old.answer is not null and old.answer = new.answer then return new; end if; -- yalnız yeni/değişen cevap
  if new.asker_id is null then return new; end if;
  select title into v_title from public.listings where id = new.listing_id;
  insert into public.notifications (user_id, type, title, body, metadata)
  values (
    new.asker_id, 'question', 'Sorun yanıtlandı',
    format('"%s" ilanında sorduğun soru satıcı tarafından yanıtlandı.', coalesce(v_title, 'ilan')),
    jsonb_build_object('listingId', new.listing_id, 'questionId', new.id)
  );
  return new;
end;
$$;

drop trigger if exists trg_notify_question_asked on public.listing_questions;
create trigger trg_notify_question_asked
  after insert on public.listing_questions
  for each row execute function public.notify_question_asked();

drop trigger if exists trg_notify_question_answered on public.listing_questions;
create trigger trg_notify_question_answered
  after update on public.listing_questions
  for each row execute function public.notify_question_answered();

-- least-privilege: trigger fonksiyonlarını doğrudan çağrılamaz yap (trigger sistemi etkilenmez).
revoke execute on function public.notify_question_asked() from public, anon, authenticated;
revoke execute on function public.notify_question_answered() from public, anon, authenticated;
