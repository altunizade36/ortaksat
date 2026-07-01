-- Mesaj ekleri: gorsel/dosya gonderimi icin messages tablosuna ek sutunlar.
-- Geriye donuk uyumlu (nullable); mevcut metin mesajlari etkilenmez.

alter table public.messages
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists attachment_name text;

-- attachment_type yalnizca bilinen degerleri kabul etsin (veri butunlugu).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'messages_attachment_type_check'
  ) then
    alter table public.messages
      add constraint messages_attachment_type_check
      check (attachment_type is null or attachment_type in ('image', 'file'));
  end if;
end $$;
