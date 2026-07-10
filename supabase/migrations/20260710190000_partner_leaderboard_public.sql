-- Herkese açık ortak liderlik tablosu. Eskiden istemci PartnerLeaderboard'ı client
-- store'un RLS-kapsamlı sales/partnerships'inden hesaplıyordu → saf ortak YALNIZ kendini
-- görüyordu (yanıltıcı sosyal-kanıt). Bu VIEW tüm onaylı komisyonları partner bazında
-- toplar (definer view → RLS bypass, yalnız AGREGAT açığa çıkar). Platform PARA TUTMAZ.
create or replace view public.partner_leaderboard_public as
select
  pt.partner_id,
  pr.full_name,
  pr.verified_identity,
  count(*) filter (where c.status in ('approved', 'seller_paid', 'paid')) as confirmed_sales,
  coalesce(sum(c.amount) filter (where c.status = 'paid'), 0) as paid_earned
from public.commissions c
join public.partnerships pt on pt.id = c.partnership_id
join public.profiles pr on pr.id = pt.partner_id
group by pt.partner_id, pr.full_name, pr.verified_identity
having count(*) filter (where c.status in ('approved', 'seller_paid', 'paid')) > 0;

grant select on public.partner_leaderboard_public to anon, authenticated;
