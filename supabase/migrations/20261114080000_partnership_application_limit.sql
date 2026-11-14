-- BAŞVURU LİMİTİ (toplu / otomatik başvuruya karşı): YENİ üye günde en çok 10 ortaklık başvurusu yapabilir.
--
-- "Güvenilir" sayılan üyeye sınır uygulanmaz: telefonu ya da kimliği doğrulanmış, en az bir onaylı satışı olan
-- ya da hesabı 30 günden eski olan kullanıcı. Yöneticiler ve sunucu işlemleri (auth.uid() boş) muaftır.
-- Yalnız YENİ başvuru (INSERT) sayılır; var olan ortaklığın güncellenmesi etkilenmez.
create or replace function private.limit_partnership_applications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_trusted boolean;
  v_recent integer;
begin
  if v_uid is null or new.partner_id is distinct from v_uid or is_admin() then
    return new;
  end if;
  select (coalesce(p.verified_phone, false) or coalesce(p.verified_identity, false)
          or coalesce(p.successful_sales, 0) > 0 or p.created_at < now() - interval '30 days')
    into v_trusted
    from public.profiles p where p.id = v_uid;
  if coalesce(v_trusted, false) then
    return new;
  end if;
  select count(*) into v_recent
    from public.partnerships
   where partner_id = v_uid and created_at > now() - interval '24 hours';
  if v_recent >= 10 then
    raise exception 'Günlük başvuru sınırına ulaştın (10). Yarın tekrar başvurabilir ya da telefonunu doğrulayarak sınırı kaldırabilirsin.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists limit_partnership_applications on public.partnerships;
create trigger limit_partnership_applications
  before insert on public.partnerships
  for each row execute function private.limit_partnership_applications();
