import { readFileSync } from 'fs';
const env = readFileSync('.env','utf8');
const tok = env.match(/SUPABASE_MGMT_TOKEN=(.+)/)[1].trim();
async function q(sql){const r=await fetch('https://api.supabase.com/v1/projects/akyzzdwbzgsnhdircuce/database/query',{method:'POST',headers:{'Authorization':`Bearer ${tok}`,'Content-Type':'application/json'},body:JSON.stringify({query:sql})});const t=await r.text();if(!r.ok){console.log('ERR',r.status,t);return null;}return JSON.parse(t);}
console.log("profiles iban cols:", JSON.stringify(await q(`select column_name from information_schema.columns where table_name='profiles' and (column_name ilike '%iban%' or column_name ilike '%payout%' or column_name ilike '%bank%');`)));
console.log("payout_info grants anon/auth:", JSON.stringify(await q(`select grantee, privilege_type from information_schema.role_table_grants where table_name='payout_info' and grantee in ('anon','authenticated');`)));
