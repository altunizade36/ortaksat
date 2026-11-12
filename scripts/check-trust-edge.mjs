// Run with Deno: deno run --allow-env --config supabase/functions/deno.json scripts/check-trust-edge.mjs
// Every HTTP request is intercepted. No email/SMS/scanner/Supabase network call is sent.
import assert from 'node:assert/strict';
import {sha256} from '../supabase/functions/_shared/trust-file.mjs';
const environment={SUPABASE_URL:'https://supabase.test.invalid',SUPABASE_ANON_KEY:'synthetic-anon',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service'};
for(const [key,value] of Object.entries(environment))Deno.env.set(key,value);
for(const key of ['TRUST_SCANNER_URL','TRUST_SCANNER_KEY','TRUST_GUEST_ENABLED','TRUST_OTP_SECRET','TRUST_EMAIL_FROM','TRUST_MAINTENANCE_SECRET'])Deno.env.delete(key);
let handler;Deno.serve=fn=>{handler=fn;return {};};
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',me='11111111-1111-4111-8111-111111111111';
let file=new TextEncoder().encode('%PDF-1.7\nsynthetic test only\n%%EOF'),badHash=false,forbidden=false,alreadyScanned=false,mail='',challenge='',codeHash='';const calls=[];
const json=(v,status=200)=>new Response(JSON.stringify(v),{status,headers:{'Content-Type':'application/json'}});
globalThis.fetch=async(input,options={})=>{
 const request=input instanceof Request?input:new Request(String(input),options),url=new URL(request.url);const body=await request.clone().text();calls.push({url:url.pathname,host:url.hostname,body});
 if(url.hostname==='supabase.test.invalid'){
  if(url.pathname==='/auth/v1/user')return json({id:me,role:'authenticated',aud:'authenticated',email:'test@example.invalid'});
  if(url.pathname.endsWith('trust_v1_begin_scan'))return json(alreadyScanned?{alreadyScanned:true}:{id,storage_path:'synthetic/file.pdf',mime_type:'application/pdf',byte_size:file.length});
  if(url.pathname.endsWith('trust_v1_scan_result'))return json(null);
  if(url.pathname.includes('/storage/v1/object/')&&request.method==='GET')return new Response(file,{headers:{'Content-Type':'application/pdf'}});
  if(url.pathname.endsWith('trust_v1_authorize_evidence'))return forbidden?json({message:'TRUST_EVIDENCE_UNAVAILABLE'},403):json({path:'synthetic/file.pdf',expiresIn:60});
  if(url.pathname.includes('/storage/v1/object/sign/'))return json({signedURL:'/object/sign/trust-evidence/synthetic/file.pdf?token=synthetic'});
  if(url.pathname.endsWith('trust_v1_guest_begin')){const p=JSON.parse(body);challenge=p.p_challenge_id;codeHash=p.p_code_hash;return json({challengeId:challenge,expiresIn:600});}
  if(url.pathname.endsWith('trust_v1_guest_confirm'))return json({ok:JSON.parse(body).p_code_hash===codeHash});
  if(url.pathname.endsWith('trust_v1_send_reminders'))return json(2);
 }
 if(url.hostname==='scanner.test.invalid')return json({clean:true,sha256:badHash?'0'.repeat(64):await sha256(file),byteSize:file.length,engine:'synthetic-test-only'});
 if(url.hostname==='api.resend.com'&&url.pathname==='/emails'){mail=JSON.parse(body).text;return json({id:'synthetic-mail'});}
 throw Error('Unexpected network request blocked: '+request.url);
};
const request=(body,headers={Authorization:'Bearer synthetic-user-token'},method='POST')=>new Request('https://function.test.invalid',{method,headers:{'Content-Type':'application/json',...headers},...(method==='POST'?{body:JSON.stringify(body)}:{})});
await import('../supabase/functions/trust-evidence/index.ts');const evidence=handler;
assert.equal((await evidence(request({}, {},'GET'))).status,405);
assert.equal((await evidence(request({operation:'scan',evidenceId:id},{}))).status,401);
assert.equal((await evidence(request({}, {Origin:'https://unexpected.invalid'}))).status,403);
assert.equal((await evidence(request({operation:'scan',evidenceId:id}))).status,503,'No scanner is fail-closed');
Deno.env.set('TRUST_SCANNER_URL','https://scanner.test.invalid');Deno.env.set('TRUST_SCANNER_KEY','synthetic-scanner');
let response=await evidence(request({operation:'scan',evidenceId:id}));assert.equal(response.status,200);assert.equal((await response.json()).status,'clean');
const scan=calls.filter(c=>c.url.endsWith('trust_v1_scan_result')).at(-1);assert.equal(JSON.parse(scan.body).p_clean,true);
alreadyScanned=true;const scannerCalls=calls.filter(c=>c.host==='scanner.test.invalid').length;
assert.equal((await evidence(request({operation:'scan',evidenceId:id}))).status,200);assert.equal(calls.filter(c=>c.host==='scanner.test.invalid').length,scannerCalls);
alreadyScanned=false;badHash=true;const savedBefore=calls.filter(c=>c.url.endsWith('trust_v1_scan_result')).length;
assert.equal((await evidence(request({operation:'scan',evidenceId:id}))).status,503);assert.equal(calls.filter(c=>c.url.endsWith('trust_v1_scan_result')).length,savedBefore,'Wrong scanner hash cannot mark a file clean');
badHash=false;file=new TextEncoder().encode('<script>synthetic payload</script>');response=await evidence(request({operation:'scan',evidenceId:id}));assert.equal((await response.json()).status,'rejected');
assert.equal(JSON.parse(calls.filter(c=>c.url.endsWith('trust_v1_scan_result')).at(-1).body).p_clean,false);
response=await evidence(request({operation:'download',evidenceId:id}));assert.equal(response.status,200);assert.equal((await response.json()).expiresIn,60);
forbidden=true;assert.equal((await evidence(request({operation:'download',evidenceId:id}))).status,403);
await import('../supabase/functions/trust-referral/index.ts');const referral=handler;
assert.equal((await referral(request({operation:'begin'},{}))).status,503);
Deno.env.set('TRUST_GUEST_ENABLED','true');Deno.env.set('TRUST_OTP_SECRET','synthetic-otp-secret-with-at-least-32-characters');Deno.env.set('RESEND_API_KEY','synthetic-mail-key');Deno.env.set('TRUST_EMAIL_FROM','test@example.invalid');
const payload={operation:'begin',email:'guest@example.invalid',transactionId:id,refCode:'synthetic',consent:true};
assert.equal((await referral(request({...payload,consent:false},{}))).status,400);
response=await referral(request(payload,{}));assert.equal(response.status,200);assert.equal((await response.json()).challengeId,challenge);
const otp=mail.match(/\b\d{6}\b/)[0];assert.equal((await (await referral(request({operation:'confirm',challengeId:challenge,code:otp},{}))).json()).ok,true);
assert.equal((await referral(request({...payload,email:'x'.repeat(5000)},{}))).status,503,'Oversized bodies never reach database/mail');
await import('../supabase/functions/trust-maintenance/index.ts');const maintenance=handler;
assert.equal((await maintenance(request({},{}))).status,403);Deno.env.set('TRUST_MAINTENANCE_SECRET','synthetic-maintenance-secret-with-32-characters');
assert.equal((await maintenance(request({}, {Authorization:'Bearer wrong-secret'}))).status,403);
assert.equal((await maintenance(request({}, {Authorization:'Bearer synthetic-maintenance-secret-with-32-characters'}))).status,200);
console.log('PASS: real Edge handlers with intercepted HTTP: Auth/CORS, unavailable scanner, content/hash binding, quarantine rejection, scoped downloads, guest consent/OTP, bounded bodies and protected maintenance. No external request was sent.');
