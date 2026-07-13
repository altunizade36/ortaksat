-- KRİTİK: Ortak linkinden gelen ALICI (anon) talep bırakamıyordu → 42501 RLS ihlali.
--
-- Kök neden (klasik RLS tuzağı): "public buyers create referral leads" politikasının
-- with_check'i EXISTS (SELECT 1 FROM partnerships p JOIN listings l ...) yapıyordu.
-- RLS politikalarının içindeki ALT SORGULAR DA çağıranın izinleriyle çalışır; anon
-- partnerships'i OKUYAMADIĞI için (RLS: yalnız sahip/ortak görür) EXISTS her zaman FALSE
-- dönüyor ve insert reddediliyordu. Yani ürünün en temel dönüşümü ("ortak linki → talep")
-- canlıda tamamen ölüydü ve hiçbir hata yüzeye çıkmıyordu (form "Talep gönderilemedi" diyordu).
--
-- Çözüm: kontrolü SECURITY DEFINER fonksiyona taşı (RLS'i aşarak partnerships'i okur),
-- politikada onu çağır. Fonksiyon YALNIZCA boolean döner — hiçbir ortaklık verisi sızmaz.

create or replace function public.referral_lead_allowed(p_partnership uuid, p_listing uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
      from public.partnerships p
      join public.listings l on l.id = p.listing_id
     where p.id = p_partnership
       and p.listing_id = p_listing
       and p.status = 'active'
       and l.status = 'active'
  );
$$;

grant execute on function public.referral_lead_allowed(uuid, uuid) to anon, authenticated;

drop policy if exists "public buyers create referral leads" on public.leads;
create policy "public buyers create referral leads"
  on public.leads
  for insert
  to public
  with check (public.referral_lead_allowed(partnership_id, listing_id));
