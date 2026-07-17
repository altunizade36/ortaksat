-- ============================================================================
-- 2026-07-17 — Ortaklık P0-2 (override tabanı) + P1-5 (ham join kapısı)
-- Adversarial denetim bulguları. CANLIYA uygulandı, rollback-testli doğrulandı,
-- E2E 55 (ortak ol → satış → komisyon → kazanç) PASS.
-- KANIT: anlaşılan=20000 | override KESME denemesi=20000 (etkisiz) |
--        override İYİLEŞTİRME=30000 (geçerli) | ham self-insert=RLS reddetti.
-- ============================================================================

-- ============================================================================
-- P0-2: commission_override ANLAŞILAN kilidi baypas ediyordu.
-- P1-5: partnerships INSERT policy'si partner_join'in TÜM korumalarını atlıyordu.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- P0-2: Override YALNIZ ORTAĞIN LEHİNEYSE geçerli.
-- ÖNCE: compute_agreed_commission override'ı agreed'den ÖNCE kontrol edip DÖNÜYORDU →
--   satıcı `setPartnershipCommission` ile tek taraflı, sessizce, tabansız kesebiliyordu
--   (agreed %20 = 20.000₺ iken override fixed 1₺ → komisyon 1₺). Şart kilidi (P0-1) düzelse
--   bile bu kapı açıkken kilit DEKORATİF kalıyordu.
-- KURAL: Platformun vaadi "anlaşılan şartlar kilitli". Satıcının tek taraflı KESMESİ bu vaadi
--   çürütür; DAHA İYİ oran vermesi meşru bir özelliktir. Bu yüzden override yalnız ortağın
--   lehineyse uygulanır. Sabit↔oran karşılaştırması sorunu: ikisi de satış anında SAYIYA
--   çevrilip greatest() alınır → tür farkı sorun olmaz.
-- (Ortakla anlaşarak oranı DÜŞÜRMEK isteniyorsa: ortaklığı sonlandırıp yeni şartlarla
--  yeniden kurulmalı — yani ortağın rızası gerekir. Kilidin amacı bu.)
create or replace function public.compute_agreed_commission(p_partnership_id uuid, p_sale_amount numeric, p_quantity integer, p_prior_sales integer)
returns numeric
language plpgsql
stable security definer set search_path to 'public'
as $function$
declare p record; l record; v_rate numeric; v_tier jsonb; v_best numeric; v_min int;
        v_agreed numeric; v_override numeric;
begin
  select * into p from public.partnerships where id = p_partnership_id;
  if p is null then return 0; end if;

  -- 1) ANLAŞILAN TABAN: agreed snapshot (join'de kilitlenen) > canlı ilan (eski ortaklıklar için).
  if p.agreed_commission_type is not null and p.agreed_commission_value is not null then
    if p.agreed_commission_type = 'rate' then
      v_rate := p.agreed_commission_value; v_best := v_rate; v_min := -1;
      if p.agreed_commission_tiers is not null then
        for v_tier in select * from jsonb_array_elements(p.agreed_commission_tiers) loop
          if coalesce((v_tier->>'minSales')::int,0) <= p_prior_sales and coalesce((v_tier->>'minSales')::int,0) > v_min then
            v_min := (v_tier->>'minSales')::int; v_best := coalesce((v_tier->>'rate')::numeric, v_rate);
          end if;
        end loop;
      end if;
      v_agreed := round(p_sale_amount * v_best / 100.0);
    else
      v_agreed := round(p.agreed_commission_value * greatest(1, p_quantity));
    end if;
  else
    select commission_type, commission_value, commission_tiers into l from public.listings where id = p.listing_id;
    if l.commission_type = 'rate' then
      v_agreed := round(p_sale_amount * l.commission_value / 100.0);
    else
      v_agreed := round(l.commission_value * greatest(1, p_quantity));
    end if;
  end if;

  -- 2) Per-ortak override: hesapla, ama YALNIZ DAHA İYİYSE uygula.
  if p.commission_override_type is not null and p.commission_override_value is not null then
    if p.commission_override_type = 'rate' then
      v_override := round(p_sale_amount * p.commission_override_value / 100.0);
    else
      v_override := round(p.commission_override_value * greatest(1, p_quantity));
    end if;
    return greatest(coalesce(v_agreed, 0), coalesce(v_override, 0));
  end if;

  return coalesce(v_agreed, 0);
end; $function$;

-- ---------------------------------------------------------------------------
-- P1-5: Ham INSERT kapısını kapat → ortaklık YALNIZ partner_join RPC'siyle kurulur.
-- ÖNCE: "users apply as partner" INSERT check'i yalnız `partner_id = auth.uid()` istiyordu;
--   trg_enforce_partnership_approval ise SADECE status'u normalize ediyor (owner<>partner,
--   ilan durumu, demo, min_partner_rating KONTROL ETMİYOR). Sonuç: satıcı KENDİ açık ilanına
--   `status='active'` ile self-ortaklık POST'layıp kendine satış kaydeder, record_payout ile
--   seller_paid yapar, "ortak" sıfatıyla paid onaylar → partner_leaderboard_public'te sahte
--   confirmed_sales/paid_earned + profilinde şişmiş successful_sales. Güven satan bir platformda
--   uydurma sicil. Ayrıca demo/paused/sold ilana katılma ve min_partner_rating baypası.
-- GÜVENLİ: istemci partnerships'e DOĞRUDAN insert ETMİYOR (grep: 0 sonuç) — yalnız partner_join
--   RPC'si kullanılıyor; o SECURITY DEFINER olduğu için RLS'i aşarak ekler, politikaya ihtiyacı yok.
drop policy if exists "users apply as partner" on public.partnerships;
