-- =====================================================================
-- Yapısal ilan özellikleri (attributes jsonb) — emlak/vasıta gibi kategorilerde
-- forma girilen m², oda, imar, tapu vb. değerlerin SORGULANABİLİR/FİLTRELENEBİLİR
-- biçimde saklanması. Önceden bu değerler sales_pitch text[] içine gömülüyordu.
-- =====================================================================
alter table public.listings
  add column if not exists attributes jsonb not null default '{}'::jsonb;

-- Filtreleme için GIN index (jsonb içi anahtar/değer sorguları).
create index if not exists listings_attributes_gin on public.listings using gin (attributes);

-- Public view'e attributes'i ekle (security_invoker; yalnızca sona eklenir).
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
    l.featured,
    l.currency,
    l.demo,
    l.bonus_amount,
    l.bonus_quota,
    l.attributes
   FROM listings l
     LEFT JOIN listing_public_stats s ON s.listing_id = l.id;

-- security_invoker view olduğundan anon'un attributes kolonuna erişimi gerekir.
grant select (attributes) on public.listings to anon;
