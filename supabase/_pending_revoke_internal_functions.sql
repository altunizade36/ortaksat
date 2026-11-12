-- Guvenlik: yalniz sunucu-ici (trigger/cron) kullanilan SECURITY DEFINER fonksiyonlar
-- istemciden (anon/authenticated) cagrilamaz. create_notification acik kalinca herkes
-- herhangi bir kullaniciya sahte bildirim yazabiliyordu.
revoke execute on function public.create_notification(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.compute_agreed_commission(uuid, numeric, integer, integer) from public, anon, authenticated;
revoke execute on function public.advance_return_pending_commissions() from public, anon, authenticated;