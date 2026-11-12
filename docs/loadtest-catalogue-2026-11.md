# Catalogue load test at 1,000,000 listings (2026-11-12)

Subject: `public.mobile_catalogue_page(params jsonb)` — the RPC behind Keşfet, the desktop home page and the category pages.
Production has 14 listings, so its behaviour at scale was unknown. This document records what was measured on a local
throw-away database with one million synthetic listings, what was changed, and what is still weak.

Proposed migration: `supabase/_pending_catalogue_scale.sql` (**not applied to production**).

Wording used below: **measured** = a number observed in this test; **assumed** = reasoning that was not tested.

## 1. Result in one table

Median of 3 calls as role `anon`, `limit 40`, wall-clock at the client, 1,000,000 listings (949,789 active).
The three baseline search rows are single runs (each takes minutes).

| # | Request shape | Current | Proposed (sections 1–4) | + optional word-level fuzzy (section 5) | Same result as current? |
|---|---|---:|---:|---:|---|
| a | empty params, first page | 14.9 s | **20 ms** | | yes |
| b | empty params, offset 5000 | 76.4 s | **19 ms** | | yes |
| c | root category only (Emlak, 11 % of rows; root + rootOnly + labels + forms + node) | 31.3 s | **95 ms** | | yes |
| d | leaf category via `node` / `_path` (977 rows) | 9.8 s | **15 ms** | | yes |
| e | price range 100k–500k (50,669 rows) | 59.9 s | **16 ms** | | yes |
| f | province 34 + district (42,230 rows) | 13.6 s | **14 ms** | | yes |
| g | search, one word, mid frequency (22,849 rows) | 252 s | 3.2 s | **140 ms** | yes / section 5: 22,847 rows |
| g2 | search, one very common word (>100k rows) | 190 s | 580 ms | 635 ms | yes |
| h | search, three words | > 400 s (cancelled) | 1.0 s | **163 ms** | not comparable at 1M (baseline never finished) / section 5: 57 rows instead of 59 |
| i | search, misspelled word | 239 s | 3.6 s | **13 ms** | yes / section 5: 0 rows instead of 433 |
| j | category + price + province, sort=priceAsc (9,432 rows) | 13.6 s | 170 ms | | yes |
| k | sort=commissionRate | 34.1 s | **22 ms** | | yes |
| l | sort=rating | 25.0 s | 900 ms | | yes |
| m | minRating 4.5 + verified | 20.3 s | 126 ms | | yes |
| n | category + attrsAny facet + attrs facet + numeric range (3,040 rows) | 73.1 s | 107 ms | | yes |
| o | trend + sort=popular | 33.6 s | 222 ms | | yes |
| p | sort=popular, no filter | 33.3 s | **19 ms** | | yes |
| q | sort=priceAsc, no filter | 32.6 s | **19 ms** | | yes |
| r | sort=newest, small root category (9,145 rows) | 18.1 s | 100 ms | | yes |

"Same result" = identical `total` and identical ordered list of ids (fingerprint) between the current function and the
proposed one on the 1M data set.

Reading the table against the 150 ms target: 11 of 15 non-search shapes are under it, `j` (170 ms), `o` (222 ms) and
`l` (900 ms) are not, and search only gets there with the optional section 5, which changes results (§6).

Production context (read from the catalogs, **measured**): `anon` has `statement_timeout = 3s`, `authenticated` 8 s.
Every current number above is beyond those limits, i.e. at 1M rows the catalogue would return errors, not slow pages.
The baseline was measured while a second session was working on a small database on the same machine; treat the
"current" column as ±30 %.

## 2. Method

* PostgreSQL 17.11 (the portable build in `audit/runtime/postgres`), new data directory, port 55439, localhost only.
  Production is 17.6 on aarch64 with ICU `en-US`; the local cluster used ICU `en-US` too so `lower()` folds Turkish
  capitals the same way.
* Settings copied from production (`pg_settings`): `shared_buffers 224MB`, `work_mem 2184kB`, `effective_cache_size 384MB`,
  `random_page_cost 1.1`, `max_parallel_workers_per_gather 1`, `jit off`, `default_statistics_target 100`.
