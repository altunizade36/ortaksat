-- notifications icin INSERT politikasi eksikti; RLS acikken client insert'leri
-- (mesaj/ortaklik bildirimleri + admin duyurulari) engelleniyordu. Kimlik
-- dogrulanmis kullanici bildirim ekleyebilir (uygulama icerigi kontrol eder).

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'notifications' and policyname = 'authenticated insert notifications'
  ) then
    create policy "authenticated insert notifications" on public.notifications
      for insert with check (auth.uid() is not null);
  end if;
end $$;
