-- Per-ortak komisyon override + kademeli (hacimle artan) komisyon.
-- Platform PARA TUTMAZ — bunlar yalnız komisyon HESABI parametreleri (satıcı taahhüdü).
-- 1) partnerships: satıcı bir ortağa ÖZEL komisyon belirleyebilir (rate/fixed). Set edilirse
--    o ortağın satışlarında ilan varsayılanı yerine bu kullanılır.
alter table public.partnerships
  add column if not exists commission_override_type text
    check (commission_override_type in ('rate', 'fixed')),
  add column if not exists commission_override_value numeric;

-- 2) listings: kademeli komisyon merdiveni (yalnız rate). Ortağın o ilandaki kümülatif
--    satış sayısına göre oran artar. Örn: [{"min":0,"rate":10},{"min":5,"rate":12},{"min":20,"rate":15}].
alter table public.listings
  add column if not exists commission_tiers jsonb;

-- anon/authenticated bu kolonları okuyabilmeli (public feed/detay komisyon gösterimi için).
grant select (commission_tiers) on public.listings to anon, authenticated;
grant select (commission_override_type, commission_override_value) on public.partnerships to anon, authenticated;
