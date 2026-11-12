import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {previewCommission,ORTAKPAY} from '../lib/trust-v1/model.ts';
import {notificationTarget} from '../lib/notification-target.ts';
import {calculateUserTrustScores} from '../lib/trust-score.ts';
import {approvedScan,fileSignatureMatches,sha256} from '../supabase/functions/_shared/trust-file.mjs';

const db=new PGlite();
try {
 const cases=[['0.01','rate','50'],['0.01','rate','1'],['1500','rate','5'],['999999999999','rate','90'],['1.25','fixed','0.01']];
 for(let i=1;i<=100;i++)cases.push([(i*129.13).toFixed(2),'rate',((i%89)+0.12).toFixed(2)]);
 for(const [amount,type,value] of cases){
  const actual=previewCommission(amount,type,value);
  const sql=(await db.query("select (case when $2='rate' then round($1::numeric*$3::numeric/100,2) else $3::numeric end)::numeric(16,2)::text as value",[amount,type,value])).rows[0].value;
  assert.equal(actual,sql,`${amount} ${type} ${value}`);
 }
 for(const value of ['-1','0','NaN','1e5','1.234','1,25','Infinity',' 2','999999999999999999'])assert.throws(()=>previewCommission(value,'rate','5'));
 assert.throws(()=>previewCommission('100','rate','90.01'));
 assert.equal(ORTAKPAY.enabled,false);
 const neutral=calculateUserTrustScores({leads:[],listings:[],partnerships:[],reports:[],reviews:[],sales:[],user:{}});
 assert.equal(neutral.overall,null);assert.equal(neutral.seller.score,null);assert.ok(!JSON.stringify(neutral).includes('Riskli'));
 const pendingComplaints=calculateUserTrustScores({leads:[{status:'lost'}],listings:[],partnerships:[{status:'rejected'}],reports:[{status:'open'}],reviews:[],sales:[],user:{}});
 assert.deepEqual(pendingComplaints,neutral,'Open claims, rejected applications and withdrawing buyers never assign risk');
 const jpeg=new Uint8Array([255,216,255,224,1,2,3,4,255,217]);
 assert.equal(fileSignatureMatches(jpeg,'image/jpeg'),true);
 assert.equal(fileSignatureMatches(jpeg,'application/pdf'),false);
 assert.equal(fileSignatureMatches(new TextEncoder().encode('<script>alert(1)</script>'),'image/png'),false);
 assert.equal(fileSignatureMatches(new Uint8Array(5242881),'image/jpeg'),false);
 const hash=await sha256(jpeg);assert.equal(hash.length,64);
 assert.equal(approvedScan({clean:true,sha256:hash,byteSize:jpeg.length,engine:'synthetic'},hash,jpeg.length),true);
 assert.equal(approvedScan({clean:true,sha256:'0'.repeat(64),byteSize:jpeg.length,engine:'synthetic'},hash,jpeg.length),false);
 assert.equal(approvedScan({clean:true,sha256:hash,byteSize:0,engine:'synthetic'},hash,jpeg.length),false);
 const context={userId:'synthetic',listings:[],partnerships:[],conversations:[]};
 const tx='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
 assert.equal(notificationTarget({type:'system',metadata:{trust_event:'event',trust_transaction_id:tx}},context).href,`/guven-merkezi?transaction=${tx}`);
 assert.equal(notificationTarget({type:'system',metadata:{trust_event:'event',trust_agreement_id:tx}},context).href,'/guven-merkezi?view=agreements');
 console.log(`PASS: ${cases.length} exact commission comparisons against PostgreSQL; malformed amount/rate rejection, payment flag off, file signature/hash/scan result checks and Trust notification deep links.`);
} finally {await db.close();}
