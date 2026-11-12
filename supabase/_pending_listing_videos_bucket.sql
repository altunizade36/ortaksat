-- Ilan videosu: ilan basina tek, kisa video. Ayri kova: boyut ve tur siniri sunucuda zorlanir.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-videos', 'listing-videos', true, 26214400, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "users upload listing videos" on storage.objects;
create policy "users upload listing videos" on storage.objects for insert to public
  with check (bucket_id = 'listing-videos' and auth.role() = 'authenticated' and (auth.uid())::text = (storage.foldername(name))[1]);
drop policy if exists "users update own listing videos" on storage.objects;
create policy "users update own listing videos" on storage.objects for update to public
  using (bucket_id = 'listing-videos' and (auth.uid())::text = (storage.foldername(name))[1])
  with check (bucket_id = 'listing-videos' and (auth.uid())::text = (storage.foldername(name))[1]);
drop policy if exists "users delete own listing videos" on storage.objects;
create policy "users delete own listing videos" on storage.objects for delete to public
  using (bucket_id = 'listing-videos' and (auth.uid())::text = (storage.foldername(name))[1]);
