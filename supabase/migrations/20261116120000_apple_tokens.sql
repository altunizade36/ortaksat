-- "Apple ile giriş" yenileme belirteçleri (2026-11-16).
--
-- App Store kuralı 5.1.1(v): Apple ile giriş kullanan bir hesap silinirken uygulama, Apple'ın belirteç iptal
-- uç noktasını çağırmalıdır. Bunun için girişte alınan yetkilendirme kodu Apple'da yenileme belirtecine çevrilip
-- saklanır; hesap silme talebinde bu belirteç iptal edilir (supabase/functions/apple-token).
--
-- Tabloya İSTEMCİ HİÇ ERİŞEMEZ (RLS açık, politika yok, izin yok): yalnız sunucu işlevi (hizmet anahtarı) okur/yazar.
create table if not exists public.apple_tokens (
  user_id uuid primary key references auth.users(id) on delete cascade,
  refresh_token text not null,
  updated_at timestamptz not null default now()
);
alter table public.apple_tokens enable row level security;
revoke all on public.apple_tokens from anon, authenticated;
