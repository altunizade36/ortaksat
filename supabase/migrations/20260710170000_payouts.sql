-- Toplu/kısmi ödeme KAYDI (payouts). Platform PARA TUTMAZ/AKTARMAZ — bu tablo yalnız
-- satıcının ortağa yaptığı DIŞ ödemenin kaydını tutar; bir ödeme birden çok komisyonu
-- kapatabilir (satıcı "şu ortağa şu ürün için toplu ödedim" der). Komisyonlar seller_paid'e
-- geçer + payout_id ile bağlanır. Ortak yine 'Ödemeyi Aldım' ile paid'e çevirir.
create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles(id) on delete cascade,
  partner_id uuid not null references public.profiles(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete set null,
  amount numeric not null default 0,
  commission_count integer not null default 0,
  note text,
  created_at timestamptz not null default now()
);

alter table public.commissions add column if not exists payout_id uuid references public.payouts(id) on delete set null;

create index if not exists payouts_seller_idx on public.payouts(seller_id);
create index if not exists payouts_partner_idx on public.payouts(partner_id);

alter table public.payouts enable row level security;

drop policy if exists "seller and partner read payouts" on public.payouts;
create policy "seller and partner read payouts" on public.payouts
  for select using (seller_id = auth.uid() or partner_id = auth.uid());

grant select on public.payouts to authenticated;

-- Toplu ödeme: satıcı, bir ortağın (ops. tek ilan) ödenmemiş komisyonlarını tek kayıtla
-- seller_paid yapar + payout kaydı oluşturur. Yalnız borçlu (return_pending/approved)
-- komisyonlar kapsanır; iptal/anlaşmazlık/ödenmiş hariç. SECURITY DEFINER + sahiplik kontrolü.
create or replace function public.record_payout(p_partner_id uuid, p_listing_id uuid, p_note text)
returns table(r_payout_id uuid, r_amount numeric, r_count integer)
language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_payout uuid; v_amount numeric := 0; v_count integer := 0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  -- Kapsanacak komisyonlar: satıcının (v_uid) ilanlarındaki, bu ortağa ait, borçlu olanlar.
  select coalesce(sum(c.amount), 0), count(*) into v_amount, v_count
    from public.commissions c
    join public.listings l on l.id = c.listing_id
    join public.partnerships pt on pt.id = c.partnership_id
    where l.owner_id = v_uid
      and pt.partner_id = p_partner_id
      and (p_listing_id is null or c.listing_id = p_listing_id)
      and c.status in ('return_pending', 'approved');
  if v_count = 0 then raise exception 'No owed commissions to pay'; end if;

  insert into public.payouts (seller_id, partner_id, listing_id, amount, commission_count, note)
    values (v_uid, p_partner_id, p_listing_id, v_amount, v_count, p_note)
    returning id into v_payout;

  update public.commissions c
    set status = 'seller_paid', seller_marked_paid_at = now(), payout_id = v_payout
    from public.listings l, public.partnerships pt
    where c.listing_id = l.id and c.partnership_id = pt.id
      and l.owner_id = v_uid and pt.partner_id = p_partner_id
      and (p_listing_id is null or c.listing_id = p_listing_id)
      and c.status in ('return_pending', 'approved');

  return query select v_payout, v_amount, v_count;
end $$;

grant execute on function public.record_payout(uuid, uuid, text) to authenticated;
