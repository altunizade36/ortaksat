alter table public.commissions
  add column if not exists lead_id uuid references public.leads(id) on delete set null;

create index if not exists commissions_lead_idx on public.commissions(lead_id);
