-- Validate newly assigned partner overrides without rewriting historical agreements.
create or replace function private.validate_mobile_partner_override()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.commission_override_type is null and new.commission_override_value is null then return new;end if;
 if new.commission_override_type is null or new.commission_override_type not in ('rate','fixed')
  or new.commission_override_value is null or new.commission_override_value::text in ('NaN','Infinity','-Infinity')
  or new.commission_override_value<=0 or (new.commission_override_type='rate' and new.commission_override_value>90)
 then raise exception 'Geçerli bir özel komisyon gir. Yüzde 0 ile 90 arasında olmalıdır.' using errcode='22023';end if;
 return new;
end $$;
revoke all on function private.validate_mobile_partner_override() from public,anon,authenticated;
drop trigger if exists mobile_partner_override_validation on public.partnerships;
create trigger mobile_partner_override_validation before insert or update of commission_override_type,commission_override_value on public.partnerships for each row execute function private.validate_mobile_partner_override();
