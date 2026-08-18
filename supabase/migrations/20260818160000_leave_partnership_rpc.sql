-- ============================================================================
-- 2026-08-18 — Ortağın KENDİ ortaklığından ayrılması için eksik RPC
-- ============================================================================
-- BUG (HIGH, denetim): leavePartnershipLive() `supabase.rpc("leave_partnership", { p_id })`
-- çağırıyordu ama bu fonksiyon HİÇBİR migration'da tanımlı DEĞİLDİ (repo-geneli grep yalnız
-- live-service.ts'te bulur). Sonuç: canlı/Supabase modunda ortak "Ortaklıktan ayrıl" deyince
-- RPC hata → leavePartnershipLive false → optimistik değişiklik geri alınır + "ayrılınamadı"
-- hatası. Ortak aktif ortaklığa KALICI kilitleniyordu (çıkış yolu yok).
--
-- ÇÖZÜM: SECURITY DEFINER fonksiyon. Partnership UPDATE RLS'i YALNIZ ilan-sahibine (satıcı)
-- izin verir; ortak kendi satırını UPDATE edemez → definer ile, ama SIKI kısıt:
--   yalnız partner_id = auth.uid() VE status='active' iken 'cancelled'a çeker.
-- Dönüş 'left' = başarı (istemci `data === "left"` bekler), 'noop'/'unauthorized' aksi halde.
-- (enum 'cancelled'/'completed' 20260630140000'da zaten eklendi; snapshot trigger yalnız
--  agreed_* kilitler, status değişimini engellemez → seller endPartnership ile aynı yol.)
create or replace function public.leave_partnership(p_id uuid)
returns text
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return 'unauthorized';
  end if;
  update public.partnerships
     set status = 'cancelled'
   where id = p_id
     and partner_id = v_uid
     and status = 'active';
  if not found then
    return 'noop';
  end if;
  return 'left';
end;
$$;

grant execute on function public.leave_partnership(uuid) to authenticated;