* Schema recreated from production catalogs, read-only (`pg_get_functiondef`, `pg_get_viewdef`, `pg_indexes`,
  `information_schema.columns`, `pg_policies`, column grants): tables `listings`, `listing_public_stats`, `profiles`,
  `listing_images` (all columns), view `listing_public_cards` (`security_invoker`), the four `mobile_filter_*` helpers,
  `mobile_catalogue_page` (verified byte-identical to production with `pg_get_functiondef`), `auth.uid()`, `is_admin()`,
  the `listings_set_search_text` trigger, RLS enabled with the production policies, roles `anon` / `authenticated` with
  the production column grants, and all 29 secondary indexes of `listings` plus those of the other tables.
  Not recreated: the other listing triggers (notifications, throttling, moderation) and the province/district tables.
* Requests were built exactly like `fetchMobileCatalogue` + `buildCatalogueRequest` (root label, `rootOnly`, all
  descendant labels, subtree form keys, node slug, `emptyMobileFilters()` plus the web extras).
* Plans: `auto_explain` with `log_analyze`, `log_buffers`, `log_nested_statements` (a plain `EXPLAIN` of the call only
  shows a `Result` node). Plans were captured in a separate fourth run.
* No write, DDL or `EXPLAIN ANALYZE` was sent to production; no listing rows were read except a category/attribute-key
  distribution of the 14 rows.

### Synthetic data

| | |
|---|---|
| listings | 1,000,000; 949,789 `active`, the rest spread over the 7 other statuses; 992 active rows soft-deleted |
| heap / total size | 1.46 GB heap (1.58 GB with the generated columns), 3.7 GB with the production indexes |
| owners | 200,000 profiles, 194,956 with listings (skewed), 30 % unrated, others ~N(4.3, 0.55); 60 % phone-verified |
| categories | 25 roots, 2,312 nodes, 1,577 leaves, `_path` of 3–5 slugs, skewed weights (largest root 25 %) |
| legacy rows | 10 % of active rows have no `_path` (95,131), 1.5 % have no `_root` at all (14,237) — deliberately pessimistic |
| prices | log-normal per category kind (vehicle, real estate, product, service), rounded to 2 significant digits |
| location | province 1..81 weighted to İstanbul/Ankara/İzmir (province 34 = 30 %), district ids, 2 % without location |
| attributes | brand, model, year, km/mileage (number or "125.000" text), gear/transmission, fuel, m2/grossM2, rooms, warranty/guarantee, swap, from, etiketler (array), … |
| text | 3,200-word Turkish-like vocabulary, Zipf distribution; title 4–8 words, description 22–55 words; `search_text` filled by the production trigger (378 characters on average) |
| stats | one row per listing, 60 % with `view_count > 0` (Pareto) |

## 3. Why the current function does not scale (all measured)

Plan of the empty request (shape a), from `auto_explain`:

```
Seq Scan on listings      rows=948797 (51,203 removed)          <- page: every active row, ~30 predicates each
  -> Nested Loop Left Join listing_public_stats (948,797 probes)
  -> Sort top-N heapsort over 948,797 rows
Seq Scan on listings      rows=100001                           <- total: second pass (count ... limit 100001)
56,625 nested calls of is_admin()                               <- RLS policy, once per non-active row
```

