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
  if(path.endsWith('.json'))return JSON.parse(readFileSync(path,'utf8'));
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} }; cache.set(path, module);
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const localRequire = id => id === 'expo-localization' ? { getLocales: () => [{ languageTag: 'tr-TR' }] } : id.startsWith('@/') ? load(id.slice(2)) : id.startsWith('.') ? load(resolve(dirname(path), id)) : require(id);
  vm.runInNewContext(`(function(require,module,exports){${code}\n})`, { process: {env:{EXPO_PUBLIC_SUPABASE_URL:"https://example.invalid",EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:"local-test-only"}}, fetch: mockFetch, Response, Request, URL, console }, { filename: path })(localRequire, module, module.exports);
  return module.exports;
}

const raw='⫷⫷PANORAMİK BOĞAZ MANZARALI 433 M2 MÜSTAKİL ARSA⫸⫸';
const clean='PANORAMİK BOĞAZ MANZARALI 433 M2 MÜSTAKİL ARSA';
async function mockFetch(url){
 assert.ok(String(url).startsWith('https://example.invalid/'),'No live requests');
 return Response.json(String(url).includes('listing_public_cards')?[{title:raw,price:1900000,description:'İlan açıklaması',currency:'TRY',category:'Arsa',stock_count:1,commission_tl:19000}]:[]);
}
const middleware=load('middleware.ts').default;
const response=await middleware(new Request('https://www.ortaksat.com/listing/example',{headers:{'user-agent':'WhatsApp'}}));
assert.ok(response);
const html=await response.text();
assert.ok(html.includes(`<h1>${clean}</h1>`));
assert.ok(html.includes(`name":"${clean}"`));
assert.ok(!html.includes('⫷')&&!html.includes('⫸'));
assert.ok(html.includes('1.900.000'));
assert.equal(await middleware(new Request('https://www.ortaksat.com/listing/example',{headers:{'user-agent':'Mozilla/5.0'}})),undefined);
console.log('Passed crawler HTML: clean heading, OG/browser title and JSON-LD; price preserved, normal browser bypass, no live requests.');
