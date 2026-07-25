import { readFileSync } from 'fs';
const env = readFileSync('.env','utf8');
const tok = env.match(/SUPABASE_MGMT_TOKEN=(.+)/)[1].trim();
async function q(sql){
  const r = await fetch('https://api.supabase.com/v1/projects/akyzzdwbzgsnhdircuce/database/query',{
    method:'POST',headers:{'Authorization':`Bearer ${tok}`,'Content-Type':'application/json'},
    body:JSON.stringify({query:sql})});
  const t = await r.text();
  if(!r.ok){console.log('ERR',r.status,t);return;}
  return JSON.parse(t);
}
console.log("=== RLS policies commissions/orders ===");
console.log(JSON.stringify(await q(`select tablename, policyname, cmd, qual, with_check from pg_policies where tablename in ('commissions','orders','payout_info') order by tablename, policyname;`),null,1));
console.log("=== check constraints ===");
console.log(JSON.stringify(await q(`select conrelid::regclass as tbl, conname, pg_get_constraintdef(oid) as def from pg_constraint where conrelid::regclass::text in ('public.commissions','public.orders') and contype='c';`),null,1));
