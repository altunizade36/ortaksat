import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const require=createRequire(import.meta.url);
function loader({platform='android',location={},timeout=false}={}){
 const cache=new Map();let cleared=0;
 function load(filename){let path=resolve(filename);if(!existsSync(path))path+='.ts';if(cache.has(path))return cache.get(path).exports;
  const module={exports:{}};cache.set(path,module);
  const code=ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const local=id=>id==='expo-location'?location:id==='react-native'?{Platform:{OS:platform}}:id.startsWith('@/')?load(id.slice(2)):id.startsWith('.')?load(resolve(dirname(path),id)):require(id);
  const clock=(fn,ms)=>{assert.equal(ms,25000);if(timeout)queueMicrotask(fn);return 1;};
  vm.runInThisContext(`(function(require,module,exports,setTimeout,clearTimeout){${code}\n})`,{filename:path})(local,module,module.exports,clock,()=>cleared++);
  return module.exports;
 }
 return {load,cleared:()=>cleared};
}
const l=loader(),{matchGeocodedLocation:match}=l.load('lib/geocoded-location.ts'),{provinces,districts}=l.load('lib/locations.ts');
for(const province of provinces)assert.equal(match({region:province.name,isoCountryCode:'TR'}).provinceId,province.id);
for(const district of districts){const province=provinces.find(p=>p.id===district.provinceId);assert.deepEqual(match({region:province.name,subregion:district.name,isoCountryCode:'TR'}),{provinceId:province.id,districtId:district.id});}
assert.equal(match({region:'İstanbul',isoCountryCode:'US'}),undefined);
assert.equal(match({region:'Unknown',city:'Unknown'}),undefined);
assert.deepEqual(match({region:'İzmir',subregion:'Kadıköy'}),{provinceId:35});
assert.equal(match({region:'Kocaeli Province',subregion:'Gebze ilçesi'}).districtId,districts.find(d=>d.provinceId===41&&d.name==='Gebze').id);
let calls=0;
const denied=loader({location:{requestForegroundPermissionsAsync:async()=>({status:'denied'}),getCurrentPositionAsync:()=>{calls++;}}});
await assert.rejects(denied.load('lib/current-location.ts').currentListingLocation(),/LOCATION_PERMISSION_DENIED/);assert.equal(calls,0);
const web=loader({platform:'web',location:{requestForegroundPermissionsAsync:()=>{calls++;}}});
await assert.rejects(web.load('lib/current-location.ts').currentListingLocation(),/LOCATION_WEB_UNAVAILABLE/);assert.equal(calls,0);
const granted={Accuracy:{Balanced:3},requestForegroundPermissionsAsync:async()=>({status:'granted'}),getCurrentPositionAsync:async()=>({coords:{latitude:41,longitude:29}}),reverseGeocodeAsync:async()=>[{region:'İstanbul',city:'Kadıköy',isoCountryCode:'TR'}]};
const native=loader({location:granted});assert.ok((await native.load('lib/current-location.ts').currentListingLocation()).districtId);assert.equal(native.cleared(),1);
const hung=loader({timeout:true,location:{...granted,getCurrentPositionAsync:()=>new Promise(()=>{})}});
await assert.rejects(hung.load('lib/current-location.ts').currentListingLocation(),/LOCATION_TIMEOUT/);assert.equal(hung.cleared(),1);
console.log(`PASS: ${provinces.length} provinces, ${districts.length} scoped districts, Turkish/English administrative names, foreign/unknown rejection, denied permission, unsupported web without GPS access, native resolution and timeout cleanup. Synthetic coordinates/providers only.`);
