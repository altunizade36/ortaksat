-- Least-privilege hardening (2026-08-13): SECURITY DEFINER fonksiyon EXECUTE'ini daralt.
-- Supabase security advisor: "anon/authenticated_security_definer_function_executable".
-- Uygulamanın çağırdığı DEFINER fonksiyonları (partner shop, teklif, davet vb.) DOKUNULMAZ;
-- yalnızca DOĞRUDAN çağrılmaması gereken iki sınıf daraltılır:
--   1) TRIGGER fonksiyonları — trigger sistemi tablo-sahibi yetkisiyle çalıştırır; client'ın
--      doğrudan EXECUTE'una gerek yok (revoke trigger'ı BOZMAZ).
--   2) admin_* fonksiyonları — zaten içeride is_admin() kontrol eder; admin daima
--      authenticated → anon EXECUTE'u gereksiz (defense-in-depth).

-- Trigger fonksiyonlarından PUBLIC EXECUTE'i kaldır (anon/authenticated bunu PUBLIC'ten
-- miras alıyor → yalnız anon/authenticated'dan revoke etmek yetmez, PUBLIC gerekli).
-- Trigger sistemi EXECUTE iznini KONTROL ETMEZ + SECURITY DEFINER sahip yetkisiyle çalışır
-- → revoke trigger'ları BOZMAZ, yalnız doğrudan RPC çağrısını engeller.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prorettype = 'trigger'::regtype
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
end $$;
-- Not: admin_* fonksiyonları zaten yalnız authenticated'a açık (anon EXECUTE=0) ve
-- içeride is_admin() kontrol ediyor → ayrı işlem gerekmedi.
