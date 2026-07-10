-- RLS initplan optimizasyonu: auth.uid()/role()/jwt() → (select ...). Anlamsal olarak BİREBİR
-- AYNI (kim neye erişir değişmez); yalnız Postgres satır-başı yerine sorgu-başı değerlendirir.
-- Atomik: bir ALTER hata verirse tüm blok geri alınır (kısmi değişiklik olmaz).
do $$
declare r record; nq text; nc text; stmt text; cnt int := 0;
begin
  for r in
    select schemaname, tablename, policyname, qual, with_check
    from pg_policies
    where schemaname='public'
      and (coalesce(qual,'')||coalesce(with_check,'')) ~ 'auth\.(uid|role|jwt|email)\(\)'
      and (coalesce(qual,'')||coalesce(with_check,'')) !~ '\( *[Ss][Ee][Ll][Ee][Cc][Tt] +auth\.'
  loop
    nq := case when r.qual is not null then regexp_replace(r.qual, 'auth\.(uid|role|jwt|email)\(\)', '(select auth.\1())', 'g') else null end;
    nc := case when r.with_check is not null then regexp_replace(r.with_check, 'auth\.(uid|role|jwt|email)\(\)', '(select auth.\1())', 'g') else null end;
    stmt := format('alter policy %I on %I.%I', r.policyname, r.schemaname, r.tablename);
    if nq is not null then stmt := stmt || ' using (' || nq || ')'; end if;
    if nc is not null then stmt := stmt || ' with check (' || nc || ')'; end if;
    execute stmt;
    cnt := cnt + 1;
  end loop;
  raise notice 'initplan rewrite done: % policies', cnt;
end $$;
