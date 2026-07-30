-- Supabase Advisor (Security + Performance) sıkılaştırması — 2026-07-30
--
-- Kaynak: `node scripts/supabase-advisors.mjs` bulguları. Bu migration YALNIZCA
-- KANITLANABİLİR-GÜVENLİ (davranış-koruyan) değişiklikler içerir:
--   (a) admin_* fonksiyonlarını anon rolünden kaldır (defense-in-depth),
--   (b) gereksiz/kopya RLS policy'lerini sil (permissive policy'ler OR'lanır → aynı
--       erişimi veren başka policy varken kopya dal sadece fazladan predicate'tir).
--
-- BİLİNÇLİ OLARAK DOKUNULMAYANLAR (advisor "uyarı" der ama düzeltmek YANLIŞ olur):
--   • unused_index ×64 (INFO): indeksler ölçek/sayfalama için bilinçli eklendi;
--     "kullanılmıyor" = henüz-trafik-yok, işe-yaramaz DEĞİL. Silmek ölçekte zarar.
--   • 49 non-admin SECURITY DEFINER fonksiyonun anon-exec'i: hepsi auth.uid() ile
--     iç-korumalı VEYA bilinçli herkese-açık (partner_public_shop, resolve_referral_link
--     vb.). Kaldırmak public özellikleri bozar.
--   • extension_in_public (pg_net/pg_trgm/unaccent): taşımak riskli, kazanç yok.
--   • rls_enabled_no_policy (listing_views/referral_public_links/user_active_days):
--     policy YOK + anon/auth grant YOK = yalnız SECURITY DEFINER fn'ler yazar. Kilit
--     bilinçli ve doğru.
--   • Farklı-predicate'li kalan çoklu-permissive'ler (messages SELECT, commissions/leads
--     UPDATE, activity_logs SELECT, profiles UPDATE): OR-birleştirme davranış-koruyan
--     ama transkripsiyon-riskli; trafik-öncesi kazanç ~0 → düşük-öncelik ölçek işi.
--
-- NOT: Sızdırılmış-parola koruması (auth password_hibp_enabled) SQL değildir; Supabase
-- Management API auth config üzerinden AÇILDI (bu migration ile aynı turda).

-- (a) GÜVENLİK — admin_* SECURITY DEFINER fn'leri anon'a açıktı (lint 0028_anon_...).
-- 11 fonksiyonun HEPSİ zaten iç rol-kontrollü (role in admin/super_admin/moderator,
-- yoksa "not authorized" raise). Admin panel authenticated admin ile çalışır; anon
-- hiçbir admin işlemini meşru çağırmaz → anon EXECUTE'u kaldırmak güvenli + saldırı
-- yüzeyini kapatır. DİKKAT: fn'lerde EXECUTE varsayılan olarak PUBLIC'e grant'lı;
-- yalnız 'from anon' revoke PUBLIC üzerinden anon erişimini bırakır → PUBLIC'ten
-- revoke edip authenticated'a AÇIKÇA grant ver (admins authenticated → panel çalışır,
-- anon tamamen düşer). Signatürler değişebildiği için oid::regprocedure ile döngü.
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'admin\_%' and p.prosecdef
  loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

-- (b) PERFORMANS — multiple_permissive_policies (lint 0006_...). Kanıtlanabilir kopyalar:

-- favorites: "users read own favorites" (SELECT, user_id = auth.uid()) — "users manage
-- own favorites" (ALL, user_id = auth.uid()) zaten aynı SELECT'i kapsar. Kopya.
drop policy if exists "users read own favorites" on public.favorites;

-- listings: "admins read all listings" (SELECT, is_admin()) — "active listings are
-- readable" USING '... OR is_admin()' içerdiğinden admin okuması aynen korunur. Fazla.
drop policy if exists "admins read all listings" on public.listings;

-- profiles: "admins read all profiles" (SELECT, USING 'is_admin() OR true' = true) —
-- "profiles are readable" (SELECT, USING true) ile BİREBİR aynı erişim. Kopya.
drop policy if exists "admins read all profiles" on public.profiles;

-- messages: "Message receiver can mark read" (UPDATE, receiver_id = auth.uid()) —
-- "receiver marks messages read" (UPDATE, receiver_id = auth.uid()) ile BİREBİR aynı.
drop policy if exists "Message receiver can mark read" on public.messages;
