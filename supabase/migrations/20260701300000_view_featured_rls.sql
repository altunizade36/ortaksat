-- listing_public_cards view'ini guncelle:
--  1) featured kolonunu ekle (one cikan ilanlar).
--  2) WHERE status='active' filtresini KALDIR -> gorunurluk RLS'e birakilir.
--     Boylece admin (RLS: admins read all listings) bekleyen/reddedilen ilanlari
--     da bu view'dan gorur; public sorgular zaten .eq(status,active) ile filtreler.
-- security_invoker korunur (RLS caginin kullanicisina gore uygulanir).

create or replace view public.listing_public_cards
with (security_invoker = true) as
 SELECT l.id,
    l.owner_id,
    l.title,
    l.slug,
    l.description,
    l.sales_pitch,
    l.share_templates,
    l.ad_assets,
    l.tags,
    l.price,
    l.commission_type,
    l.commission_value,
    l.category,
    l.location,
    l.status,
    l.partnership_mode,
    l.stock_count,
    l.min_partner_rating,
    l.commission_due_days,
    l.return_window_days,
    l.partner_rules,
    l.delivery_note,
    l.contact_method,
    l.created_at,
    ( SELECT li.url
           FROM listing_images li
          WHERE li.listing_id = l.id
          ORDER BY li.sort_order
         LIMIT 1) AS image_url,
    COALESCE(s.partner_count, 0::bigint) AS partner_count,
    COALESCE(s.lead_count, 0::bigint) AS lead_count,
    COALESCE(s.favorite_count, 0::bigint) AS favorite_count,
    COALESCE(s.review_count, 0::bigint) AS review_count,
    l.featured
   FROM listings l
     LEFT JOIN listing_public_stats s ON s.listing_id = l.id;
