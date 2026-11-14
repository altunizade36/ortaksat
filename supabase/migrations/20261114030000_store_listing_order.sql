-- MAĞAZA SIRASI: satıcı, ilanlarının mağazasında hangi sırayla görüneceğini kendisi belirler.
--
-- Sıra ilanın `attributes._storeRank` alanında (1, 2, 3 …) tutulur; ayrı sütun/tablo YOK:
--   * `listing_public_cards` görünümü `attributes`'ı zaten veriyor → mağaza sorgusu
--     `order=attributes->_storeRank.asc.nullsfirst,created_at.desc` ile sunucuda sıralar (sayfalama bozulmaz),
--     görünüm ve anonim sütun izni değişmez.
--   * Sırası OLMAYAN ilan (yeni eklenen) en başta görünür; satıcı sıralamayı yeniden kaydedene kadar öyle kalır.
--
-- Yazma yalnız bu işlevden: çağıran yalnız KENDİ ilanlarının sırasını değiştirebilir, başka hiçbir alan
-- değişmez (başlık/açıklama/durum aynı kaldığı için içerik taraması ve bildirim tetikleyicileri çalışmaz).
create or replace function public.set_store_listing_order(p_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_ids uuid[] := coalesce(p_ids, '{}'::uuid[]);
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Giriş gerekli.' using errcode = '42501';
  end if;
  if cardinality(v_ids) > 500 then
    raise exception 'En fazla 500 ilan sıralanabilir.' using errcode = '22023';
  end if;

  -- Listede olmayan ilanların sırası silinir (yeni ilan gibi en başta görünür).
  update public.listings l
     set attributes = l.attributes - '_storeRank'
   where l.owner_id = v_uid
     and l.attributes ? '_storeRank'
     and not (l.id = any (v_ids));

  update public.listings l
     set attributes = coalesce(l.attributes, '{}'::jsonb) || jsonb_build_object('_storeRank', o.ord)
    from (select id, min(ord) as ord from unnest(v_ids) with ordinality as u(id, ord) group by id) as o
   where l.id = o.id
     and l.owner_id = v_uid
     and (l.attributes -> '_storeRank') is distinct from to_jsonb(o.ord);
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.set_store_listing_order(uuid[]) from public, anon;
grant execute on function public.set_store_listing_order(uuid[]) to authenticated;

comment on function public.set_store_listing_order(uuid[]) is
  'Satıcının mağaza sırası: verilen ilan kimliklerini sırayla attributes._storeRank = 1..n yapar; yalnız çağıranın kendi ilanları.';
