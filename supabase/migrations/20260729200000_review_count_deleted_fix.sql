-- review_count SİLİNMİŞ yorumları da sayıyordu (soft-delete'te asla azalmıyordu) →
-- ilan kartı/detay "yorum" sayısı şişik + middleware SEO kapısı (review_count>0)
-- silinmiş yorumlarda boşuna sorgu atıyordu. `and r.deleted_at is null` eklendi.
-- (Kapsam gösterim + middleware ile tutarlı: silinmemiş TÜM ilan yorumları.)

create or replace function private.refresh_listing_public_stats(target_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_listing_id is null then
    return;
  end if;

  insert into public.listing_public_stats (
    listing_id,
    partner_count,
    lead_count,
    favorite_count,
    review_count,
    updated_at
  )
  select
    l.id,
    (select count(*) from public.partnerships p where p.listing_id = l.id and p.status = 'active'),
    (select count(*) from public.leads le where le.listing_id = l.id),
    (select count(*) from public.favorites f where f.listing_id = l.id),
    (select count(*) from public.reviews r where r.listing_id = l.id and r.deleted_at is null),
    now()
  from public.listings l
  where l.id = target_listing_id
  on conflict (listing_id) do update set
    partner_count = excluded.partner_count,
    lead_count = excluded.lead_count,
    favorite_count = excluded.favorite_count,
    review_count = excluded.review_count,
    updated_at = now();
end;
$$;

-- Mevcut şişik sayıları düzelt: tüm ilanların istatistiğini bir kez tazele.
do $$
declare r record;
begin
  for r in select id from public.listings loop
    perform private.refresh_listing_public_stats(r.id);
  end loop;
end $$;
