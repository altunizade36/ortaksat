-- Yalnız girişli kullanıcının anlamlı olarak çağırabileceği işlem RPC'lerinde anon EXECUTE kaldırıldı
-- (2026-11-12, Supabase güvenlik danışmanı: anon_security_definer_function_executable).
-- Hepsi içeride auth.uid() denetliyordu (istismar yoktu); bu, saldırı yüzeyini küçülten ek katmandır.
-- Hiçbiri bir RLS policy'sinde kullanılmıyor; herkese açık okuma RPC'leri (katalog, ortak vitrini,
-- referans linki, satış onayı, görüntülenme sayacı vb.) bilerek anon'a açık bırakıldı.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in (
      'apply_to_partner_request', 'approve_location_suggestion', 'capture_invite', 'delete_own_review',
      'edit_own_review', 'heartbeat', 'leave_partnership', 'my_blocked_profiles', 'my_favorite_partners',
      'my_invites', 'my_partner_requests', 'offer_buyer_action', 'offer_seller_respond', 'partner_join',
      'partner_request_applicants', 'record_payout', 'remove_listing', 'reply_to_review',
      'respond_to_partner_application', 'toggle_review_helpful')
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated, service_role', r.sig);
  end loop;
end $$;
