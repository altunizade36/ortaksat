-- İlan kartlarına yapısal konum (province_id / district_id / neighborhood_id) eklenir.
-- Önceden yalnızca serbest metin `location` vardı; explore/filtre bu yüzden alt-metin
-- eşleştirmesi yapıyordu (ör. "Van" ili yanlış konum metinlerine denk gelebiliyordu).
-- Yapısal id'ler açılınca filtre kesin eşleşmeye (id = id) geçer, metin sadece fallback.
-- security_invoker=true korunur (public, RLS-güvenli görünüm).
create or replace view listing_public_cards
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
    l.attributes,
    l.province_id,
    l.district_id,
    l.neighborhood_id
   FROM listings l
     LEFT JOIN listing_public_stats s ON s.listing_id = l.id;
