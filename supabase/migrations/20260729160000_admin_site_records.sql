-- Admin "Site Kayıtları" (2026-07-29): sitede olup admin panelinde bölümü OLMAYAN
-- varlıkları operatörün görebilmesi/kontrol edebilmesi için tek admin-gated RPC.
-- Teklifler (offers), Yorumlar (reviews), İlan Soru-Cevap (listing_questions),
-- Talepler (leads), Ortak Aranıyor talepleri (partner_requests). Her biri son 30 kayıt +
-- toplam sayı. SECURITY DEFINER + admin guard (admin_live_analytics ile aynı desen).

create or replace function public.admin_site_records()
returns json language plpgsql security definer
set search_path to 'public'
as $$
declare is_admin boolean; result json;
begin
  select (role in ('admin','super_admin','moderator') and coalesce(status,'active') <> 'suspended')
    into is_admin from public.profiles where id = auth.uid();
  if not coalesce(is_admin, false) then raise exception 'not authorized'; end if;
  select json_build_object(
    'offers_count', (select count(*) from public.offers),
    'offers', (select json_agg(json_build_object('id', o.id, 'listingId', o.listing_id, 'amount', o.amount, 'counterAmount', o.counter_amount, 'status', o.status, 'note', o.note, 'createdAt', o.created_at) order by o.created_at desc) from (select * from public.offers order by created_at desc limit 30) o),
    'reviews_count', (select count(*) from public.reviews where deleted_at is null),
    'reviews', (select json_agg(json_build_object('id', r.id, 'listingId', r.listing_id, 'rating', r.rating, 'comment', r.comment, 'type', r.type, 'deleted', (r.deleted_at is not null), 'createdAt', r.created_at) order by r.created_at desc) from (select * from public.reviews order by created_at desc limit 30) r),
    'questions_count', (select count(*) from public.listing_questions),
    'questions', (select json_agg(json_build_object('id', q.id, 'listingId', q.listing_id, 'askerName', q.asker_name, 'question', q.question, 'answer', q.answer, 'createdAt', q.created_at) order by q.created_at desc) from (select * from public.listing_questions order by created_at desc limit 30) q),
    'leads_count', (select count(*) from public.leads),
    'leads', (select json_agg(json_build_object('id', l.id, 'listingId', l.listing_id, 'buyerName', l.buyer_name, 'note', l.note, 'source', l.source, 'intent', l.intent, 'status', l.status, 'createdAt', l.created_at) order by l.created_at desc) from (select * from public.leads order by created_at desc limit 30) l),
    'partner_requests_count', (select count(*) from public.partner_requests),
    'partner_requests', (select json_agg(json_build_object('id', p.id, 'title', p.title, 'category', p.category, 'commissionHint', p.commission_hint, 'location', p.location, 'status', p.status, 'createdAt', p.created_at) order by p.created_at desc) from (select * from public.partner_requests order by created_at desc limit 30) p)
  ) into result;
  return result;
end; $$;
revoke all on function public.admin_site_records() from public;
grant execute on function public.admin_site_records() to authenticated;
