create type public.request_status as enum ('open', 'reviewing', 'completed', 'rejected');

create table public.legal_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  document_type text not null check (document_type in ('privacy', 'terms', 'kvkk', 'seller_rules')),
  version text not null default '2026-06-09',
  accepted boolean not null default true,
  accepted_at timestamptz not null default now(),
  unique (user_id, document_type, version)
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null,
  message text not null,
  status public.request_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  reason text not null default '',
  status public.request_status not null default 'open',
  requested_at timestamptz not null default now(),
  completed_at timestamptz
);

alter table public.legal_consents enable row level security;
alter table public.support_tickets enable row level security;
alter table public.account_deletion_requests enable row level security;

create policy "users manage own legal consents" on public.legal_consents for all
  using (user_id = auth.uid() or public.is_admin())
  with check (user_id = auth.uid() or public.is_admin());

create policy "users create support tickets" on public.support_tickets for insert
  with check (user_id = auth.uid());
create policy "users read own support tickets" on public.support_tickets for select
  using (user_id = auth.uid() or public.is_admin());
create policy "admins update support tickets" on public.support_tickets for update
  using (public.is_admin())
  with check (public.is_admin());

create policy "users create account deletion requests" on public.account_deletion_requests for insert
  with check (user_id = auth.uid());
create policy "users read own account deletion requests" on public.account_deletion_requests for select
  using (user_id = auth.uid() or public.is_admin());
create policy "admins update account deletion requests" on public.account_deletion_requests for update
  using (public.is_admin())
  with check (public.is_admin());

grant select, insert, update on public.legal_consents to authenticated;
grant select, insert, update on public.support_tickets to authenticated;
grant select, insert, update on public.account_deletion_requests to authenticated;

create index legal_consents_user_idx on public.legal_consents(user_id);
create index support_tickets_user_status_idx on public.support_tickets(user_id, status);
create index account_deletion_requests_user_status_idx on public.account_deletion_requests(user_id, status);
