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
  if (path.replaceAll('\\', '/').endsWith('/lib/supabase.ts')) return { supabase: null };
  if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} }; cache.set(path, module);
  const code = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const localRequire = id => id === 'expo-localization' ? { getLocales: () => [{ languageTag: 'tr-TR' }] } : id.startsWith('@/') ? load(id.slice(2)) : id.startsWith('.') ? load(resolve(dirname(path), id)) : require(id);
  vm.runInThisContext(`(function(require,module,exports){${code}\n})`, { filename: path })(localRequire, module, module.exports);
  return module.exports;
}
const { restoreMobileSearch } = load('lib/mobile-saved-search.ts');
const { emptyMobileFilters } = load('lib/mobile-filters.ts');
const { districts } = load('lib/locations.ts');
const { listingPhotos, listingCommissionDisplay } = load('lib/mobile-listing.ts');
const { mapListing } = load('lib/supabase-data.ts');
const validDistrict = districts.find(d => d.provinceId === 34);
const wrongDistrict = districts.find(d => d.provinceId === 6);
const saved = { mobile: { ...emptyMobileFilters(), currency: 'EUR', min: '0', max: '500', loc: { provinceId: 34, districtId: validDistrict.id }, attrs: { warranty: 'false', features: ['ABS'] }, ranges: { km: { min: '0', max: '0' } }, texts: { model: '320' } }, sort: 'new', cat: 'otomobil' };
const restored = restoreMobileSearch(JSON.stringify(saved));
assert.equal(restored.filters.currency, 'EUR'); assert.equal(restored.sort, 'newest');
assert.equal(restored.filters.loc.districtId, validDistrict.id);
assert.equal(restored.filters.attrs.warranty, 'false'); assert.equal(restored.filters.ranges.km.max, '0');
assert.equal(restoreMobileSearch(JSON.stringify({ mobile: { loc: { provinceId: 34, districtId: wrongDistrict.id } } })).filters.loc.districtId, undefined);
assert.deepEqual(restoreMobileSearch(JSON.stringify({ mobile: { loc: { provinceId: 999, districtId: validDistrict.id } } })).filters.loc, {});
assert.equal(restoreMobileSearch(JSON.stringify({ city: 'istanbul', sort: 'new' })).filters.loc.provinceId, 34);
assert.equal(restoreMobileSearch(JSON.stringify({ mobile: { currency: 'XXX', excludeOwner: 'previous-account' } })).filters.excludeOwner, undefined);
assert.equal(restoreMobileSearch(JSON.stringify({ mobile: { currency: 'XXX' } })).filters.currency, undefined);
for (const value of ['broken', 'null', '[]', '1', '{"mobile":{"attrs":[],"ranges":"bad","texts":3,"currency":{"toString":null}}}', '{"mobile":{"attrs":{"__proto__":["x"],"constructor":"x"},"ranges":{"km":null}},"sort":"__proto__"}']) {
 const valueRestored = restoreMobileSearch(value); assert.equal(Object.getPrototypeOf(valueRestored.filters.attrs), Object.prototype);
}
assert.deepEqual(listingPhotos({ image: ' cover.jpg ', imageUrl: '', adAssets: ['cover.jpg', ' ', ' second.jpg ', 'second.jpg'] }), ['cover.jpg', 'second.jpg']);
const row = { id: 'photo-test', owner_id: 'seller', title: 'Fotoğraf test ilanı', category: 'Telefon', status: 'active', description: '', created_at: '2026-10-26T00:00:00Z', image_url: null, ad_assets: [], price: 100, commission_type: 'fixed', commission_value: 10, partnership_mode: 'approval' };
assert.equal(mapListing(row).image, '', 'Missing image must not invent an unrelated product photo');
assert.equal(mapListing({ ...row, ad_assets: [' ', ' real-photo.jpg '] }).image, 'real-photo.jpg', 'Use a real additional image if cover is missing');
assert.equal(mapListing({ ...row, image_url: ' cover.jpg ', ad_assets: ['other.jpg'] }).image, 'cover.jpg');
console.log('Passed saved searches: currency/sort, zero/false criteria, valid location relationships, malformed links and safe fields. Passed real-photo selection, no invented product photo and gallery deduplication.');

assert.equal(listingCommissionDisplay({ commissionType: 'rate', commissionValue: 350, currency: 'TRY' }), null);
assert.equal(listingCommissionDisplay({ commissionType: 'fixed', commissionValue: 350, currency: 'EUR' }), '€350');
assert.equal(listingCommissionDisplay({ commissionType: 'rate', commissionValue: 15, currency: 'TRY' }), '%15');
for(const value of [NaN,Infinity,0,-1]) assert.equal(listingCommissionDisplay({ commissionType: 'fixed', commissionValue: value, currency: 'TRY' }), null);
console.log('Passed commission display validity without guessing legacy amounts.');
