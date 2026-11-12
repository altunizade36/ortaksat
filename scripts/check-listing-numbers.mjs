import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

const require = createRequire(import.meta.url), cache = new Map();
function load(filename) {
  let path = resolve(filename);
  if (!existsSync(path)) path += '.ts';
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} }; cache.set(path, module);
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = id => id === 'expo-localization' ? { getLocales: () => [{ languageTag: 'tr-TR' }] } : id.startsWith('@/') ? load(id.slice(2)) : id.startsWith('.') ? load(resolve(dirname(path), id)) : require(id);
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: path })(localRequire, module, module.exports);
  return module.exports;
}
const {parseListingMoney,parseListingRate,listingNumberInput,listingCommissionError}=load('lib/listing-numbers.ts');
const {validateListing}=load('lib/validation.ts');
const valid=[['1500',1500],['1.500',1500],['1.500.000',1500000],['1.500,50',1500.5],['1500,5',1500.5],['1 500,50',1500.5],['1\u00a0500',1500],['0',0],[1500.5,1500.5]];
for(const [raw,value] of valid)assert.equal(parseListingMoney(raw),value,String(raw));
const invalid=['-500','+500','1e3','500TL','1.5','12.34','1,2,3','1.500,555','1 50','1.500 000','Infinity','', 'NaN',-500,Infinity];
for(const raw of invalid)assert.ok(Number.isNaN(parseListingMoney(raw)),String(raw));
for(const value of [0,1,1500,1500.5,0.25,999999999999])assert.equal(parseListingMoney(listingNumberInput(value)),value);
assert.equal(parseListingRate('5,5'),5.5);assert.equal(parseListingRate('5.5'),5.5);
for(const raw of ['5abc','-5','1e1','5,5,5','5.555'])assert.ok(Number.isNaN(parseListingRate(raw)),raw);
assert.equal(listingCommissionError('rate','90'),'');assert.ok(listingCommissionError('rate','90,01'));
assert.ok(listingCommissionError('fixed','-500'));assert.equal(listingCommissionError('fixed','1.500,50','5'),'');
for(const raw of ['0','-1','1.5','1e3','9007199254740992'])assert.ok(listingCommissionError('fixed','500',raw),raw);
for(const raw of ['-500','1e3','12.34'])assert.ok(validateListing({title:'Temiz ürün test ilanı',description:'Ürünün bütün özellikleri açıklamada belirtilmiştir.',price:raw}).errors.some(e=>e.field==='price'));
assert.equal(validateListing({title:'Temiz ürün test ilanı',description:'Ürünün bütün özellikleri açıklamada belirtilmiştir.',price:'1.500,50'}).clean.price,1500.5);
console.log('Passed strict money, rate, partner limits, decimal edit roundtrip and central listing validation.');
