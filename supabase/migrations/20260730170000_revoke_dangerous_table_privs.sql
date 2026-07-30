-- API rollerinden (anon + authenticated) gereksiz/tehlikeli TABLO-SEVİYESİ ayrıcalıklarını kaldır.
--
-- Denetim (2026-07-30): 48 public tablonun HEPSİNDE anon+authenticated'a TRUNCATE, TRIGGER
-- ve REFERENCES grant'ı vardı (muhtemelen bir `grant all on all tables` kalıntısı).
--
--   • TRUNCATE — KRİTİK: RLS'e TABİ DEĞİLDİR. RLS yalnız SELECT/INSERT/UPDATE/DELETE'i
--     satır-bazında filtreler; TRUNCATE bir tabloyu RLS'i tamamen bypass ederek boşaltır.
--     Hiçbir API rolüne verilmemeli (şu an PostgREST TRUNCATE'i sunmadığı için doğrudan
--     sömürülemez, ama gereksiz + tehlikeli yüzey — ör. gelecekte bir SD fonksiyonda
--     dinamik SQL olursa).
--   • TRIGGER / REFERENCES — DDL ayrıcalıkları (tabloya trigger / FK oluşturma). API rolü
--     asla kullanmaz; migration'lar zaten postgres olarak çalışır.
--
-- KORUNAN: SELECT/INSERT/UPDATE/DELETE. Bunları RLS satır-bazında zaten gate'liyor ve
-- uygulama kullanıyor → DOKUNULMAZ. Bu migration yalnız DDL/TRUNCATE yüzeyini kapatır,
-- işlevi etkilemez. Idempotent (revoke yoksa no-op).

do $$
declare r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'v', 'm', 'p')  -- tablo, view, matview, partitioned
  loop
    execute format('revoke truncate, references, trigger on public.%I from anon, authenticated', r.relname);
  end loop;
end $$;

-- Gelecekte oluşturulacak public tablolar da bu ayrıcalıkları anon/auth'a VERMESİN.
-- (Bu migration'ı çalıştıran rolün oluşturacağı tablolar için default; Supabase'de
-- şema sahibi/postgres tablo yaratır → kapsar.)
alter default privileges in schema public revoke truncate, references, trigger on tables from anon, authenticated;