| Finding | Evidence |
|---|---|
| No filter can use an index. The function is `LANGUAGE sql` with predicates of the form `coalesce(param,'') = '' or column op param`; such a function is planned once without parameter values, so every branch stays in the plan. | Every one of the 15 non-search shapes shows `Seq Scan on listings` with 948,797 rows, whatever the filter (leaf category with 977 results: 947,820 rows removed by filter). |
| `count(*) … limit 100001` is a second full pass unless the cap is reached early. | Shape e: page 282 s / count 268 s in the instrumented run; shape d: 34 s / 46 s; shape a (cap reached after 100,001 rows): 23 s / 4.5 s. |
| The sort can never follow an index (one `CASE` per sort key). | `top-N heapsort` over all matching rows in every captured plan. Offset 5000 (shape b) is 5× slower than offset 0; its plan was not captured — presumably the 5,040 wide rows no longer fit in `work_mem` (**assumed**). |
| RLS makes most indexes unusable for `anon` even with a better query. `enum =`, numeric comparisons, `jsonb ?` and `LIKE` are not leakproof (`pg_proc.proleakproof`), so under the policy on `listings` they may not be index conditions. | The proposed function run as `SECURITY INVOKER`: a 786 ms, c 1.0 s, d 4.3 s, e 7.2 s, f 301 ms, q 768 ms — against 20 / 95 / 15 / 16 / 14 / 19 ms as `SECURITY DEFINER`. |
| `is_admin()` (SECURITY DEFINER, one profile lookup) is evaluated per row for rows that fail `status = 'active'`. | 56,625–102,406 nested executions per request. |
| Helper functions are never inlined (`SET search_path`, sub-selects). | Per call: `mobile_filter_fold` 3.2 µs, `mobile_filter_number(mobile_filter_value())` 6.1 µs, `mobile_filter_matches(mobile_filter_value())` 39 µs. Price filter alone (shape e): 60 s. |
| Partial indexes `where deleted_at is null` (`listings_root_fold_idx`, `listings_form_key_idx`, `listings_category_path_gin`) cannot be used by `anon` (the policy is an OR, so `deleted_at is null` is not provable) and PostgreSQL ignores statistics of partial expression indexes. | Row estimate for `fold(_root) = 'vasita'` was 5,001 (default) against 258,556 real rows; the first rewrite picked that index and needed 4.6 s for a leaf category. |
| Fuzzy search (`word_similarity(token, search_text) >= 0.45`) is evaluated on every row. | 950k calls at ~80 µs each: 190–400 s per search. |

## 4. What the proposed migration does

1. **Helpers made inlinable** (`mobile_filter_fold`, `mobile_filter_value`, `mobile_filter_number`): same body without
   the `SET` clause / sub-select. 33,597 distinct values compared old vs new: 0 differences.
2. **Generated columns** `cat_root`, `cat_form`, `cat_path` on `listings` (the category keys extracted from
   `attributes`), and `catalogue_attr_tokens(attributes)` (folded `key=value` tokens for facets).
3. **Indexes**, all partial on `status = 'active' and deleted_at is null` (560 MB in total at 1M rows; table itself 1.6 GB):
   default sort, price, province, district, owner, the two commission sorts, a covering category index, GIN on
   `cat_path`, GIN on facet tokens, three small indexes for rows without `_path`, popular sort on the stats table.
4. **Function rewritten in plpgsql**
   * builds the SQL from fixed text; only predicates that the request uses are included, so the planner sees constants;
     values are bound with `USING` or quoted with `format('%L')`, search tokens are `[a-z0-9]` after folding;
   * `SECURITY DEFINER`, `search_path = public, pg_temp`, `work_mem = 16MB` (bitmaps went lossy at 2 MB: 75k rows
     re-checked in shape j). Visibility is re-applied by hand: `status = 'active'` and
     `deleted_at is null`, widened to the caller's own soft-deleted rows / everything for admins exactly as the policy
     does. Output is `to_jsonb` of `listing_public_cards` rows, i.e. the same public columns;
   * page = one ordered `LIMIT/OFFSET` query returning ids; cards are fetched for those ≤100 ids only;
   * total = capped count, skipped when the page is shorter than `limit` (then `offset + rows` is exact);
   * sort=popular reads the stats table in index order when rows with `view_count > 0` fill the page;
   * search: rows where every token is a plain substring are counted first through the trigram index; if they alone
     reach the cap, no similarity call is made at all; otherwise every candidate row is evaluated once and both page
     and total come from that single pass. The fuzzy branch uses the trigram index through `token <% search_text`,
     which needs `pg_trgm.word_similarity_threshold <= 0.45`; the function sets it with transaction-local
     `set_config` and verifies it, falling back to the unindexed form if it cannot.
5. **Optional word-level fuzzy** (commented out in the file) — see §6.

Effect of individual steps where they were measured separately:

