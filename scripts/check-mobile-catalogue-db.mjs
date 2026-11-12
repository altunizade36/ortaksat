import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';

// Credentials stay in this process; output contains only assertions and counts.
const env = Object.fromEntries(readFileSync('.env', 'utf8').split(/\r?\n/).map(line => line.match(/^([A-Z_0-9]+)=(.*)$/)).filter(Boolean).map(m => [m[1], m[2].replace(/^['"]|['"]$/g, '')]));
const sql = readFileSync('supabase/migrations/20261020194618_mobile_catalogue_filters.sql', 'utf8');
async function query(query) {
  const response = await fetch(`https://api.supabase.com/v1/projects/${env.SUPABASE_PROJECT_REF}/database/query`, { method: 'POST', headers: { Authorization: `Bearer ${env.SUPABASE_MGMT_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ query }) });
  const result = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(result));
  return result;
}
const checks = `select jsonb_build_object(
 'fold', public.mobile_filter_fold('İSTANBUL Çığ ÖŞÜ'),
 'zero', public.mobile_filter_number('0'::jsonb),
 'numeric', public.mobile_filter_number('12.5'::jsonb),
 'formatted', public.mobile_filter_number('"62.000 km"'::jsonb),
 'invalid', public.mobile_filter_number('"yok"'::jsonb),
 'alias', public.mobile_filter_value('{"mileage":0}'::jsonb,'km'),
 'falseMatches', public.mobile_filter_matches('false'::jsonb,'"false"'::jsonb),
 'missingFalse', public.mobile_filter_matches(null,'"false"'::jsonb),
 'multi', public.mobile_filter_matches('["ABS","Klima"]'::jsonb,'["Klima","ABS"]'::jsonb),
 'missingMulti', public.mobile_filter_matches('["ABS"]'::jsonb,'["Klima","ABS"]'::jsonb),
 'invoker', not (select prosecdef from pg_proc where oid = 'public.mobile_catalogue_page(jsonb)'::regprocedure),
 'page', public.mobile_catalogue_page('{"limit":2,"sort":"priceAsc"}'::jsonb),
 'next', public.mobile_catalogue_page('{"limit":2,"offset":2,"sort":"priceAsc"}'::jsonb),
 'empty', public.mobile_catalogue_page('{"q":"__missing_mobile_catalogue_test__"}'::jsonb)
) as checks;`;
// Roll back even successful DDL: test as a public visitor before installing it.
const rows = await query(`begin; ${sql} set local role anon; ${checks} rollback;`);
const c = rows[0].checks;
assert.equal(c.fold, 'istanbul cig osu');
assert.equal(c.zero, 0); assert.equal(c.numeric, 12.5); assert.equal(c.formatted, 62000); assert.equal(c.invalid, null);
assert.equal(c.alias, 0); assert.equal(c.falseMatches, true); assert.equal(c.missingFalse, false);
assert.equal(c.multi, true); assert.equal(c.missingMulti, false);
assert.equal(c.invoker, true);
assert.equal(c.empty.total, 0); assert.equal(c.empty.listings.length, 0);
assert.ok(c.page.listings.length <= 2);
assert.ok(c.page.listings.every(l => l.status === 'active'));
assert.ok(!c.page.listings.some(l => c.next.listings.some(n => n.id === l.id)));
console.log('Passed: anonymous access, normalization, aliases, zero, numeric parsing, boolean/multiselect matching, empty results and stable pagination.');
if (process.argv.includes('--apply')) {
  await query(`begin; ${sql} commit;`);
  const verified = await query('set local role anon; ' + checks);
  assert.equal(verified[0].checks.page.total, c.page.total);
  console.log('Installed and verified read-only catalogue RPC.');
}
const publicKey = env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY || env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
const response = await fetch(`${env.EXPO_PUBLIC_SUPABASE_URL}/rest/v1/rpc/mobile_catalogue_page`, { method: 'POST', headers: { apikey: publicKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ params: { limit: 1 } }) });
assert.equal(response.status, 200, 'Anonymous Data API RPC must be callable');
const result = await response.json();
assert.ok(Array.isArray(result.listings) && result.listings.length <= 1);
console.log('Passed: real anonymous Data API access.');
