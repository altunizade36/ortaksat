import { readFileSync } from 'fs';
const env = readFileSync('.env','utf8');
const tok = env.match(/SUPABASE_MGMT_TOKEN=(.+)/)[1].trim();
async function q(sql){
  const r = await fetch('https://api.supabase.com/v1/projects/akyzzdwbzgsnhdircuce/database/query',{
    method:'POST',headers:{'Authorization':`Bearer ${tok}`,'Content-Type':'application/json'},
    body:JSON.stringify({query:sql})});
  const t = await r.text(); if(!r.ok){console.log('ERR',r.status,t);return null;} return JSON.parse(t);
}
console.log("=== functions list ===");
console.log(JSON.stringify(await q(`select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and proname like '%commission%' or proname in ('compute_agreed_commission','record_payout','bump_seller_successful_sales','audit_commission_change');`),null,1));
console.log("=== commissions columns (amount nullable/type) ===");
console.log(JSON.stringify(await q(`select column_name, data_type, is_nullable, column_default from information_schema.columns where table_name='commissions' and column_name in ('amount','sale_amount','quantity','status') order by column_name;`),null,1));
console.log("=== commission_status enum values ===");
console.log(JSON.stringify(await q(`select enumlabel from pg_enum e join pg_type t on t.oid=e.enumtypid where t.typname='commission_status' order by e.enumsortorder;`),null,1));
console.log("=== record_payout def ===");
console.log(JSON.stringify(await q(`select pg_get_functiondef(oid) as def from pg_proc where proname='record_payout';`),null,1));
