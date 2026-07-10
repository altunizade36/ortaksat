-- 20260710220000 Güvenlik + performans sertleştirme (advisor denetimi)
-- - Trigger fonksiyonlarından doğrudan EXECUTE geri alındı (anon_security_definer_function WARN)
-- - partner_leaderboard_public: SECURITY DEFINER view (ERROR) → security_invoker view + definer fn
-- - 25 indekssiz FK'ya kapsayan indeks (JOIN/cascade-delete perf)
-- Not: leaked-password (HIBP) koruması ücretli plan gerektirir (API 402) — planda etkinleştirilmeli.

-- === 1) Trigger fonksiyonlarından doğrudan EXECUTE geri al (trigger olarak zaten çalışır;
--        doğrudan çağrılmamalı — advisor WARN + defense-in-depth). ===
revoke execute on function public.bump_follower_count() from anon, authenticated, public;
revoke execute on function public.bump_seller_successful_sales() from anon, authenticated, public;
revoke execute on function public.enforce_partnership_approval() from anon, authenticated, public;
revoke execute on function public.guard_commission_paid() from anon, authenticated, public;
revoke execute on function public.guard_listing_moderation() from anon, authenticated, public;
revoke execute on function public.guard_partner_lead_update() from anon, authenticated, public;
revoke execute on function public.notify_on_lead() from anon, authenticated, public;

-- === 2) Ortak liderlik tablosu: SECURITY DEFINER view (ERROR) → security_invoker view +
--        SECURITY DEFINER fonksiyon (kontrollü, yalnız-güvenli-agregat açığa çıkarma; istemci değişmez). ===
create or replace function public.partner_leaderboard_rows()
returns table (partner_id uuid, full_name text, verified_identity boolean, confirmed_sales bigint, paid_earned numeric)
language sql security definer set search_path = public stable as $$
  select pt.partner_id, pr.full_name, pr.verified_identity,
    count(*) filter (where c.status = any (array['approved','seller_paid','paid']::commission_status[])) as confirmed_sales,
    coalesce(sum(c.amount) filter (where c.status = 'paid'::commission_status), 0::numeric) as paid_earned
  from public.commissions c
  join public.partnerships pt on pt.id = c.partnership_id
  join public.profiles pr on pr.id = pt.partner_id
  group by pt.partner_id, pr.full_name, pr.verified_identity
  having count(*) filter (where c.status = any (array['approved','seller_paid','paid']::commission_status[])) > 0;
$$;
revoke all on function public.partner_leaderboard_rows() from public;
grant execute on function public.partner_leaderboard_rows() to anon, authenticated;

drop view if exists public.partner_leaderboard_public;
create view public.partner_leaderboard_public with (security_invoker=on) as
  select * from public.partner_leaderboard_rows();
grant select on public.partner_leaderboard_public to anon, authenticated;

-- === 3) İndekssiz yabancı anahtarlara kapsayan indeksler (JOIN + cascade-delete performansı). ===
create index if not exists idx_addresses_district_id on public.addresses(district_id);
create index if not exists idx_addresses_neighborhood_id on public.addresses(neighborhood_id);
create index if not exists idx_addresses_province_id on public.addresses(province_id);
create index if not exists idx_category_suggestions_listing_id on public.category_suggestions(listing_id);
create index if not exists idx_category_suggestions_reviewed_by on public.category_suggestions(reviewed_by);
create index if not exists idx_category_suggestions_user_id on public.category_suggestions(user_id);
create index if not exists idx_commissions_listing_id on public.commissions(listing_id);
create index if not exists idx_commissions_order_id on public.commissions(order_id);
create index if not exists idx_commissions_payout_id on public.commissions(payout_id);
create index if not exists idx_listing_images_listing_id on public.listing_images(listing_id);
create index if not exists idx_listing_questions_asker_id on public.listing_questions(asker_id);
create index if not exists idx_location_suggestions_district_id on public.location_suggestions(district_id);
create index if not exists idx_location_suggestions_province_id on public.location_suggestions(province_id);
create index if not exists idx_location_suggestions_reviewed_by on public.location_suggestions(reviewed_by);
create index if not exists idx_location_suggestions_user_id on public.location_suggestions(user_id);
create index if not exists idx_orders_buyer_id on public.orders(buyer_id);
create index if not exists idx_orders_listing_id on public.orders(listing_id);
create index if not exists idx_orders_partnership_id on public.orders(partnership_id);
create index if not exists idx_payouts_listing_id on public.payouts(listing_id);
create index if not exists idx_referral_clicks_listing_id on public.referral_clicks(listing_id);
create index if not exists idx_referral_public_links_listing_id on public.referral_public_links(listing_id);
create index if not exists idx_reports_reported_user_id on public.reports(reported_user_id);
create index if not exists idx_reports_reporter_id on public.reports(reporter_id);
create index if not exists idx_reports_resolved_by on public.reports(resolved_by);
create index if not exists idx_reviews_reviewed_user_id on public.reviews(reviewed_user_id);
