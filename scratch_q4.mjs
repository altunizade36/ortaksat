import { readFileSync } from 'fs';
const env = readFileSync('.env','utf8');
const tok = env.match(/SUPABASE_MGMT_TOKEN=(.+)/)[1].trim();
async function q(sql){
  const r = await fetch('https://api.supabase.com/v1/projects/akyzzdwbzgsnhdircuce/database/query',{
    method:'POST',headers:{'Authorization':`Bearer ${tok}`,'Content-Type':'application/json'},
    body:JSON.stringify({query:sql})});
  const t = await r.text(); if(!r.ok){console.log('ERR',r.status,t);return null;} return JSON.parse(t);
}
for(const fn of ['compute_agreed_commission','bump_seller_successful_sales','advance_return_pending_commissions']){
  console.log("=== "+fn+" ===");
  const d = await q(`select pg_get_functiondef(oid) as def from pg_proc where proname='${fn}';`);
  console.log(d && d[0] ? d[0].def : 'NOT FOUND');
}
