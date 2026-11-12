-- Per-listing price alerts use the same recipient preference guard as global alerts.
create or replace function private.mobile_notification_preference_guard()
returns trigger language plpgsql security definer set search_path='' as $$
declare prefs jsonb;
begin
 if auth.uid() is null and coalesce(auth.role(),'')<>'service_role' and session_user not in ('postgres','supabase_admin') then return new;end if;
 select p.preferences into prefs from public.profiles p where p.id=new.user_id;
 if not public.mobile_notification_enabled(coalesce(prefs,'{}'::jsonb),new.type::text) then return null;end if;
 if new.type::text='price_drop' and coalesce(prefs->>('notify_price_drop_skip:'||coalesce(new.metadata->>'listingId','')),'false')='true' then return null;end if;
 return new;
end $$;
revoke all on function private.mobile_notification_preference_guard() from public,anon,authenticated;
