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
const { emptyMobileFilters, clearMobileFilters, mobileFilterCount, filterMobileListings, mobileFilterError } = load('lib/mobile-filters.ts');
const { formSchemas, categoryTree } = load('lib/category-tree.ts');
const { searchCategoryPaths } = load('lib/mobile-catalog.ts');
const base = { id: 'one', status: 'active', title: 'İstanbul BMW 320i', description: 'Temiz araç', category: 'Otomobil', location: 'İstanbul', tags: [], price: 2350000, partnershipMode: 'approval', imageUrl: 'https://example.invalid/photo.jpg', attributes: { year: '2021', mileage: 0, transmission: 'Otomatik', warranty: false, features: ['ABS', 'Klima'], brand: 'BMW' } };
const other = { ...base, id: 'two', status: 'active', price: 100, partnershipMode: 'invite', attributes: { year: '2020', mileage: 100, warranty: true, features: ['ABS'] } };
const run = patch => filterMobileListings([base, other], { ...emptyMobileFilters(), ...patch });
assert.deepEqual(run({ ranges: { km: { min: '0', max: '0' } } }).map(l => l.id), ['one']);
assert.deepEqual(run({ attrs: { gear: 'Otomatik', warranty: 'false' } }).map(l => l.id), ['one']);
assert.deepEqual(run({ attrs: { features: ['ABS', 'Klima'] } }).map(l => l.id), ['one']);
assert.equal(run({ ranges: { missing: { min: '0', max: '' } } }).length, 0);
assert.equal(run({ attrs: { unknown: 'false' } }).length, 0);
assert.deepEqual(run({ open: true, min: '2.000.000', max: '2.500.000' }).map(l => l.id), ['one']);
assert.equal(filterMobileListings([base], emptyMobileFilters(), 'istanbul').length, 1);
assert.ok(mobileFilterError({ ...emptyMobileFilters(), ranges: { year: { min: '2025', max: '2020' } } }));
assert.ok(mobileFilterError({ ...emptyMobileFilters(), min: '-1' }));
assert.equal(mobileFilterError({ ...emptyMobileFilters(), min: '0', max: '0' }), null);
assert.ok(searchCategoryPaths(categoryTree, 'BMW').some(path => path.length > 2));
let checked = 0;
for (const schema of Object.values(formSchemas)) {
  for (const field of schema.fields) {
    if (['title', 'description', 'price'].includes(field.key)) continue;
    let patch;
    if (field.type === 'number') patch = { ranges: { [field.key]: { min: '10', max: '20' } } };
    else if (field.type === 'bool') patch = { attrs: { [field.key]: 'false' } };
    else if (field.type === 'multiselect') patch = { attrs: { [field.key]: ['Deneme'] } };
    else if (field.options?.length) patch = { attrs: { [field.key]: field.options[0] } };
    else patch = { texts: { [field.key]: 'deneme' } };
    assert.equal(run(patch).length, 0, `${schema.key}/${field.key} must reject absent or nonmatching attributes`);
    checked++;
  }
}
console.log(`Passed: zero/missing ranges, aliases, explicit false, multi-select, Turkish search, price validation, category search and ${checked} fields across ${Object.keys(formSchemas).length} category schemas.`);

const active = { ...emptyMobileFilters(), open: true, photos: true, min: '0', max: '900', loc: { provinceId: 34, districtId: 34028 }, attrs: { brand: 'BMW', warranty: 'false', features: [] }, ranges: { year: { min: '2020', max: '' }, km: { min: '', max: '' } }, texts: { model: '320', blank: ' ' }, currency: 'EUR', excludeOwner: 'seller' };
assert.equal(mobileFilterCount(active), 9, 'Count logical filters once; preserve zero and explicit false selections');
const cleared = clearMobileFilters(active);
assert.equal(mobileFilterCount(cleared), 1);
assert.equal(cleared.currency, 'EUR'); assert.equal(cleared.excludeOwner, 'seller');
assert.equal(cleared.open, false, 'Ordinary reset clears an originally enabled open-only filter');
assert.equal(clearMobileFilters(active, true).open, true, 'Partnership-only flows retain their enforced open constraint');
assert.equal(active.min, '0'); assert.equal(active.open, true, 'Draft reset does not mutate applied filters');
console.log('Passed filter counts, context constraints, full reset and locked-open reset.');

const {filterRangeError,serializePriceRange}=load('lib/filter-numbers.ts');
for(const raw of ['-500','1e3','12.34','1,2,3','1.500,555','9999999999999']) {
 assert.ok(filterRangeError(raw,''),raw);
 assert.ok(mobileFilterError({...emptyMobileFilters(),min:raw}),raw);
 assert.ok(mobileFilterError({...emptyMobileFilters(),ranges:{km:{min:raw,max:''}}}),raw);
}
assert.equal(serializePriceRange('1.500,50','2.000,75'),'1500.5-2000.75');
assert.equal(serializePriceRange('','0'),'-0');
assert.equal(serializePriceRange('0',''),'0-');
assert.equal(serializePriceRange('  ',' '),'');
assert.ok(filterRangeError('2000','1500'));
const decimal={...base,price:1500.5,attributes:{area:1500.5}};
assert.equal(filterMobileListings([decimal],{...emptyMobileFilters(),min:'1.500,50',max:'1.500,50'}).length,1);
assert.equal(filterMobileListings([decimal],{...emptyMobileFilters(),min:'1.500,51'}).length,0);
assert.equal(filterMobileListings([decimal],{...emptyMobileFilters(),ranges:{area:{min:'1.500,50',max:'1.500,50'}}}).length,1);
assert.equal(filterMobileListings([decimal],{...emptyMobileFilters(),ranges:{missing:{min:' ',max:' '}}}).length,1);
console.log('Passed strict price/attribute bounds, zero/open ranges, whitespace, reversed bounds and decimal precision.');
