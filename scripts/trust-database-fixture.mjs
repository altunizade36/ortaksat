import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
const seller='11111111-1111-4111-8111-111111111111',partner='22222222-2222-4222-8222-222222222222',buyer='33333333-3333-4333-8333-333333333333',outsider='44444444-4444-4444-8444-444444444444',admin='55555555-5555-4555-8555-555555555555';
const listing='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',partnership='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

export const trustIds={seller,partner,buyer,outsider,admin,listing,partnership};
export async function createTrustDatabase(adapter){
 const db=adapter||new PGlite();
 await db.exec(`
 create role anon;create role authenticated;create role service_role;
 create schema auth;grant usage on schema auth to anon,authenticated;
 create schema storage;grant usage on schema storage to anon,authenticated,service_role;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid() primary key,bucket_id text,name text,unique(bucket_id,name));
 alter table storage.objects enable row level security;grant select,insert,update,delete on storage.objects to authenticated;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create table auth.users(id uuid primary key,phone_confirmed_at timestamptz,email text,email_confirmed_at timestamptz);
 create table public.profiles(id uuid primary key,role text default 'user',status text default 'active',full_name text,avatar_url text,created_at timestamptz default now());
 create table public.listings(id uuid primary key,owner_id uuid,title text,currency text,stock_count integer not null default 100,status text not null default 'active');
 create table public.partnerships(id uuid primary key,listing_id uuid,partner_id uuid,status text,deleted_at timestamptz,ref_code text);
 create type public.commission_status as enum('pending','return_pending','approved','seller_paid','paid','cancelled','disputed');
 create type public.order_status as enum('confirmed');
 create table public.orders(id uuid primary key,listing_id uuid,seller_id uuid,partnership_id uuid,amount numeric,status public.order_status);
 create table public.commissions(id uuid primary key,order_id uuid,listing_id uuid,partnership_id uuid,amount numeric not null,sale_amount numeric,status public.commission_status not null,quantity integer not null default 1,delivery_status public.order_status default 'confirmed',approved_at timestamptz,paid_at timestamptz,seller_marked_paid_at timestamptz,partner_confirmed_paid_at timestamptz,buyer_confirmed_at timestamptz,buyer_confirm_status text,return_until date,deleted_at timestamptz);
 create table public.activity_logs(id bigint generated always as identity primary key,user_id uuid,action text,entity_type text,entity_id text,metadata jsonb,created_at timestamptz default now());
 create table public.notifications(id uuid primary key,user_id uuid,type text,title text,body text,read boolean,metadata jsonb);
 insert into public.profiles(id,role) values('${seller}','user'),('${partner}','user'),('${buyer}','user'),('${outsider}','user'),('${admin}','admin');
 insert into auth.users(id,phone_confirmed_at) select id,now() from public.profiles;
 insert into public.listings(id,owner_id,title,currency) values('${listing}','${seller}','Synthetic test listing','TRY');
 insert into public.partnerships values('${partnership}','${listing}','${partner}','active',null,'synthetic-code');
 `);
 await db.exec(readFileSync('scripts/fixtures/trust-legacy-guard.sql','utf8'));
 for(const file of readdirSync('supabase/migrations').filter(x=>x.includes('_trust_system_v1_')).sort())await db.exec(readFileSync('supabase/migrations/'+file,'utf8'));

return db;
}
