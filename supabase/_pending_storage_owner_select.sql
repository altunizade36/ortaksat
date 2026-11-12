-- Sahip, kendi klasöründeki dosyaları listeleyebilsin: storage remove() önce SELECT ister;
-- policy yokken silme sessizce "0 dosya" dönüyordu (eski görsel/video kovada kalıyordu).
-- Kovalar zaten herkese açık (public URL); bu policy yalnız API üzerinden listeleme/silme içindir.
begin;
drop policy if exists "users read own listing videos" on storage.objects;
create policy "users read own listing videos" on storage.objects for select to authenticated
  using (bucket_id = 'listing-videos' and (select auth.uid())::text = (storage.foldername(name))[1]);
drop policy if exists "users read own listing images" on storage.objects;
create policy "users read own listing images" on storage.objects for select to authenticated
  using (bucket_id = 'listing-images' and (select auth.uid())::text = (storage.foldername(name))[1]);
drop policy if exists "users read own profile avatars" on storage.objects;
create policy "users read own profile avatars" on storage.objects for select to authenticated
  using (bucket_id = 'profile-avatars' and (select auth.uid())::text = (storage.foldername(name))[1]);
commit;
