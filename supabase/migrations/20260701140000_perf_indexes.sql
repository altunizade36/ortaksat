-- Yogun trafik / cascade-delete performansi icin eksik index'ler.
-- Hepsi ek (additive) ve idempotent; mevcut veriyi/RLS'i degistirmez.

-- messages.listing_id: ilan silinince cascade temizlik + ilana gore mesaj sorgusu.
create index if not exists messages_listing_idx on public.messages (listing_id);

-- leads: ilana gore ve durum/tarih filtreleri (satici paneli, cascade delete).
create index if not exists leads_listing_idx on public.leads (listing_id);
create index if not exists leads_status_created_idx on public.leads (status, created_at desc);

-- conversations: katilimci kolonlari uzerinden dogrudan aramalar (GIN'e ek).
create index if not exists conversations_seller_idx on public.conversations (seller_id);
create index if not exists conversations_buyer_idx on public.conversations (buyer_id);
create index if not exists conversations_partner_idx on public.conversations (partner_id);

-- commissions: partner/satici panel sorgulari (ortaklik + durum + tarih).
create index if not exists commissions_partnership_status_created_idx
  on public.commissions (partnership_id, status, created_at desc);
