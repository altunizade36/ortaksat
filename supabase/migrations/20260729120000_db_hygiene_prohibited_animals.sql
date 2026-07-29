-- DB hijyeni (2026-07-29): (1) hayvan/yaban hayatı yasaklı kelimeleri (lib/moderation.ts
-- ile uyumlu; Hayvanlar Alemi Sahibinden paritesiyle eklendi), (2) user_active_days
-- fazla grant temizliği. Her ikisi de mgmt API ile canlıya uygulandı; bu dosya repro içindir.

-- 1) Yasaklı kelimeler — 5199 sayılı Kanun (yasaklı köpek ırkları, hayvan dövüşü) +
--    yaban hayatı ürünü/kaçak av. Idempotent: yalnızca olmayan keyword eklenir.
insert into public.prohibited_keywords (keyword, category, severity)
select v.keyword, 'hayvan', v.severity
from (values
  ('pitbull','block'), ('pit bull','block'), ('amerikan pitbull','block'),
  ('amerikan staffordshire terrier','block'), ('dogo argentino','block'),
  ('fila brasileiro','block'), ('japon tosa','block'),
  ('köpek dövüşü','block'), ('horoz dövüşü','block'), ('dövüş köpeği','block'),
  ('fildişi','block'), ('kaçak avlanmış','block'), ('nesli tükenmekte olan','block'),
  ('satılık köpek','review'), ('satılık kedi','review'),
  ('köpek satışı','review'), ('kedi satışı','review'),
  ('yaban hayvanı','review'), ('yabani hayvan','review'), ('kürk','review')
) as v(keyword, severity)
where not exists (select 1 from public.prohibited_keywords p where p.keyword = v.keyword);

-- 2) user_active_days DEFINER-ONLY tablo (heartbeat() + admin_live_analytics() SECURITY
--    DEFINER ile erişir). RLS açık + policy yok zaten anon/auth'u bloklar; fazla tablo
--    grant'ları gereksiz + gizli risk (anon DELETE/TRUNCATE) → revoke (savunma derinliği).
revoke all on table public.user_active_days from anon;
revoke all on table public.user_active_days from authenticated;
