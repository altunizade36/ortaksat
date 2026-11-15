-- İlanın tarafları, ilan yayından kalksa da ilanı okuyabilsin.
--
-- Sorun (2026-11-15 uçtan uca denemede bulundu): listings okuma kuralı yalnız "yayında" ilanı, sahibini ve
-- personeli kapsıyordu. Satıcı ilanı pasife alınca, son ürün satılıp ilan "satıldı" olunca ya da ilan arşive
-- düşünce ORTAK kendi ortaklık kartını ve anlaşmasını, sohbetteki kişi de ilan bilgisini göremiyordu
-- ("İlan bilgileri şu anda görüntülenemiyor"). Komisyon kazandıran satıştan sonra ilanın kaybolması tam da
-- ortağın kaydına en çok ihtiyaç duyduğu andı.
--
-- Kural: ilan pasif / satıldı / arşivde ise yalnız TARAFLARI okuyabilir: ortaklığı olan (engellenmiş ya da
-- reddedilmiş değil), o ilan üzerinden sohbeti olan ya da teklif vermiş kullanıcı. İncelemedeki ve reddedilen
-- ilanlar bu kuralın dışındadır. Akışlar "yayında" süzgecini istemcide zaten uyguluyor (satıcının kendi pasif
-- ilanı için de böyleydi), bu yüzden bu ilanlar keşfet/arama listelerine girmez.
--
-- Taraf denetimi SECURITY DEFINER işlevdedir: kural içindeki alt sorgu çağıranın yetkisiyle çalışır ve
-- partnerships kuralları da listings'e baktığı için doğrudan alt sorgu sonsuz özyinelemeye girerdi.

create or replace function public.is_listing_party(p_listing uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select auth.uid() is not null and (
    exists (select 1 from public.partnerships p
            where p.listing_id = p_listing and p.partner_id = auth.uid()
              and p.status in ('active', 'pending', 'cancelled', 'completed'))
    or exists (select 1 from public.conversations c
               where c.listing_id = p_listing and auth.uid() = any (c.participant_ids))
    or exists (select 1 from public.offers o
               where o.listing_id = p_listing and o.buyer_id = auth.uid())
  );
$$;

revoke execute on function public.is_listing_party(uuid) from public, anon;
grant execute on function public.is_listing_party(uuid) to authenticated;

drop policy if exists "listing parties can read" on public.listings;
create policy "listing parties can read" on public.listings
  for select to authenticated
  using (deleted_at is null and status in ('paused', 'sold', 'archived') and public.is_listing_party(id));
