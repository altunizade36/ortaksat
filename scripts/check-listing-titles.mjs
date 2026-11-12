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
const { validateListingTitle, listingTitleLength, displayListingTitle } = load('lib/listing-title.ts');
const { validateListing } = load('lib/validation.ts');
export const cases = [
 ['iPhone 13 Pro 128 GB',true],['İstanbul 2+1 daire, 120 m²',true],['MacBook Air 13.6" (M2)',true],
 ["L'Oréal bakım seti",true],['BMW 320i - 2020 / Otomatik',true],['A & B yüzde %20 indirim',true],
 ['Café temiz ürün',true],['東京 中古カメラ レンズ付き',true],['Продается новый телефон',true],
 ['⫷⫷PANORAMİK BOĞAZ MANZARALI 433 M2 MÜSTAKİL ARSA⫸⫸',false],
 ['Telefon 1️⃣ fırsatı',false],['Telefon\uFE0F fırsatı',false],
 ['⭐ Fırsat iPhone 13 ⭐',false],['iPhone 13 Pro 🔥',false],['*** Temiz ürün ***',false],
 ['iPhone---128 GB',false],['iPhone 13 <b>Pro</b>',false],['iPhone\u200b 13 Pro',false],
 ['iPhone\n13 Pro',false],['iPhone\t13 Pro',false],['iPhone\u202e13 Pro',false],
 ['A'.repeat(9),false],['A'.repeat(10),true],['A'.repeat(70),true],['A'.repeat(71),false],
 ['  iPhone   13 Pro  ',true],['İstanbul\u00a0temiz ürün',true],['İ'.repeat(70),true],
];
for(const [title,ok] of cases)assert.equal(validateListingTitle(title).ok,ok,title);
assert.equal(validateListingTitle('  iPhone   13 Pro  ').title,'iPhone 13 Pro');
assert.equal(listingTitleLength('Caf'+'e\u0301 temiz ürün'),15);
assert.equal(displayListingTitle('⫷⫷PANORAMİK BOĞAZ MANZARALI 433 M2 MÜSTAKİL ARSA⫸⫸'),'PANORAMİK BOĞAZ MANZARALI 433 M2 MÜSTAKİL ARSA');
assert.equal(validateListing({title:'A'.repeat(71),description:'Yeterince uzun ürün açıklaması',price:100}).ok,false,'Overlength must not be silently truncated');
assert.equal(validateListing({title:'*** Temiz ürün ***',description:'Yeterince uzun ürün açıklaması',price:100}).ok,false);
console.log(`Passed ${cases.length} title cases, Unicode counting, legacy display and listing validation.`);
