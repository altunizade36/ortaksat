import { readFileSync } from 'fs';
const env = readFileSync('.env','utf8');
const tok = env.match(/SUPABASE_MGMT_TOKEN=(.+)/)[1].trim();
async function q(sql){
  const r = await fetch('https://api.supabase.com/v1/projects/akyzzdwbzgsnhdircuce/database/query',{
    method:'POST',headers:{'Authorization':`Bearer ${tok}`,'Content-Type':'application/json'},
    body:JSON.stringify({query:sql})});
  const t = await r.text();
  if(!r.ok){console.log('ERR',r.status,t);return;}
  console.log(JSON.stringify(JSON.parse(t),null,1));
}
await q(`select tgname, c.relname as tbl, pg_get_triggerdef(t.oid) as def from pg_trigger t join pg_class c on c.oid=t.tgrelid where not t.tgisinternal and c.relname in ('commissions','orders','partnerships') order by c.relname,tgname;`);
