-- Support conversations and private evidence for support/report screens.
alter table public.support_tickets
  add column if not exists category text not null default 'Diğer',
  add column if not exists attachments text[] not null default '{}',
  add column if not exists answered boolean not null default false;
alter table public.reports add column if not exists attachments text[] not null default '{}';

create or replace function public.validate_mobile_evidence(paths text[], owner_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare p text;
begin
  if cardinality(paths) > 5 or owner_id is null then raise exception 'En fazla 5 görsel eklenebilir.' using errcode='22023'; end if;
  foreach p in array paths loop
    if p is null or p !~ ('^' || owner_id::text || '/[a-f0-9-]+\.(jpg|jpeg|png)$') then
      raise exception 'Geçersiz ek dosyası.' using errcode='22023';
    end if;
  end loop;
end $$;
revoke all on function public.validate_mobile_evidence(text[],uuid) from public,anon;
grant execute on function public.validate_mobile_evidence(text[],uuid) to authenticated;

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check (char_length(btrim(body)) between 1 and 1000),
  attachments text[] not null default '{}',
  is_staff boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket_created_idx on public.support_messages(ticket_id,created_at,id);
create index if not exists support_messages_author_idx on public.support_messages(author_id);
alter table public.support_messages enable row level security;
drop policy if exists "ticket participants read messages" on public.support_messages;
create policy "ticket participants read messages" on public.support_messages for select to authenticated using (
  exists(select 1 from public.support_tickets t where t.id=ticket_id and (t.user_id=(select auth.uid()) or (select public.is_admin())))
);
drop policy if exists "ticket participants send messages" on public.support_messages;
create policy "ticket participants send messages" on public.support_messages for insert to authenticated with check (
  author_id=(select auth.uid()) and exists(select 1 from public.support_tickets t where t.id=ticket_id and t.status in ('open','reviewing') and (t.user_id=(select auth.uid()) or (select public.is_admin())))
);
grant select,insert on public.support_messages to authenticated;
revoke all on public.support_messages from anon;

create or replace function private.mobile_support_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501'; end if;
  perform public.validate_mobile_evidence(new.attachments,new.user_id);
  if tg_op='INSERT' then
    if new.user_id<>auth.uid() then raise exception 'Bu hesap için talep oluşturulamaz.' using errcode='42501'; end if;
    new.answered:=false; new.status:='open'; new.created_at:=now(); new.updated_at:=now();
    if char_length(btrim(new.subject)) not between 3 and 100 or char_length(new.message) not between 1 and 2000 or char_length(new.category)>100 then
      raise exception 'Talep alanlarını kontrol et.' using errcode='22023';
    end if;
  end if;
  return new;
end $$;
revoke all on function private.mobile_support_guard() from public,anon;
grant execute on function private.mobile_support_guard() to authenticated;
drop trigger if exists mobile_support_guard on public.support_tickets;
create trigger mobile_support_guard before insert or update on public.support_tickets for each row execute function private.mobile_support_guard();

create or replace function private.mobile_support_message_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or new.author_id<>auth.uid() then raise exception 'Gönderici hesabı geçersiz.' using errcode='42501'; end if;
  perform public.validate_mobile_evidence(new.attachments,new.author_id);
  new.is_staff:=public.is_admin(); new.created_at:=now();
  return new;
end $$;
revoke all on function private.mobile_support_message_guard() from public,anon;
grant execute on function private.mobile_support_message_guard() to authenticated;
drop trigger if exists mobile_support_message_guard on public.support_messages;
create trigger mobile_support_message_guard before insert on public.support_messages for each row execute function private.mobile_support_message_guard();

-- Internal trigger updates only the ticket referenced by the authenticated author.
create or replace function private.mobile_support_message_received()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or new.author_id<>auth.uid() then raise exception 'Giriş gerekli.' using errcode='42501'; end if;
  update public.support_tickets set answered=new.is_staff,updated_at=now() where id=new.ticket_id;
  return new;
end $$;
revoke all on function private.mobile_support_message_received() from public,anon,authenticated;
drop trigger if exists mobile_support_message_received on public.support_messages;
create trigger mobile_support_message_received after insert on public.support_messages for each row execute function private.mobile_support_message_received();

create or replace function private.mobile_report_evidence_guard()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Giriş gerekli.' using errcode='42501'; end if;
  perform public.validate_mobile_evidence(new.attachments,new.reporter_id);
  if tg_op='INSERT' then
    new.status:='open'; new.resolved_by:=null; new.resolved_at:=null;
  end if;
  return new;
end $$;
revoke all on function private.mobile_report_evidence_guard() from public,anon;
grant execute on function private.mobile_report_evidence_guard() to authenticated;
drop trigger if exists mobile_report_evidence_guard on public.reports;
create trigger mobile_report_evidence_guard before insert or update of attachments on public.reports for each row execute function private.mobile_report_evidence_guard();
create index if not exists reports_reporter_created_idx on public.reports(reporter_id,created_at desc,id);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('private-evidence','private-evidence',false,5242880,array['image/jpeg','image/png'])
on conflict(id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png'];
drop policy if exists "evidence owner inserts" on storage.objects;
create policy "evidence owner inserts" on storage.objects for insert to authenticated with check (
  bucket_id='private-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text
);
drop policy if exists "evidence participants read" on storage.objects;
create policy "evidence participants read" on storage.objects for select to authenticated using (
  bucket_id='private-evidence' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select public.is_admin()) or exists (
    select 1 from public.support_messages m join public.support_tickets t on t.id=m.ticket_id
    where name=any(m.attachments) and t.user_id=(select auth.uid())
  ))
);
drop policy if exists "evidence owner removes unused" on storage.objects;
create policy "evidence owner removes unused" on storage.objects for delete to authenticated using (
  bucket_id='private-evidence' and (storage.foldername(name))[1]=(select auth.uid())::text
  and not exists(select 1 from public.support_tickets t where name=any(t.attachments))
  and not exists(select 1 from public.support_messages m where name=any(m.attachments))
  and not exists(select 1 from public.reports r where name=any(r.attachments))
);
