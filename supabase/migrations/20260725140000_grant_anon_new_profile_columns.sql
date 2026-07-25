-- ANON KOLON-GRANT DÜZELTMESİ (401 → ilan detay/kategori sayfasında satıcı bilgisi boş)
--
-- SORUN: PUBLIC_PROFILE_COLUMNS (lib/supabase-data.ts) profiles'tan invite_code +
--   expertise_categories da seçiyor. Bu iki kolon SON eklendi (Y8 davet + uzmanlık
--   migration'ları) ama anon'a column-level SELECT grant'ı verilMEDİ. PostgREST, seçilen
--   TEK bir kolonda bile yetki yoksa TÜM sorguyu 401'ler → anon ziyaretçi (cold-start
--   trafiğinin çoğu) ilan detayında + kategori sayfasında satıcının adı/puanı/rozetini
--   GÖREMİYOR. Diğer 15 kolon zaten anon'a grant'lı; bu ikisi listeden düşmüştü.
--
-- ÇÖZÜM: iki kolona da anon + authenticated column-level SELECT ver. Her ikisi de
--   yayınlanabilir: expertise_categories herkese-açık vitrinde zaten gösteriliyor;
--   invite_code paylaşılabilir davet kodudur (gizli değil). Tablo-geneli SELECT VERİLMEZ
--   (kolon-bazlı grant deseni korunur → gelecekte eklenen özel kolonlar sızmaz).

grant select (invite_code, expertise_categories) on public.profiles to anon, authenticated;
