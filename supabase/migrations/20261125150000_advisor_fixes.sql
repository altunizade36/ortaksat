-- Supabase Advisors düzeltmeleri (2026-11-25, mağaza yayını öncesi).
-- Bilerek DOKUNULMAYANLAR:
--  * Ana sayfa/katalog SQL yardımcıları (mobile_filter_*, catalogue_*, normalize_listing_title, provider_photo):
--    yalnız yerleşik işlev kullanan saf SQL işlevleri; SET search_path eklemek planlayıcının bunları satır içine
--    almasını engeller (ifade indeksleri + katalog filtreleri yavaşlar). Güvenlik riski yok (SECURITY DEFINER değil).
--  * anon/authenticated çalıştırabilen SECURITY DEFINER işlevler: herkese açık vitrin/dizin/onay bağlantısı
--    işlevleri bilerek açık; admin_* işlevleri içeride is_admin() denetler.
--  * RLS açık + politika yok tabloları (apple_tokens, user_presence …): yalnız sunucu erişir, bilinçli.

-- 1) Tetikleyici işlevi: search_path sabitlenir.
alter function public.enforce_listing_commission_rate_cap() set search_path = public, pg_temp;

-- 2) Tetikleyici işlevi RPC ile çağrılamaz; gereksiz çalıştırma yetkisi kaldırılır.
revoke execute on function public.record_listing_price_change() from public, anon, authenticated;

-- 3) partnership_notes: auth.uid() satır başına değil sorgu başına bir kez hesaplansın (auth_rls_initplan).
drop policy if exists "own partnership note delete" on public.partnership_notes;
drop policy if exists "own partnership note read" on public.partnership_notes;
drop policy if exists "own partnership note update" on public.partnership_notes;
drop policy if exists "own partnership note write" on public.partnership_notes;
create policy "own partnership note delete" on public.partnership_notes for delete to authenticated
  using (author_id = (select auth.uid()));
create policy "own partnership note read" on public.partnership_notes for select to authenticated
  using (author_id = (select auth.uid()));
create policy "own partnership note update" on public.partnership_notes for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()) and private.is_partnership_party(partnership_id, (select auth.uid())));
create policy "own partnership note write" on public.partnership_notes for insert to authenticated
  with check (author_id = (select auth.uid()) and private.is_partnership_party(partnership_id, (select auth.uid())));

-- 4) İndekssiz yabancı anahtarlar (ilan/kullanıcı silinirken tam tablo taraması yapılmasın).
create index if not exists listing_funnel_daily_listing_id_idx on public.listing_funnel_daily (listing_id);
create index if not exists listing_quota_overrides_granted_by_idx on public.listing_quota_overrides (granted_by);
create index if not exists partnership_notes_author_id_idx on public.partnership_notes (author_id);
