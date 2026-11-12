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
const { listingFlowPaths, listingJoinAction, isPublicPartnershipListing } = load('lib/listing-actions.ts');
const listing = { status: 'active', stockCount: 1, partnershipMode: 'approval', attributes: {}, demo: false };
const action = patch => listingJoinAction({ listing, ...patch });
assert.equal(action({}).kind, 'apply');
assert.equal(action({ isOwner: true }).kind, 'disabled');
assert.equal(action({ sellerBlocked: true }).kind, 'disabled');
assert.equal(action({ status: 'blocked' }).kind, 'disabled');
for (const status of ['rejected','cancelled','completed']) assert.equal(action({ status }).kind, 'apply');
for (const status of ['active','pending']) {
 const existing = action({ listing: { ...listing, status: 'sold', stockCount: 0, partnershipMode: 'none' }, status });
 assert.equal(existing.kind, 'view', 'Existing membership must remain reachable after a listing closes');
}
assert.equal(action({ listing: { ...listing, partnershipMode: 'invite' } }).label, 'Davet gerekli');
assert.equal(action({ listing: { ...listing, partnershipMode: 'invite' }, hasInvite: true }).kind, 'apply');
assert.equal(action({ listing: { ...listing, stockCount: 0 } }).kind, 'disabled');
assert.equal(action({ listing: { ...listing, stockCount: 0, attributes: { _formKey: 'arayan' } } }).kind, 'apply');
for (const status of ['sold','paused','expired','archived','draft','pending_review','rejected']) assert.equal(action({ listing: { ...listing, status } }).kind, 'disabled');
assert.equal(action({ listing: { ...listing, demo: true } }).kind, 'disabled');
console.log('Passed join action policy: existing active/pending records, terminal block, reopening, invitation, owner/demo, availability and demand listings.');

assert.deepEqual(listingFlowPaths('listing-id'), { listing: '/listing/listing-id', request: '/partnership-request/listing-id' });
const paths = listingFlowPaths('listing-id', 'code+value&x=1');
assert.equal(new URL(paths.listing, 'https://example.invalid').searchParams.get('ortak-davet'), 'code+value&x=1');
assert.equal(new URL(paths.request, 'https://example.invalid').searchParams.get('invite'), 'code+value&x=1');
assert.equal(new URL(paths.request, 'https://example.invalid').searchParams.has('x'), false);
console.log('Passed invite-preserving listing/request return paths and query encoding.');

assert.equal(isPublicPartnershipListing(listing), true);
assert.equal(isPublicPartnershipListing({ ...listing, partnershipMode: 'open' }), true);
for (const patch of [{ partnershipMode: 'invite' }, { partnershipMode: 'none' }, { status: 'sold' }, { stockCount: 0 }, { demo: true }]) assert.equal(isPublicPartnershipListing({ ...listing, ...patch }), false);
assert.equal(isPublicPartnershipListing({ ...listing, stockCount: 0, attributes: { _formKey: 'arayan' } }), true);
console.log('Passed shared public partnership eligibility for favorite filters and counts.');
