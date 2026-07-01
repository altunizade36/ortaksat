-- Ilan kalici silme yetkisi: ilan sahibi veya admin/moderator.
-- (Mevcut politikalar select/insert/update kapsiyordu; delete eksikti.)

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'listings' and policyname = 'owner or admin deletes listing'
  ) then
    create policy "owner or admin deletes listing" on public.listings
      for delete using (owner_id = auth.uid() or public.is_admin());
  end if;
end $$;
