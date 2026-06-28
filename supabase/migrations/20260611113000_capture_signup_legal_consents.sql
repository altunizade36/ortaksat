create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  consent_version text := coalesce(new.raw_user_meta_data ->> 'legal_version', '2026-06-11');
  consent_accepted_at timestamptz := coalesce(nullif(new.raw_user_meta_data ->> 'legal_accepted_at', '')::timestamptz, now());
begin
  insert into public.profiles (id, full_name, phone, verified_phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.email, new.phone, 'Ortaksat kullanıcısı'),
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
$$;
