-- Güvenlik sıkılaştırma (Supabase Security Advisor uyarıları + bot/saldırı koruması).
-- 1) Fonksiyonlara sabit search_path (search_path mutable uyarısı)
-- 2) Trigger/SECURITY DEFINER fonksiyonlarından EXECUTE yetkisini geri al
-- 3) Public bucket'larda "listeleme" (enumerate) iznini kaldır; public okuma URL ile devam eder

-- 1) search_path sabitle ------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_proc where proname = 'is_admin' and pronamespace = 'public'::regnamespace) then
    execute 'alter function public.is_admin() set search_path = public';
  end if;
  if exists (select 1 from pg_proc where proname = 'touch_updated_at' and pronamespace = 'public'::regnamespace) then
    execute 'alter function public.touch_updated_at() set search_path = public';
  end if;
  if exists (select 1 from pg_proc where proname = 'touch_conversation_last_message' and pronamespace = 'public'::regnamespace) then
    execute 'alter function public.touch_conversation_last_message() set search_path = public';
  end if;
  if exists (select 1 from pg_proc where proname = 'approve_location_suggestion' and pronamespace = 'public'::regnamespace) then
    execute 'alter function public.approve_location_suggestion(uuid) set search_path = public';
  end if;
end $$;

-- 2) Trigger fonksiyonlarından doğrudan EXECUTE yetkisini al (RLS dışı çağrıyı engelle)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'touch_conversation_last_message' and pronamespace = 'public'::regnamespace) then
    execute 'revoke all on function public.touch_conversation_last_message() from public, anon, authenticated';
  end if;
  if exists (select 1 from pg_proc where proname = 'touch_updated_at' and pronamespace = 'public'::regnamespace) then
    execute 'revoke all on function public.touch_updated_at() from public, anon, authenticated';
  end if;
end $$;

-- 3) Storage: bucket'lar public (URL ile okunur) ama RLS üzerinden LİSTELEME kapatılır.
update storage.buckets set public = true where id in ('listing-images', 'profile-avatars');
-- Geniş SELECT (enumerate) politikalarını kaldır — public dosyalar yine public URL ile gösterilir.
drop policy if exists "public listing images readable" on storage.objects;
drop policy if exists "public profile avatars readable" on storage.objects;
