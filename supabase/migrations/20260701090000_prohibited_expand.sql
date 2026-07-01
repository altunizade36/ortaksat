-- OrtakSat — yasaklı/denetimli ürün listesini genişlet + kelime-sınırı eşleşmesi.
-- Idempotent. Türkiye mevzuatı + pazaryeri standartlarına göre.

-- 1) scan_prohibited: kelime sınırı ile eşleşsin (kısa kelimeler yanlış yakalamasın).
--    Çok kelimeli ifadeler düz alt-dize; tek kelimeler harf-olmayan sınırla çevrili.
create or replace function public.scan_prohibited(p_text text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with hits as (
    select severity
    from public.prohibited_keywords k
    where case
      when position(' ' in k.keyword) > 0
        then position(lower(k.keyword) in lower(coalesce(p_text, ''))) > 0
      else lower(coalesce(p_text, '')) ~ ('(^|[^[:alnum:]])' || lower(k.keyword) || '([^[:alnum:]]|$)')
    end
  )
  select coalesce(
    (select case when bool_or(severity = 'block') then 'block'
                 when bool_or(severity = 'review') then 'review'
                 else 'none' end from hits),
    'none');
$$;

-- 2) Genişletilmiş yasaklı kelimeler (BLOCK).
insert into public.prohibited_keywords(keyword, category, severity) values
  ('ateşli silah','weapon','block'),('av tüfeği','weapon','block'),('pompalı','weapon','block'),
  ('mühimmat','weapon','block'),('patlayıcı','weapon','block'),('havai fişek','weapon','block'),
  ('el bombası','weapon','block'),('kurusıkı','weapon','block'),
  ('metamfetamin','drug','block'),('ekstazi','drug','block'),('keyif verici madde','drug','block'),
  ('reçeteli ilaç','drug','block'),('antibiyotik','drug','block'),('steroid','drug','block'),
  ('anabolik','drug','block'),('zayıflama ilacı','drug','block'),('hormon ilacı','drug','block'),
  ('sigara','tobacco','block'),('tütün','tobacco','block'),('elektronik sigara','tobacco','block'),
  ('e-sigara','tobacco','block'),('vape','tobacco','block'),('puro','tobacco','block'),
  ('nargile tütünü','tobacco','block'),('sarma tütün','tobacco','block'),
  ('alkol','alcohol','block'),('içki','alcohol','block'),('bira','alcohol','block'),
  ('şarap','alcohol','block'),('rakı','alcohol','block'),('viski','alcohol','block'),
  ('votka','alcohol','block'),('likör','alcohol','block'),('kaçak içki','alcohol','block'),
  ('çakma','counterfeit','block'),('a kalite replika','counterfeit','block'),
  ('sahte ürün','counterfeit','block'),('sahte marka','counterfeit','block'),
  ('seri numarası silinmiş','stolen','block'),
  ('dinleme cihazı','spy','block'),('gizli kamera','spy','block'),('casus kamera','spy','block'),
  ('takip cihazı','spy','block'),('sinyal kesici','spy','block'),('jammer','spy','block'),
  ('hack','digital','block'),('exploit','digital','block'),('zararlı yazılım','digital','block'),
  ('phishing','digital','block'),('çalıntı hesap','digital','block'),('hesap satışı','digital','block'),
  ('oyun hesabı satışı','digital','block'),('sosyal medya hesabı satışı','digital','block'),
  ('sahte takipçi','digital','block'),('sahte beğeni','digital','block'),('takipçi satışı','digital','block'),
  ('kimlik kartı','document','block'),('sahte belge','document','block'),('sahte fatura','document','block'),
  ('sahte rapor','document','block'),('sahte diploma','document','block'),
  ('insan organı','other','block'),('organ satışı','other','block'),('böbrek satışı','other','block'),
  ('anne sütü','other','block'),
  ('yasa dışı bahis','gambling','block'),('şans oyunu kuponu','gambling','block')
on conflict (keyword) do update set severity = excluded.severity, category = excluded.category;

-- 3) Manuel incelemeye düşecekler (REVIEW).
insert into public.prohibited_keywords(keyword, category, severity) values
  ('medikal','medical','review'),('tıbbi cihaz','medical','review'),('takviye','medical','review'),
  ('reçete','medical','review'),('18+','adult','review'),('gümrüksüz','stolen','review'),
  ('kelebek bıçak','weapon','review'),('muşta','weapon','review'),('biber gazı','weapon','review'),
  ('sertifika satışı','document','review')
on conflict (keyword) do update set severity = excluded.severity, category = excluded.category;
