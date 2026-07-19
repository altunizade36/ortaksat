-- Moderasyon: belirsiz alkol/tütün kelimeleri (şarap/bira/rakı/puro…) yalnız aksesuar/eşya
-- bağlamı YOKKEN bloklar → meşru ev-eşyası ("Şarap Dolabı", "Bira Bardağı") yayınlanabilir,
-- gerçek alkol/tütün ilanı (bağlamsız) yine engellenir. Client (lib/moderation.ts) ile eş.
create or replace function public.scan_prohibited(p_text text)
returns text language sql stable security definer set search_path to 'public'
as $fn$
  with t as (select lower(coalesce(p_text,'')) as hay),
  acc as (
    select exists (
      select 1 from unnest(array['dolap','dolabı','bardak','bardağı','kadeh','kadehi','şişe','şişesi','açacak','açacağı','kesici','kesicisi','takım','takımı','set','seti','stand','standı','raf','rafı','sehpa','sehpası','kutu','kutusu','askı','askısı','servis','altlık','altlığı','mahzen','mahzeni','soğutucu','soğutucusu','aparat','aparatı','tepsi','tepsisi','saklama','koleksiyon','maket','biblo','figür','oyuncak']) w, t
      where t.hay ~ ('(^|[^[:alnum:]])'||w||'([^[:alnum:]]|$)')
    ) as has_acc
  ),
  amb(words) as (select array['alkol','içki','bira','şarap','rakı','viski','votka','likör','sigara','tütün','elektronik sigara','e-sigara','vape','puro']),
  hits as (
    select k.severity::text as severity, lower(k.keyword) as keyword
    from public.prohibited_keywords k, t
    where case
      when position(' ' in k.keyword) > 0 then position(lower(k.keyword) in t.hay) > 0
      else t.hay ~ ('(^|[^[:alnum:]])'||lower(k.keyword)||'([^[:alnum:]]|$)')
    end
  ),
  eff as (
    select h.severity from hits h, acc, amb
    where not (h.severity = 'block' and acc.has_acc and h.keyword = any(amb.words))
  )
  select coalesce(
    (select case when bool_or(severity='block') then 'block'
                 when bool_or(severity='review') then 'review'
                 else 'none' end from eff),
    'none');
