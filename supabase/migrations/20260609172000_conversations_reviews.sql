create table if not exists public.conversations (
  id uuid primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  seller_id uuid not null references public.profiles(id) on delete cascade,
  buyer_id uuid references public.profiles(id) on delete set null,
  partner_id uuid references public.profiles(id) on delete set null,
  participant_ids uuid[] not null default '{}',
  status text not null default 'open' check (status in ('open', 'closed', 'blocked')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.messages add column if not exists conversation_id uuid references public.conversations(id) on delete cascade;
alter table public.reviews add column if not exists sale_id uuid references public.commissions(id) on delete set null;
alter table public.reviews add column if not exists reviewed_user_id uuid references public.profiles(id) on delete set null;
alter table public.reviews add column if not exists type text not null default 'product' check (type in ('seller', 'partner', 'product'));

create index if not exists conversations_listing_idx on public.conversations(listing_id);
create index if not exists conversations_participants_idx on public.conversations using gin(participant_ids);
create index if not exists messages_conversation_idx on public.messages(conversation_id, created_at desc);
create unique index if not exists reviews_sale_reviewer_unique on public.reviews(sale_id, reviewer_id) where sale_id is not null;

alter table public.conversations enable row level security;

drop policy if exists "Conversation participants can read" on public.conversations;
create policy "Conversation participants can read"
  on public.conversations for select
  using (auth.uid() = any(participant_ids));

drop policy if exists "Conversation participants can create" on public.conversations;
create policy "Conversation participants can create"
  on public.conversations for insert
  with check (auth.uid() = any(participant_ids));

drop policy if exists "Conversation participants can update own" on public.conversations;
create policy "Conversation participants can update own"
  on public.conversations for update
  using (auth.uid() = any(participant_ids))
  with check (auth.uid() = any(participant_ids));

drop policy if exists "Message sender can create in conversation" on public.messages;
create policy "Message sender can create in conversation"
  on public.messages for insert
  with check (
    auth.uid() = sender_id and exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() = any(c.participant_ids)
    )
  );

drop policy if exists "Conversation messages can be read" on public.messages;
create policy "Conversation messages can be read"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations c
      where c.id = conversation_id and auth.uid() = any(c.participant_ids)
    )
  );

drop policy if exists "Message receiver can mark read" on public.messages;
create policy "Message receiver can mark read"
  on public.messages for update
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

create or replace function public.touch_conversation_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set last_message_at = coalesce(new.created_at, now())
  where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists touch_conversation_last_message on public.messages;
create trigger touch_conversation_last_message
after insert on public.messages
for each row
when (new.conversation_id is not null)
execute function public.touch_conversation_last_message();

alter publication supabase_realtime add table public.conversations;
alter publication supabase_realtime add table public.messages;
