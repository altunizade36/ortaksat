-- MÜŞTERİ (LEAD) TEKİLLİĞİ — "İlk müşteriyi getiren kazanır / başka ortak aynı kişiyi ekleyemez"
-- Ürün tezi: komisyon adaleti. Bir müşteri (telefon), bir ilan için YALNIZ BİR KEZ kaydedilebilir;
-- ilk kaydeden ortak o müşterinin sahibidir. İstemcide dedup VARDI ama YALNIZ aynı ortak içindi
-- (partnershipId eşitliği) VE client-only'di: farklı ortak (B), A'nın lead'ini RLS gereği GÖREMEZ
-- → cross-ortak çift kayıt oluşabiliyordu (komisyon anlaşmazlığı). Sunucuda zorlanır:
--
-- (listing_id, normalize(telefon)) benzersiz — status 'lost' HARİÇ (kaybedilen müşteri yeniden
-- kaydedilebilir → telefon serbest kalır). İkinci ekleme 23505 unique_violation ile reddedilir;
-- istemci persistCritical bunu geri alır ve dupe-farkında mesaj gösterir.

-- KANONİK TELEFON = son 10 hane. TR numaraları formatlar arasında değişir
-- ("0532 111 2233" / "+90 532 111 2233" / "532 111 2233") ama son 10 hane AYNIdır
-- ("5321112233") → format-bağımsız dedup. Değişmez ifade (immutable) olduğundan index'lenebilir.
-- Not: canlıda 0 lead (cold-start) → mevcut çift kayıt yok, index güvenle kurulur.
create unique index if not exists leads_listing_phone_uniq
  on public.leads (listing_id, right(regexp_replace(buyer_phone, '[^0-9]', '', 'g'), 10))
  where status <> 'lost';

-- Yardımcı (opsiyonel istemci ön-kontrolü): bir telefon bu ilan için müsait mi?
-- SECURITY DEFINER → RLS'i baypas eder (partner B, A'nın lead'ini göremese de doğru cevap alır).
create or replace function public.is_lead_available(p_listing_id uuid, p_buyer_phone text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $fn$
  select not exists (
    select 1 from public.leads
     where listing_id = p_listing_id
       and status <> 'lost'
       and right(regexp_replace(buyer_phone, '[^0-9]', '', 'g'), 10) = right(regexp_replace(p_buyer_phone, '[^0-9]', '', 'g'), 10)
  );
$fn$;
grant execute on function public.is_lead_available(uuid, text) to authenticated;
