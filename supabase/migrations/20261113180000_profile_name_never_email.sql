-- Profil adı ASLA e-posta ya da telefon olmaz.
-- Neden: ad bilgisi vermeyen girişlerde (Apple ile giriş; Apple adı yalnız ilk yetkilendirmede ve yalnız cihaza verir)
-- handle_new_user profil adına kullanıcının E-POSTASINI yazıyordu → e-posta herkese açık profil adı olarak görünüyordu.
-- Artık ad yoksa nötr bir yer tutucu yazılır; kullanıcı profilinden adını ekler.
-- 2026-11-13'te canlıya uygulandı.

CREATE OR REPLACE FUNCTION private.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  consent_version text := coalesce(new.raw_user_meta_data ->> 'legal_version', '2026-06-11');
  consent_accepted_at timestamptz := coalesce(nullif(new.raw_user_meta_data ->> 'legal_accepted_at', '')::timestamptz, now());
begin
  insert into public.profiles (id, full_name, phone, verified_phone)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), nullif(btrim(new.raw_user_meta_data ->> 'name'), ''), 'OrtakSat Kullanıcısı'),
    new.phone,
    new.phone is not null
  )
  on conflict (id) do update set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    phone = excluded.phone,
    verified_phone = excluded.verified_phone;

  if lower(coalesce(new.raw_user_meta_data ->> 'legal_terms_accepted', 'false')) in ('true', '1', 'yes') then
    insert into public.legal_consents (user_id, document_type, version, accepted, accepted_at)
    select new.id, document_type, consent_version, true, consent_accepted_at
    from unnest(array['privacy', 'terms', 'kvkk', 'seller_rules']) as document_type
    on conflict (user_id, document_type, version) do update set
      accepted = excluded.accepted,
      accepted_at = excluded.accepted_at;
  end if;

  return new;
end;
$function$;

update public.profiles p set full_name = 'OrtakSat Kullanıcısı' from auth.users u where u.id = p.id and (p.full_name = u.email or (u.phone is not null and p.full_name = u.phone));
