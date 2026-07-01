-- Satici/ortak panellerinin canli guncellenmesi icin ilgili tablolari
-- supabase_realtime publication'ina ekler. RLS zaten aboneye yalnizca gorme
-- yetkisi olan satirlari teslim eder. Idempotent (zaten ekliyse atlar).

do $$
declare
  t text;
  tables text[] := array['partnerships', 'leads', 'commissions', 'orders', 'notifications', 'listings'];
begin
  foreach t in array tables loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
