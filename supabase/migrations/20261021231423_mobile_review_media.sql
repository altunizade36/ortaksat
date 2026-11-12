alter table public.reviews
  add column if not exists experience_tags text[] not null default '{}',
  add column if not exists media_paths text[] not null default '{}';
revoke insert,update,delete on public.reviews from anon;
create or replace function private.mobile_review_media_guard()
returns trigger language plpgsql security invoker set search_path='' as $$
declare tag text;
begin
  perform public.validate_mobile_evidence(new.media_paths,new.reviewer_id);
  if cardinality(new.experience_tags)>8 then raise exception 'En fazla 8 etiket seçilebilir.' using errcode='22023'; end if;
  foreach tag in array new.experience_tags loop
    if tag is null or char_length(tag) not between 1 and 50 then raise exception 'Geçersiz deneyim etiketi.' using errcode='22023'; end if;
  end loop;
  return new;
end $$;
revoke all on function private.mobile_review_media_guard() from public,anon;
grant execute on function private.mobile_review_media_guard() to authenticated;
drop trigger if exists mobile_review_media_guard on public.reviews;
create trigger mobile_review_media_guard before insert or update of experience_tags,media_paths on public.reviews for each row execute function private.mobile_review_media_guard();
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('review-media','review-media',true,5242880,array['image/jpeg','image/png'])
on conflict(id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png'];
drop policy if exists "review media owner inserts" on storage.objects;
create policy "review media owner inserts" on storage.objects for insert to authenticated with check(bucket_id='review-media' and (storage.foldername(name))[1]=(select auth.uid())::text);
drop policy if exists "review media public reads" on storage.objects;
create policy "review media public reads" on storage.objects for select to anon,authenticated using(bucket_id='review-media');
drop policy if exists "review media owner removes unused" on storage.objects;
create policy "review media owner removes unused" on storage.objects for delete to authenticated using(bucket_id='review-media' and (storage.foldername(name))[1]=(select auth.uid())::text and not exists(select 1 from public.reviews r where name=any(r.media_paths) and r.deleted_at is null));
