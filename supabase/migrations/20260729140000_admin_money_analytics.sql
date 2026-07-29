-- Admin PARA analitiği güçlendirmesi (2026-07-29): admin_live_analytics'e para akışı
-- görünürlüğü eklenir. OrtakSat para TUTMAZ — bu metrikler sistemden AKAN parayı
-- (GMV = orders.amount satış değeri, komisyon = satıcı↔ortak, platform DIŞI ödenir)
-- İZLER. Platform kesintisi/geliri YOKTUR. Yeni alanlar:
--   • days[]: günlük gmv + günlük commission (14-gün trend zenginleşir)
--   • commission_pending_amount / gmv_7d / commission_7d
--   • commission_status[]: komisyon yaşam döngüsü (durum → adet + tutar)
--   • top_earners[]: en çok komisyon kazanan ortaklar
-- Diğer TÜM mevcut alanlar korunur (redefine).

create or replace function public.admin_live_analytics()
returns json language plpgsql security definer
set search_path to 'public', 'auth'
set timezone to 'Europe/Istanbul'
as $$
declare is_admin boolean; result json;
begin
  select (role in ('admin','super_admin','moderator') and coalesce(status,'active') <> 'suspended')
    into is_admin from public.profiles where id = auth.uid();
  if not coalesce(is_admin, false) then raise exception 'not authorized'; end if;
  select json_build_object(
    'total_users', (select count(*) from auth.users),
    'confirmed_users', (select count(*) from auth.users where email_confirmed_at is not null),
    'live_now', (select count(*) from public.profiles where last_seen_at > now() - interval '5 minutes'),
    'active_today', (select count(*) from public.user_active_days where day = current_date),
    'new_today', (select count(*) from auth.users where created_at >= date_trunc('day', now())),
    'new_7d', (select count(*) from auth.users where created_at >= now() - interval '7 days'),
    'listings_total', (select count(*) from public.listings),
    'listings_active', (select count(*) from public.listings where status='active'),
    'listings_pending', (select count(*) from public.listings where status='pending_review'),
    'listings_paused', (select count(*) from public.listings where status='paused'),
    'listings_sold', (select count(*) from public.listings where status='sold'),
    'listings_new_7d', (select count(*) from public.listings where created_at >= now() - interval '7 days'),
    'commissions_total', (select count(*) from public.commissions),
    'commissions_paid', (select count(*) from public.commissions where status='paid'),
    -- GERÇEK GMV = satış/ürün değeri (orders.amount). commissions.amount komisyon KESİNTİSİdir, GMV değil.
    'gmv', (select coalesce(sum(amount),0) from public.orders),
    'commission_amount', (select coalesce(sum(amount),0) from public.commissions),
    'commission_paid_amount', (select coalesce(sum(amount) filter (where status='paid'),0) from public.commissions),
    -- PARA AKIŞI (yeni): bekleyen komisyon + son-7-gün para + durum dağılımı + top kazananlar
    'commission_pending_amount', (select coalesce(sum(amount) filter (where status not in ('paid','cancelled')),0) from public.commissions),
    'gmv_7d', (select coalesce(sum(amount),0) from public.orders where created_at >= now() - interval '7 days'),
    'commission_7d', (select coalesce(sum(amount),0) from public.commissions where created_at >= now() - interval '7 days'),
    'commission_status', (
      select json_agg(json_build_object('status', st, 'n', n, 'amount', amt) order by amt desc)
      from (select status::text as st, count(*) n, coalesce(sum(amount),0) amt from public.commissions group by status) c
    ),
    'top_earners', (
      select json_agg(json_build_object('name', coalesce(nullif(pr.full_name,''),'Ortak'), 'amount', t.amt, 'n', t.n) order by t.amt desc)
      from (
        select p.partner_id, count(*) n, coalesce(sum(c.amount),0) amt
        from public.commissions c join public.partnerships p on p.id = c.partnership_id
        where c.deleted_at is null
        group by p.partner_id order by sum(c.amount) desc limit 6
      ) t left join public.profiles pr on pr.id = t.partner_id
    ),
    'partnerships_total', (select count(*) from public.partnerships),
    'partnerships_active', (select count(*) from public.partnerships where status='active'),
    'partnerships_pending', (select count(*) from public.partnerships where status='pending'),
    'orders_total', (select count(*) from public.orders),
    'open_reports', (select count(*) from public.reports where status in ('open','reviewing')),
    'cat_suggestions', (select count(*) from public.category_suggestions where status='pending'),
    'loc_suggestions', (select count(*) from public.location_suggestions where status='pending'),
    'days', (
      select json_agg(json_build_object(
        'day', s.day, 'active', coalesce(ac.n,0), 'signups', coalesce(su.n,0), 'listings', coalesce(li.n,0),
        'gmv', coalesce(og.amt,0), 'commission', coalesce(cg.amt,0)
      ) order by s.day)
      from (select (current_date - 13 + i)::date as day from generate_series(0,13) i) s
      left join (select created_at::date d, count(*) n from auth.users where created_at >= current_date - 13 group by 1) su on su.d = s.day
      left join (select created_at::date d, count(*) n from public.listings where created_at >= current_date - 13 group by 1) li on li.d = s.day
      left join (select day, count(*) n from public.user_active_days where day >= current_date - 13 group by day) ac on ac.day = s.day
      left join (select created_at::date d, coalesce(sum(amount),0) amt from public.orders where created_at >= current_date - 13 group by 1) og on og.d = s.day
      left join (select created_at::date d, coalesce(sum(amount),0) amt from public.commissions where created_at >= current_date - 13 group by 1) cg on cg.d = s.day
    ),
    'top_categories', (select json_agg(json_build_object('category', category, 'n', n) order by n desc) from (
        select category, count(*) as n from public.listings where status='active' group by category order by count(*) desc limit 8) c)
  ) into result;
  return result;
end; $$;
revoke all on function public.admin_live_analytics() from public;
grant execute on function public.admin_live_analytics() to authenticated;
