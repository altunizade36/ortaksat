-- İade penceresi dolan komisyonları otomatik 'approved' yap (komisyon saati başlasın).
-- Eskiden 'return_pending' komisyon, satıcı elle "İade Bitti" tıklayana kadar takılıydı;
-- pasif satıcıda ortağın komisyonu sonsuza dek ödenemez durumda kalıyordu (denetim MED).
-- Platform PARA TUTMAZ — bu yalnız durum kaydını ilerletir.
create extension if not exists pg_cron;

create or replace function public.advance_return_pending_commissions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.commissions
    set status = 'approved',
        approved_at = coalesce(approved_at, now())
    where status = 'return_pending'
      and return_until is not null
      and return_until < current_date;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Günlük 03:15 (UTC) — iade süresi geçen komisyonları ilerlet.
select cron.schedule('advance-return-pending', '15 3 * * *', 'select public.advance_return_pending_commissions();')
where not exists (select 1 from cron.job where jobname = 'advance-return-pending');
