-- Save the cover and listing fields in one transaction. An image-row error must
-- roll back the listing update rather than silently leaving an empty cover.
alter table public.listings add column if not exists cover_image_url text;
alter table public.listings add constraint listing_cover_url_valid check (
 cover_image_url is null or cover_image_url='' or
 (char_length(cover_image_url)<=4096 and cover_image_url ~* '^(https?://|/[^/])')
);
create or replace function private.sync_mobile_listing_cover() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' and new.cover_image_url is null then return new; end if;
 delete from public.listing_images where listing_id=new.id and sort_order=0;
 if nullif(new.cover_image_url,'') is not null then
   insert into public.listing_images(listing_id,url,sort_order) values(new.id,new.cover_image_url,0);
 end if;
 return new;
end $$;
revoke all on function private.sync_mobile_listing_cover() from public,anon,authenticated;
create trigger sync_mobile_listing_cover_insert after insert on public.listings
 for each row execute function private.sync_mobile_listing_cover();
create trigger sync_mobile_listing_cover_update after update of cover_image_url on public.listings
 for each row execute function private.sync_mobile_listing_cover();
