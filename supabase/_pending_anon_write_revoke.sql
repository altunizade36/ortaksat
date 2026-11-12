begin;
-- Derinlemesine savunma: anonim rolun RLS ile zaten engellenen tablo yazma yetkileri kaldirilir.
-- Anonim yalniz referans talebi (leads) ve bulten kaydi ekleyebilir.
revoke insert, update, delete, truncate on all tables in schema public from anon;
grant insert on public.leads to anon;
grant insert on public.newsletter_subscribers to anon;
alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon;

-- Bulten: kosulsuz insert yerine bicim/uzunluk denetimi + tekillik (bot dolgusuna karsi).
drop policy if exists "newsletter public insert" on public.newsletter_subscribers;
create policy "newsletter public insert" on public.newsletter_subscribers for insert to public
  with check (char_length(email) between 6 and 254 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[a-z]{2,}$');
-- (email) uzerinde tekil kisit zaten var; istemci kucuk harfe cevirip gonderir.
commit;