| Step | Shape | Before the step | After |
|---|---|---:|---:|
| dynamic SQL + definer + first indexes | a / e / q | 14.9 s / 59.9 s / 32.6 s | 20 / 26 / 33 ms |
| flat OR for the category gate + statistics the planner can use | d (leaf) | 4.6 s | 20 ms |
| `work_mem 16MB` + district index `include (province_id)` | f | 335 ms | 14 ms |
| generated columns + covering category index | c (root) | ~1.0 s | 95 ms |
| facet token GIN pre-filter | n | 2.0 s | 107 ms |
| one profile probe instead of two | m | 290 ms | 126 ms |
| search (already exact-first, single pass, indexed fuzzy candidates): `work_mem 16MB` so bitmaps stay exact | g / i | 12.8 s / 13.6 s | 4.7 s / 5.7 s (3.2 s / 3.6 s in the final run) |

## 5. Equivalence

* **Randomised**: 420 random requests against the final function, 0 mismatches. They ran on a 6 % sample of the
  synthetic data (59,554 listings), because the current function needs minutes per call at 1M rows: 260 requests with
  the real cap (156 with a non-empty result) and 160 with the lowered cap described below (99 non-empty, 49 at the cap).
  Callers: about 70 % `anon`, 20 % an authenticated owner who has soft-deleted active listings, 10 % an admin.
  Earlier iterations of the function went through another 950 random requests, also without a mismatch.
  Each request combines category (root / inner / leaf, with and without `node`, flipped `rootOnly`, missing `forms`),
  search (correct, misspelled, multi-word, >8 tokens, SQL-injection strings, `%`, `_`), price in the client's number
  formats (also unparseable), location, every boolean flag, commission/stock/date/rating/city/currency filters,
  `attrs`, `attrsAny`, `ranges`, `texts`, all sort values, offsets up to 5000 and limits 1–100. The comparison is the
  whole JSON (`total` and every field of every listing, in order), not only ids.
* The 60k-row sample cannot reach the 100,001 cap, so the cap branches were tested with copies of both functions
  whose cap is lowered to 1,001.
* **At 1M rows**: all benchmark shapes except h (18 of 19) return the same `total` and the same ordered ids as the
  current function. h could not be compared because the current function did not finish in 400 s.
* The built migration file was applied twice to a fresh database that had only the production schema (idempotent), and
  21 requests (the 19 shapes, `NULL`, `{}`) matched there as well.

**Intentional differences in sections 1–4: none found.** Things that could differ in principle:

* A request that makes the current function raise an error for one row (e.g. `limit: "abc"`) raises in the new one too,
  but possibly with a different message, and the new one raises even when no row would have been evaluated.
* `listing_public_stats.view_count / favorite_count` are assumed `NOT NULL` (they are) for the popular fast path.
* Callers that bypass RLS today (`service_role`) see soft-deleted active rows in the current function; in the new one
  they are treated like `anon`. Production has 0 soft-deleted rows (**measured**: `count(*) where deleted_at is not null` = 0).

## 6. Optional section 5: word-level fuzzy search (changes results)

With today's rule every search needs `word_similarity(token, search_text)` on each candidate row. The trigram index
only narrows the candidates to rows sharing 45 % of the token's trigrams anywhere in the text: **measured** 15,669 to
240,933 candidate rows per token at 1M rows, ~80 µs per call. That is where the remaining 1–3.6 s go, and it is plan
sensitive (shape h varied between 1.0 s and 16 s across runs, depending on which token the planner started from).

Section 5 keeps substring matching and replaces the second rule by "the listing contains a **word** w with
`word_similarity(token, w) >= 0.45`": words are looked up in a dictionary table (4,681 words here) and listings come
from a GIN index on `string_to_array(search_text, ' ')` (146 MB). No similarity call per row.

| | exact semantics | word-level |
|---|---:|---:|
| g one word | 3.2 s | 140 ms |
| h three words | 1.0 s (up to 16 s) | 163 ms |
| i misspelled | 3.6 s | 13 ms |
| g2 very common word | 580 ms | 635 ms |

Difference in results, **measured** on 120 random searches against the current function (60k-row sample): 59 identical,
61 returned fewer rows, none returned more; 7,835 of 160,812 rows lost (4.9 %); first page identical in 98 of 120.
The lost rows are those that matched only across a word boundary. Example at 1M rows: the misspelling in shape i
returned 433 rows before and 0 after — neither result contains the intended word (34,683 listings), trigram similarity
does not recover a transposition in a 9-letter word either way.

It adds a table, a trigger on `listings` (insert of ~45 words `on conflict do nothing` per listing write) and a
backfill; the dictionary also holds words of non-public listings, but it is not readable by `anon`/`authenticated`.

## 7. Remaining weak spots

| Shape | Now | Why | What would fix it |
|---|---:|---|---|
| sort=rating (l) | 900 ms | rating lives in `profiles`; the top-N needs a join of all 950k active listings | store the owner's rating on the listing (trigger) and index it, or drop this sort for unfiltered lists (**assumed**) |
| trend + popular (o) | 222 ms | the page is fast, the capped total hashes 600k stats rows | partial index on stats for the trend condition + an `(id)` index on active listings for a merge join (**assumed**, not built) |
| category + price + province (j) | 170 ms | three large bitmaps are AND-ed, then 9k rows are read twice (page, total) | one pass for page and total when the result is small (**assumed**) |
| very common search word (g2) | 580 ms | 100,001 rows must be read from the heap to re-check `LIKE` | none within the current `total` rule; a lower cap would help |
| root categories (c, r) | 95–100 ms | index-only scan of the whole root, plus the label fallback over the 14k rows without `_root` | backfill `_root` / `_path` on old rows; then the three `legacy` indexes stay empty |
| any filter mix that ends in heap access | varies | 8 µs per row with 224 MB `shared_buffers` and a 1.6 GB table | memory, see §8 |
| exact fuzzy search | 1–16 s | §6 | section 5 or another search design |

## 8. Not tested / assumptions

* **Supabase specifics.** `set_config('pg_trgm.word_similarity_threshold', …, true)` works for a non-superuser on stock
  PostgreSQL (measured as `anon`); production once rejected the same setting in a function's `SET` clause. If Supabase
  refuses it at run time the function still returns correct results but the fuzzy branch is unindexed (minutes at 1M).
* **Hardware.** The test machine is a 20-thread x86 desktop; production is a small ARM instance. With 1M listings the
  table (1.6 GB) and the proposed indexes (0.56 GB) do not fit in production's memory (`shared_buffers` 224 MB,
  `effective_cache_size` 384 MB): every number here was measured with the data in the OS cache. Cold-cache behaviour
  was not measured.
* **Concurrency.** One session at a time. No throughput test, no test under writes.
* **Write cost.** Index build times were seen (1–2 s per btree, 134 s for the facet GIN, 115 s for the word GIN at 1M),
  the per-insert overhead of the new indexes, generated columns and the optional trigger was not measured.
* **Other callers of the helpers / of `listings`.** A grep of `supabase/**/*.sql` found no `insert into listings`
  statement; application code and database functions living only in production were not reviewed for inserts that
  name no columns (`insert … select *` would break on generated columns) or for anything relying on the helpers'
  `SET search_path`.
* **Data realism.** Synthetic pseudo-words have a narrower trigram space than real Turkish; 10 % rows without `_path`
  is a guess. Real planner statistics will differ; plans should be re-checked on real data once it exists.
* **Other triggers** on `listings` were not installed locally.
* **PostgreSQL version**: 17.11 locally, 17.6 in production.

## 9. Beyond 1M (towards 10M) — assumed, not measured

* The page queries are index walks and stay flat. The costs that grow with the table are the capped total
  (up to 100,001 index entries or heap rows per request), bitmap sizes (`work_mem 16MB` is sized for ~1M rows;
  exact bitmaps over 10M rows need ~10× that) and everything that touches the heap.
* Replace the exact capped total by something cheaper for large results: per-category counters maintained by trigger,
  or an estimate above a threshold (the client already shows "100.000+").
* Replace `offset` paging by keyset paging (`created_at, id` of the last row). Offset 5000 is fine today (19 ms)
  because it is an index-only walk; it grows linearly with the offset and stops being index-only once filters need
  the heap. This needs a client change.
* Search: a dedicated full-text design (`tsvector` + Turkish-aware dictionary, or an external engine) instead of
  trigram substring matching over title + description; trigram GIN posting lists for common trigrams already cost
  10–90 ms per token at 1M.
* Memory sized so that the active part of `listings` and its indexes stay cached; consider moving `description`
  (the bulk of the row) out of the hot table or relying on TOAST so the heap is smaller.
* Partition or archive non-active listings; the partial indexes already keep them out of the indexes.
