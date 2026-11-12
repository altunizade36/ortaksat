-- =====================================================================================================================
-- _pending_catalogue_scale.sql   --  catalogue (mobile_catalogue_page) at 1,000,000 listings
-- APPLIED to production on 2026-11-12 (sections 1-4). Verified on the live data with 481 requests captured before and
-- after through the public REST endpoint as anon: identical totals, order and listing JSON for every request.
-- Rollback of the functions: supabase/_rollback_catalogue_before_scale.sql (columns/indexes can stay).
-- Section 5 (word-level fuzzy search) is NOT applied: it changes search results.
-- Idempotent: every statement is "create or replace" / "if not exists"; safe to run twice.
--
-- Measured on a local throw-away PostgreSQL 17.11 with 1,000,000 synthetic listings (949,789 active), production-like
-- planner settings (shared_buffers 224MB, work_mem 2184kB, random_page_cost 1.1, 1 parallel worker, jit off), calling the
-- function as role anon. Median of 3 runs. Full method and tables: docs/loadtest-catalogue-2026-11.md
--
--   request shape                                   current        proposed
--   empty params, first page                        14.9 s         20 ms
--   empty params, offset 5000                       76.4 s         19 ms
--   root category (11% of rows)                     31.3 s         95 ms
--   leaf category (_path)                            9.8 s         15 ms
--   price range                                     59.9 s         16 ms
--   province + district                             13.6 s         14 ms
--   category + price + province, sort=priceAsc      13.6 s        170 ms
--   sort=commissionRate / popular / priceAsc        33-34 s        19-22 ms
--   sort=rating                                     25.0 s        900 ms   (still slow, see doc)
--   minRating + verified                            20.3 s        126 ms
--   category + facets + numeric range               73.1 s        107 ms
--   trend + sort=popular                            33.6 s        222 ms
--   search, 1 word / 3 words / misspelled           252 s / >400 s / 239 s  ->  3.2 s / 1.0 s / 3.6 s  (section 5: 140 / 163 / 13 ms)
--
-- Why the current function cannot scale (all measured):
--   * LANGUAGE sql with every filter written as "(param is empty OR column op param)": the plan is generic, so no filter
--     can ever use an index -> one sequential scan of all listings per request, ~30 predicates evaluated per row.
--   * count(*) ... limit 100001 is a second pass over the same rows (half of the time whenever the cap is not hit early).
--   * The sort is a top-N over every matching row (no index order possible through the CASE-per-sort ORDER BY).
--   * SECURITY INVOKER + RLS: enum =, numeric <=/>=, jsonb ?, LIKE are not leakproof, so under the listings policy they can
--     never be index conditions for anon, whatever indexes exist; is_admin() is also called once per non-active row
--     (56k-102k calls per request here). The same new function run as INVOKER measured 0.3-7.2 s instead of 14-95 ms.
--   * helper functions carry "SET search_path" / sub-selects -> never inlined: fold 3.2 us, number(value()) 6.1 us and
--     matches(value()) 39 us per call, several calls per row.
--   * partial indexes "where deleted_at is null" can neither be used by anon (policy is an OR) nor give statistics.
--
-- What this migration changes
--   1. mobile_filter_fold / mobile_filter_value / mobile_filter_number: same results (33,597 values compared, 0 differences),
--      but written so the planner can inline them (no SET clause, no sub-select). mobile_filter_matches is untouched.
--   2. Three STORED GENERATED columns on listings (cat_root, cat_form, cat_path) = the category keys that are today dug out
--      of attributes jsonb on every row; and catalogue_attr_tokens(attributes) for an index on facet values.
--   3. Indexes (all partial: status = 'active' and deleted_at is null) for the default sort, price, commission sorts,
--      province, district, owner, category (covering -> index-only totals), _path, facet tokens, and the popular sort.
--   4. mobile_catalogue_page rewritten in plpgsql: builds only the predicates the request actually uses (static text,
--      values bound with USING or quoted with %L - no user text is ever concatenated), runs one ordered LIMIT query for
--      the page and one capped count (skipped when the page already proves the total). SECURITY DEFINER with a fixed
--      search_path; it reads exactly the rows the RLS policy lets the caller see and returns exactly the columns of
--      listing_public_cards. Same JSON shape {listings,total}, same filter meanings, total capped at 100001.
--      Equivalence: 420 randomised requests against this exact version (anon / owner of soft-deleted rows / admin):
--      identical total AND identical ordered listings JSON; plus the 18 comparable benchmark shapes at 1M rows.
--   5. OPTIONAL, commented out: word-level fuzzy search. This one DOES change results (see the section).
--
-- Things to know before applying
--   * Step 2 rewrites the listings table once (instant at today's size; takes an ACCESS EXCLUSIVE lock).
--   * cat_* are generated: an INSERT/UPDATE that names them, or "insert into listings select * from ...", will fail.
--   * The function must be owned by the owner of public.listings (it relies on bypassing RLS and re-applies the policy).
--   * The fuzzy search branch lowers pg_trgm.word_similarity_threshold for the transaction with set_config() (allowed for
--     anon on stock PostgreSQL; NOT verified on Supabase). If that is refused the function still returns the same results
--     but the fuzzy branch is not index-assisted. Check after deploy:
--        set role anon; select set_config('pg_trgm.word_similarity_threshold', '0.45', true); reset role;
--   * Statistics matter for the plans: keep the final ANALYZE, and re-check after the first big data load.
-- =====================================================================================================================

begin;

-- ---------------------------------------------------------------------------------------------------------------------
-- 1. Helper functions: identical results, inlinable form.
--    Measured per call: fold 3.2 -> 1.7 us, mobile_filter_number(mobile_filter_value()) 6.1 -> 0.5 us.
--    Note: without the SET clause the Supabase linter may report "function_search_path_mutable" for these three. They only
--    call built-in pg_catalog functions and run as SECURITY INVOKER, so there is nothing to hijack.
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.mobile_filter_fold(value text)
 returns text
 language sql
 immutable parallel safe
as $function$ select btrim(regexp_replace(regexp_replace(translate(lower(translate(coalesce(value, ''), 'İI', 'ii')), 'çğıöşüâîû', 'cgiosuaiu'), '[^a-z0-9[:space:]]', ' ', 'g'), '[[:space:]]+', ' ', 'g')) $function$;
alter function public.mobile_filter_fold(text) reset all;

create or replace function public.mobile_filter_value(attrs jsonb, field_key text)
 returns jsonb
 language sql
 immutable parallel safe
as $function$
 select coalesce(nullif(nullif(attrs -> field_key, 'null'::jsonb), '""'::jsonb), case field_key
   when 'km' then attrs -> 'mileage'
   when 'gear' then attrs -> 'transmission'
   when 'warranty' then attrs -> 'guarantee'
   when 'grossM2' then attrs -> 'm2'
   when 'm2' then attrs -> 'grossM2'
   when 'from' then coalesce(attrs -> 'sellerType', attrs -> 'fromOwner')
   when 'swap' then coalesce(attrs -> 'exchange', attrs -> 'trade') end)
$function$;
alter function public.mobile_filter_value(jsonb, text) reset all;

create or replace function public.mobile_filter_number(value jsonb)
 returns numeric
 language sql
 immutable parallel safe
as $function$
 select case
   when jsonb_typeof(value) = 'number' then (value #>> '{}')::numeric
   when replace(replace(regexp_replace(value #>> '{}', '[^0-9.,+-]', '', 'g'), '.', ''), ',', '.') ~ '^[+-]?[0-9]+([.][0-9]+)?$'
     then replace(replace(regexp_replace(value #>> '{}', '[^0-9.,+-]', '', 'g'), '.', ''), ',', '.')::numeric
   else null end
$function$;
alter function public.mobile_filter_number(jsonb) reset all;

-- ---------------------------------------------------------------------------------------------------------------------
-- 2. Category keys as stored generated columns + facet tokens.
--    cat_root : '' when _root is missing/empty, fold(_root) otherwise (NULL in the odd case of a non-empty _root that folds
--               to nothing) -> "coalesce(_root,'')='' or fold(_root)=root" becomes "cat_root in (root,'')".
--    cat_form : coalesce(_formKey,'').
--    cat_path : the string elements of _path when it is a json array, NULL otherwise -> "_path ? node" becomes
--               "cat_path @> array[node]"; "cat_path is null" identifies the rows that need the label fallback.
--    Measured: root-category request ~1.0 s (total needs 118k heap fetches) -> 95 ms (index-only scan).
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.catalogue_path_array(path jsonb)
 returns text[]
 language sql
 immutable parallel safe
as $function$
 select case when jsonb_typeof(path) = 'array'
   then array(select e #>> '{}' from jsonb_array_elements(path) e where jsonb_typeof(e) = 'string') end
$function$;

alter table public.listings
  add column if not exists cat_root text generated always as (
    case when coalesce(attributes ->> '_root', '') = '' then ''
         when public.mobile_filter_fold(attributes ->> '_root') = '' then null
         else public.mobile_filter_fold(attributes ->> '_root') end) stored,
  add column if not exists cat_form text generated always as (coalesce(attributes ->> '_formKey', '')) stored,
  add column if not exists cat_path text[] generated always as (public.catalogue_path_array(attributes -> '_path')) stored;

create or replace function public.catalogue_attr_tokens(attrs jsonb)
 returns text[]
 language sql
 immutable parallel safe
as $function$
 select coalesce(array_agg(distinct t.k || '=' || left(public.mobile_filter_fold(t.item), 64)), '{}'::text[])
 from (
   select e.key as k, e.value #>> '{}' as item
     from jsonb_each(case when jsonb_typeof(attrs) = 'object' then attrs else '{}'::jsonb end) e
   union all
   select e.key, i.item
     from jsonb_each(case when jsonb_typeof(attrs) = 'object' then attrs else '{}'::jsonb end) e
     cross join lateral jsonb_array_elements_text(case when jsonb_typeof(e.value) = 'array' then e.value else '[]'::jsonb end) as i(item)
 ) t
$function$;

-- ---------------------------------------------------------------------------------------------------------------------
-- 3. Indexes. Sizes at 1M rows: btree ~45 MB each, category covering index 185 MB, facet token GIN 66 MB, path GIN 13 MB.
--    On a large live table create them one by one with CREATE INDEX CONCURRENTLY outside a transaction instead.
--      listings_active_recommended_idx   default sort; index-only capped total              empty request 14.9 s -> 20 ms
--      listings_active_price_idx         price range + priceAsc/priceDesc                   59.9 s -> 16 ms / 32.6 s -> 19 ms
--      listings_active_province_idx,
--      listings_active_district_idx      location filter, ordered and index-only            13.6 s -> 14 ms
--      listings_active_owner_idx         seller rating / verified filters (join on owner)   20.3 s -> 126 ms
--      listings_active_commission*_idx   sort=commission / commissionRate                   34.1 s -> 22 ms
--      listings_active_category_idx      category totals without touching the heap          31.3 s -> 95 ms
--      listings_active_path_gin          category node lookup                               9.8 s -> 15 ms
--      listings_active_attr_tokens_gin   facet (attrs / attrsAny / owner / warranty / exchange) pre-filter   73 s -> 107 ms
--      listings_active_legacy_*          label fallback for rows without a _path array (tiny when those rows are rare)
--      listings_active_deleted_idx       "can this caller see any soft-deleted active row?" check (near-empty index)
--      listing_public_stats_popular_idx  sort=popular read in index order                   33.3 s -> 19 ms
-- ---------------------------------------------------------------------------------------------------------------------
create index if not exists listings_active_recommended_idx on public.listings (featured desc nulls last, created_at desc, id desc) where status = 'active' and deleted_at is null;
create index if not exists listings_active_price_idx on public.listings (price, created_at desc, id desc) where status = 'active' and deleted_at is null;
create index if not exists listings_active_province_idx on public.listings (province_id, featured desc nulls last, created_at desc, id desc) where status = 'active' and deleted_at is null;
create index if not exists listings_active_district_idx on public.listings (district_id, featured desc nulls last, created_at desc, id desc) include (province_id) where status = 'active' and deleted_at is null;
create index if not exists listings_active_owner_idx on public.listings (owner_id) where status = 'active' and deleted_at is null;
create index if not exists listings_active_commission_idx on public.listings ((case when commission_type = 'rate' then round(price * commission_value / 100.0) else commission_value end) desc, created_at desc, id desc) where status = 'active' and deleted_at is null;
create index if not exists listings_active_commission_rate_idx on public.listings ((case when commission_type = 'rate' then commission_value when price > 0 then round(commission_value / price * 100) else 0 end) desc, created_at desc, id desc) where status = 'active' and deleted_at is null;
create index if not exists listings_active_category_idx on public.listings (cat_root, featured desc nulls last, created_at desc, id desc) include (cat_form, cat_path, category, price, province_id, district_id) where status = 'active' and deleted_at is null;
create index if not exists listings_active_path_gin on public.listings using gin (cat_path) where status = 'active' and deleted_at is null;
create index if not exists listings_active_attr_tokens_gin on public.listings using gin (public.catalogue_attr_tokens(attributes)) where status = 'active' and deleted_at is null;
create index if not exists listings_active_legacy_root_idx on public.listings (cat_root) where status = 'active' and deleted_at is null and cat_path is null;
create index if not exists listings_active_legacy_category_idx on public.listings (public.mobile_filter_fold(category)) where status = 'active' and deleted_at is null and cat_path is null;
create index if not exists listings_active_legacy_split_idx on public.listings (id) where status = 'active' and deleted_at is null and cat_path is null and category ~ '[-/>·|]';
create index if not exists listings_active_deleted_idx on public.listings (owner_id) where status = 'active' and deleted_at is not null;
create index if not exists listing_public_stats_popular_idx on public.listing_public_stats (view_count desc, favorite_count desc) where view_count > 0;
create statistics if not exists public.listings_catalogue_root_form_stats on cat_root, cat_form from public.listings;

-- ---------------------------------------------------------------------------------------------------------------------
-- 4. The catalogue function.
-- ---------------------------------------------------------------------------------------------------------------------
create or replace function public.mobile_catalogue_page(params jsonb default '{}'::jsonb)
 returns jsonb
 language plpgsql
 stable security definer
 set search_path to 'public', 'pg_temp'
 set work_mem to '16MB'
as $function$
declare
  f           jsonb   := coalesce(params -> 'filters', '{}'::jsonb);
  v_q         text    := array_to_string((string_to_array(public.mobile_filter_fold(left(params ->> 'q', 120)), ' '))[1:8], ' ');
  v_root      text    := public.mobile_filter_fold(params ->> 'root');
  v_root_only boolean := coalesce((params ->> 'rootOnly')::boolean, false);
  v_labels    text[]  := array(select public.mobile_filter_fold(value) from jsonb_array_elements_text(coalesce(params -> 'labels', '[]'::jsonb)));
  v_forms     text[]  := array(select value from jsonb_array_elements_text(coalesce(params -> 'forms', '[]'::jsonb)));
  v_node      text    := coalesce(params ->> 'node', '');
  v_sort      text    := coalesce(params ->> 'sort', 'recommended');
  v_limit     integer := least(100, greatest(1, coalesce((params ->> 'limit')::integer, 24)));
  v_offset    integer := greatest(0, coalesce((params ->> 'offset')::integer, 0));
  v_uid       uuid    := (select auth.uid());
  v_admin     boolean := coalesce((select public.is_admin()), false);
  v_min numeric; v_max numeric; v_prov integer; v_dist integer; v_min_comm numeric; v_min_rate numeric; v_min_rating numeric;
  v_created_after timestamptz;
  v_toks      text[]  := '{}';
  v_tok       text;
  v_fuzzy_ix  boolean := false;
  v_word_mode boolean := false;
  v_akeys     text[];
  v_fs        text[];
  v_del_visible boolean := false;
  v_words     text[];
  v_old_thr   text;
  w           text[]  := array['l.status = ''active'''];   -- WHERE parts (static text + %L literals + $n binds only)
  v_from      text    := 'public.listings l';
  v_else      text;
  v_val       text;
  v_parts     text[];
  v_exact     text;
  v_lo numeric; v_hi numeric;
  r           record;
  tk          text[]  := '{}';                              -- per-token search predicates
  ok_expr     text[]  := '{}';                              -- ORDER BY expressions (whitelisted text only)
  ok_dir      text[]  := '{}';
  v_base      text;
  v_tok_all   text;
  v_order     text;
  v_keys      text := '';
  v_morder    text[] := '{}';
  v_cnt_e     bigint;
  i           integer;
  v_ids       uuid[];
  v_listings  jsonb;
  v_n         integer;
  v_total     bigint;
  k_true  constant text := '(''true'',''evet'',''var'',''garantili'',''takasli'',''sahibinden'')';
  k_false constant text := '(''false'',''hayir'',''yok'')';
begin
  -- Row visibility: identical to the RLS policy "active listings are readable" combined with status = 'active'.
  -- A soft-deleted active row is visible only to its owner or an admin. When the caller cannot see any such row (always
  -- true for anon, and for everybody while no such row exists) the plain "deleted_at is null" form is used, which lets
  -- the partial indexes (status = 'active' and deleted_at is null) answer the query.
  if v_admin then
    v_del_visible := exists (select 1 from public.listings x where x.status = 'active' and x.deleted_at is not null);
  elsif v_uid is not null then
    v_del_visible := exists (select 1 from public.listings x where x.status = 'active' and x.deleted_at is not null and x.owner_id = v_uid);
  end if;
  if not v_del_visible then w := array_append(w, 'l.deleted_at is null');
  elsif not v_admin then w := array_append(w, '(l.deleted_at is null or l.owner_id = $18)');
  end if;

  if coalesce(f ->> 'currency', '') <> '' then w := array_append(w, 'coalesce(l.currency, ''TRY'') = $10'); end if;
  if coalesce(f ->> 'excludeOwner', '') <> '' then w := array_append(w, 'l.owner_id::text <> $11'); end if;
  if v_sort = 'featured' or coalesce((f ->> 'featured')::boolean, false) then w := array_append(w, 'l.featured is true'); end if;

  -- Search: every token must match as a substring or by word_similarity >= 0.45 (unchanged semantics).
  if v_q <> '' then
    select coalesce(array_agg(tok), '{}') into v_toks from unnest(string_to_array(v_q, ' ')) tok where tok <> '';
    -- Optional index assist for the fuzzy branch: "tok <% text" is a necessary condition for word_similarity >= 0.45
    -- only when pg_trgm.word_similarity_threshold <= 0.45. Try to lower it for this transaction; if that is not
    -- possible the query simply runs without the extra (redundant) clause, results are identical either way.
    begin
      perform public.similarity('a', 'a');   -- makes sure pg_trgm (and its settings) is loaded
      v_old_thr := current_setting('pg_trgm.word_similarity_threshold', true);
      perform set_config('pg_trgm.word_similarity_threshold', '0.45', true);
    exception when others then null;
    end;
    begin
      v_fuzzy_ix := coalesce(current_setting('pg_trgm.word_similarity_threshold', true)::double precision <= 0.45, false);
    exception when others then v_fuzzy_ix := false;
    end;
    -- OPTIONAL word-level fuzzy mode (section 5 of the migration): active only when the word dictionary exists and is filled.
    if to_regclass('public.catalogue_search_words') is not null then
      execute 'select exists (select 1 from public.catalogue_search_words)' into v_word_mode;
    end if;
    foreach v_tok in array v_toks loop
      -- v_tok is [a-z0-9]+ (output of mobile_filter_fold) and still passed through %L.
      if v_word_mode then
        execute 'select coalesce(array_agg(d.word), ''{}'') from public.catalogue_search_words d where '
             || case when v_fuzzy_ix then '$1 <% d.word and ' else '' end || 'public.word_similarity($1, d.word) >= 0.45'
          into v_words using v_tok;
        if cardinality(v_words) > 0 then
          tk := array_append(tk, format('(l.search_text like %1$L or string_to_array(l.search_text, '' '') && %2$L::text[])', '%' || v_tok || '%', v_words));
        else
          tk := array_append(tk, format('l.search_text like %L', '%' || v_tok || '%'));
        end if;
      else
        tk := array_append(tk, format('(l.search_text like %1$L or public.word_similarity(%2$L, l.search_text) >= 0.45)', '%' || v_tok || '%', v_tok));
        if v_fuzzy_ix then
          tk := array_append(tk, format('(l.search_text like %1$L or %2$L <%% l.search_text)', '%' || v_tok || '%', v_tok));
        end if;
      end if;
      v_parts := v_parts || format('l.search_text like %L', '%' || v_tok || '%');
    end loop;
    v_exact := '(' || array_to_string(v_parts, ' and ') || ')';
    v_tok_all := array_to_string(tk, ' and ');
  end if;

  -- Category gates, evaluated on the stored generated columns cat_root / cat_form / cat_path (plain columns: usable in
  -- btree/GIN indexes, index-only scans and planner statistics, which jsonb expressions are not).
  --   original root gate : coalesce(_root,'') = '' or fold(_root) = root      ==  cat_root in (root, '')
  --   original form gate : coalesce(_formKey,'') = '' or _formKey = any(forms) ==  cat_form = any(forms || '')
  if v_root <> '' then
    w := array_append(w, 'l.cat_root = any (array[$2, ''''])');
  end if;
  if cardinality(v_forms) > 0 then
    w := array_append(w, 'l.cat_form = any ($3)');
  end if;
  -- original: case when node <> '' and _path is an array then _path ? node else <label fallback> end.
  -- Flat OR so every arm can use its own index (BitmapOr): the path arm uses the cat_path indexes; the three fallback
  -- arms only concern rows WITHOUT a _path array (cat_path is null) and use small partial indexes on exactly those rows.
  -- (regexp_split_to_table returns the whole category when it holds no separator, so the split arm only needs rows
  -- whose category contains one.)
  if cardinality(v_labels) > 0 then
    v_parts := array[]::text[];
    if v_root_only then
      v_parts := array_append(v_parts, case when v_root <> '' then 'l.cat_root = $2' else 'coalesce(l.cat_root, '''') = ''''' end);
    end if;
    v_parts := array_append(v_parts, 'public.mobile_filter_fold(l.category) = any ($4)');
    v_parts := array_append(v_parts, '(l.category ~ ''[-/>·|]'' and exists (select 1 from regexp_split_to_table(l.category, ''\s*[-/>·|]\s*'') part where public.mobile_filter_fold(part) = any ($4)))');
    if v_node <> '' then
      select string_agg('(l.cat_path is null and ' || x || ')', ' or ') into v_else from unnest(v_parts) x;
      w := array_append(w, '(l.cat_path @> array[$5] or ' || v_else || ')');
    else
      w := array_append(w, '(' || array_to_string(v_parts, ' or ') || ')');
    end if;
  end if;

  if coalesce(f ->> 'min', '') <> '' then v_min := public.mobile_filter_number(f -> 'min'); w := array_append(w, 'l.price >= $6'); end if;
  if coalesce(f ->> 'max', '') <> '' then v_max := public.mobile_filter_number(f -> 'max'); w := array_append(w, 'l.price <= $7'); end if;
  if coalesce(f #>> '{loc,provinceId}', '') <> '' then v_prov := (f #>> '{loc,provinceId}')::integer; w := array_append(w, 'l.province_id = $8'); end if;
  if coalesce(f #>> '{loc,districtId}', '') <> '' then v_dist := (f #>> '{loc,districtId}')::integer; w := array_append(w, 'l.district_id = $9'); end if;
  if coalesce((f ->> 'open')::boolean, false) then w := array_append(w, 'l.partnership_mode in (''open'', ''approval'')'); end if;
  if coalesce((f ->> 'instant')::boolean, false) then w := array_append(w, 'l.partnership_mode = ''open'''); end if;
  if coalesce(f ->> 'minCommission', '') <> '' then
    v_min_comm := public.mobile_filter_number(f -> 'minCommission');
    w := array_append(w, '(case when l.commission_type = ''rate'' then round(l.price * l.commission_value / 100.0) else l.commission_value end) >= $12');
  end if;
  if coalesce(f ->> 'minRate', '') <> '' then
    v_min_rate := public.mobile_filter_number(f -> 'minRate');
    w := array_append(w, '(case when l.commission_type = ''rate'' then l.commission_value when l.price > 0 then round(l.commission_value / l.price * 100) else 0 end) >= $13');
  end if;
  if coalesce(f ->> 'commissionType', '') <> '' then w := array_append(w, 'l.commission_type = $14'); end if;
  if coalesce(f ->> 'stock', '') <> '' then
    w := array_append(w, case f ->> 'stock' when 'in' then 'l.stock_count > 0' when 'low' then 'l.stock_count between 1 and 5' else 'false' end);
  end if;
  if coalesce(f ->> 'createdAfter', '') <> '' then v_created_after := (f ->> 'createdAfter')::timestamptz; w := array_append(w, 'l.created_at >= $15'); end if;
  if coalesce(f ->> 'minRating', '') <> '' or coalesce((f ->> 'verified')::boolean, false) then
    -- one probe of profiles (primary key) instead of two; each condition is added only when requested
    v_val := '';
    if coalesce(f ->> 'minRating', '') <> '' then
      v_min_rating := public.mobile_filter_number(f -> 'minRating');
      v_val := v_val || ' and p.rating >= $16';
    end if;
    if coalesce((f ->> 'verified')::boolean, false) then v_val := v_val || ' and (p.verified_phone or p.verified_identity)'; end if;
    w := array_append(w, 'exists (select 1 from public.profiles p where p.id = l.owner_id' || v_val || ')');
  end if;
  if coalesce(f ->> 'city', '') <> '' then w := array_append(w, 'l.location = $17'); end if;
  if coalesce((f ->> 'trend')::boolean, false) then
    w := array_append(w, 'exists (select 1 from public.listing_public_stats st where st.listing_id = l.id and (coalesce(st.view_count, 0) + coalesce(st.favorite_count, 0) * 3 + coalesce(st.lead_count, 0) * 5) > 0)');
  end if;
  if coalesce((f ->> 'photos')::boolean, false) then
    w := array_append(w, '(nullif((select li.url from public.listing_images li where li.listing_id = l.id order by li.sort_order limit 1), '''') is not null or coalesce(array_length(l.ad_assets, 1), 0) > 0)');
  end if;
  if coalesce((f ->> 'urgent')::boolean, false) then
    w := array_append(w, 'coalesce(l.attributes ->> ''_urgentUntil'', '''') > to_char(current_timestamp at time zone ''UTC'', ''YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'')');
  end if;

  -- Attribute filters: mobile_filter_matches(mobile_filter_value(attrs, key), expected) specialised per key, with the
  -- expected side folded once here instead of once per row. Keys/values only ever enter the SQL through %L.
  for r in
    select key, value, 'all' as mode from jsonb_each(coalesce(f -> 'attrs', '{}'::jsonb))
    union all select 'from', '"true"'::jsonb, 'all' where coalesce((f ->> 'owner')::boolean, false)
    union all select 'warranty', '"true"'::jsonb, 'all' where coalesce((f ->> 'warranty')::boolean, false)
    union all select 'swap', '"true"'::jsonb, 'all' where coalesce((f ->> 'exchange')::boolean, false)
    union all select a.key, a.value, 'any' from jsonb_each(coalesce(f -> 'attrsAny', '{}'::jsonb)) a
      where jsonb_typeof(a.value) = 'array' and jsonb_array_length(a.value) > 0
  loop
    v_val := format('public.mobile_filter_value(l.attributes, %L)', r.key);
    -- keys that mobile_filter_value may read for this field (the field itself + its aliases): used for the index pre-filter
    v_akeys := array[r.key] || case r.key when 'km' then array['mileage'] when 'gear' then array['transmission']
      when 'warranty' then array['guarantee'] when 'grossM2' then array['m2'] when 'm2' then array['grossM2']
      when 'from' then array['sellerType', 'fromOwner'] when 'swap' then array['exchange', 'trade'] else array[]::text[] end;
    v_fs := null;
    if r.mode = 'any' then
      v_fs := (select array_agg(public.mobile_filter_fold(e #>> '{}')) from jsonb_array_elements(r.value) e);
      w := array_append(w, format('(%1$s is not null and %1$s <> ''null''::jsonb and (case when jsonb_typeof(%1$s) = ''array'' then exists (select 1 from jsonb_array_elements_text(%1$s) item where public.mobile_filter_fold(item) = any (%2$L::text[])) else public.mobile_filter_fold(%1$s #>> ''{}'') = any (%2$L::text[]) end))',
        v_val, (select array_agg(public.mobile_filter_fold(e #>> '{}')) from jsonb_array_elements(r.value) e)));
    elsif r.value = '""'::jsonb or r.value = '[]'::jsonb then
      null;
    elsif jsonb_typeof(r.value) = 'array' then
      select array_agg(format('(case when jsonb_typeof(%1$s) = ''array'' then exists (select 1 from jsonb_array_elements_text(%1$s) item where public.mobile_filter_fold(item) = %2$L) else public.mobile_filter_fold(%1$s #>> ''{}'') = %2$L end)', v_val, fs))
        into v_parts from (select distinct public.mobile_filter_fold(e) as fs from jsonb_array_elements_text(r.value) e) d;
      -- every selected value must be present: one pre-filter clause per value
      w := array_append(w, (select string_agg(format('public.catalogue_attr_tokens(l.attributes) && %L::text[]',
             (select array_agg(k || '=' || left(d.fs, 64)) from unnest(v_akeys) k)), ' and ')
           from (select distinct public.mobile_filter_fold(e) as fs from jsonb_array_elements_text(r.value) e) d));
      w := array_append(w, format('(%1$s is not null and %1$s <> ''null''::jsonb and %2$s)', v_val, array_to_string(v_parts, ' and ')));
    elsif public.mobile_filter_fold(r.value #>> '{}') = 'true' then
      w := array_append(w, format('(%1$s is not null and %1$s <> ''null''::jsonb and public.mobile_filter_fold(%1$s #>> ''{}'') in %2$s)', v_val, k_true));
      v_fs := array['true', 'evet', 'var', 'garantili', 'takasli', 'sahibinden'];
    elsif public.mobile_filter_fold(r.value #>> '{}') = 'false' then
      w := array_append(w, format('(%1$s is not null and %1$s <> ''null''::jsonb and public.mobile_filter_fold(%1$s #>> ''{}'') in %2$s)', v_val, k_false));
      v_fs := array['false', 'hayir', 'yok'];
    else
      w := array_append(w, format('(%1$s is not null and %1$s <> ''null''::jsonb and public.mobile_filter_fold(%1$s #>> ''{}'') = %2$L)', v_val, public.mobile_filter_fold(r.value #>> '{}')));
      v_fs := array[public.mobile_filter_fold(r.value #>> '{}')];
    end if;
    -- Index pre-filter (necessary condition of the exact test above, which stays in place): the listing must carry at
    -- least one "key=folded value" token for one of the readable keys and one of the accepted values.
    if v_fs is not null then
      w := array_append(w, format('public.catalogue_attr_tokens(l.attributes) && %L::text[]',
             (select array_agg(k || '=' || left(x, 64)) from unnest(v_akeys) k cross join unnest(v_fs) x)));
    end if;
  end loop;
  for r in select key, value from jsonb_each_text(coalesce(f -> 'texts', '{}'::jsonb)) where value <> '' loop
    w := array_append(w, format('position(%2$L in public.mobile_filter_fold(public.mobile_filter_value(l.attributes, %1$L) #>> ''{}'')) <> 0', r.key, public.mobile_filter_fold(r.value)));
  end loop;
  for r in select key, value from jsonb_each(coalesce(f -> 'ranges', '{}'::jsonb))
           where coalesce(value ->> 'min', '') <> '' or coalesce(value ->> 'max', '') <> '' loop
    v_val := format('public.mobile_filter_number(public.mobile_filter_value(l.attributes, %L))', r.key);
    v_lo := case when coalesce(r.value ->> 'min', '') <> '' then public.mobile_filter_number(r.value -> 'min') end;
    v_hi := case when coalesce(r.value ->> 'max', '') <> '' then public.mobile_filter_number(r.value -> 'max') end;
    if v_lo is null and v_hi is null then w := array_append(w, (v_val || ' is not null'));
    else
      if v_lo is not null then w := array_append(w, format('%s >= %L::numeric', v_val, v_lo)); end if;
      if v_hi is not null then w := array_append(w, format('%s <= %L::numeric', v_val, v_hi)); end if;
    end if;
  end loop;

  -- ORDER BY: same keys as before; terms that were constant NULL for the requested sort are simply omitted.
  if v_sort = 'recommended' and v_q <> '' then
    ok_expr := array_append(ok_expr, format('(case when %s then 0 else 1 end)', v_exact)); ok_dir := array_append(ok_dir, 'asc nulls last');
  end if;
  if v_sort = 'popular' then
    v_from := v_from || ' left join public.listing_public_stats s on s.listing_id = l.id';
    ok_expr := array_append(ok_expr, 'coalesce(s.view_count, 0)'); ok_dir := array_append(ok_dir, 'desc');
    ok_expr := array_append(ok_expr, 'coalesce(s.favorite_count, 0)'); ok_dir := array_append(ok_dir, 'desc');
  elsif v_sort = 'priceAsc' then ok_expr := array_append(ok_expr, 'l.price'); ok_dir := array_append(ok_dir, 'asc');
  elsif v_sort = 'priceDesc' then ok_expr := array_append(ok_expr, 'l.price'); ok_dir := array_append(ok_dir, 'desc');
  elsif v_sort = 'commission' then
    ok_expr := array_append(ok_expr, '(case when l.commission_type = ''rate'' then round(l.price * l.commission_value / 100.0) else l.commission_value end)'); ok_dir := array_append(ok_dir, 'desc');
  elsif v_sort = 'commissionRate' then
    ok_expr := array_append(ok_expr, '(case when l.commission_type = ''rate'' then l.commission_value when l.price > 0 then round(l.commission_value / l.price * 100) else 0 end)'); ok_dir := array_append(ok_dir, 'desc');
  elsif v_sort = 'rating' then
    v_from := v_from || ' left join public.profiles pr on pr.id = l.owner_id';
    ok_expr := array_append(ok_expr, 'pr.rating'); ok_dir := array_append(ok_dir, 'desc nulls last');
  elsif v_sort = 'recommended' then ok_expr := array_append(ok_expr, 'l.featured'); ok_dir := array_append(ok_dir, 'desc nulls last');
  end if;
  ok_expr := array_append(ok_expr, 'l.created_at'); ok_dir := array_append(ok_dir, 'desc');
  ok_expr := array_append(ok_expr, 'l.id'); ok_dir := array_append(ok_dir, 'desc');
  select string_agg(t.e || ' ' || t.d, ', ' order by t.n) into v_order from unnest(ok_expr, ok_dir) with ordinality as t(e, d, n);

  v_base := array_to_string(w, ' and ');

  if v_q = '' then
    if v_sort = 'popular' then
      -- Rows with view_count > 0 sort before every other row (view_count / favorite_count are NOT NULL), so when that
      -- subset alone fills the page the result is identical and can be read in index order from the stats table.
      execute 'select coalesce(array_agg(x.id), ''{}'') from (select l.id from public.listings l join public.listing_public_stats s on s.listing_id = l.id where '
           || v_base || ' and s.view_count > 0 order by s.view_count desc, s.favorite_count desc, l.created_at desc, l.id desc limit $19 offset $20) x'
        into v_ids using f, v_root, v_forms || ''::text, v_labels, v_node, v_min, v_max, v_prov, v_dist, f ->> 'currency', f ->> 'excludeOwner',
             v_min_comm, v_min_rate, f ->> 'commissionType', v_created_after, v_min_rating, f ->> 'city', v_uid, v_limit, v_offset;
    end if;
    -- (1) page ids: one ordered, limited scan.  (2) capped total, skipped when the page itself proves it.
    if v_ids is null or cardinality(v_ids) < v_limit then
    execute 'select coalesce(array_agg(x.id), ''{}'') from (select l.id from ' || v_from || ' where ' || v_base
         || ' order by ' || v_order || ' limit $19 offset $20) x'
      into v_ids using f, v_root, v_forms || ''::text, v_labels, v_node, v_min, v_max, v_prov, v_dist, f ->> 'currency', f ->> 'excludeOwner',
             v_min_comm, v_min_rate, f ->> 'commissionType', v_created_after, v_min_rating, f ->> 'city', v_uid, v_limit, v_offset;
    end if;
    v_n := cardinality(v_ids);
    if v_n < v_limit and (v_n > 0 or v_offset = 0) then
      v_total := least(v_offset + v_n, 100001);     -- the page ran past the end of the result set: total is known exactly
    else
      execute 'select count(*) from (select 1 from public.listings l where ' || v_base || ' limit 100001) capped'
        into v_total using f, v_root, v_forms || ''::text, v_labels, v_node, v_min, v_max, v_prov, v_dist, f ->> 'currency', f ->> 'excludeOwner',
             v_min_comm, v_min_rate, f ->> 'commissionType', v_created_after, v_min_rating, f ->> 'city', v_uid, v_limit, v_offset;
    end if;
  else
    -- Search. Rows where every token is a plain substring ("exact" rows) are found through the trigram index without
    -- evaluating word_similarity at all, so count them first (capped).
    execute 'select count(*) from (select 1 from public.listings l where ' || v_base || ' and ' || v_exact || ' limit 100001) capped'
      into v_cnt_e using f, v_root, v_forms || ''::text, v_labels, v_node, v_min, v_max, v_prov, v_dist, f ->> 'currency', f ->> 'excludeOwner',
             v_min_comm, v_min_rate, f ->> 'commissionType', v_created_after, v_min_rating, f ->> 'city', v_uid, v_limit, v_offset;
    if v_cnt_e >= 100001 then
      -- The exact rows alone reach the cap, and they are a subset of the result: total = 100001 without any fuzzy work.
      v_total := 100001;
      if v_sort = 'recommended' and v_offset + v_limit <= v_cnt_e then
        -- "recommended" puts exact rows first, so this page consists of exact rows only (rank term = 0 for all of them).
        select string_agg(t.e || ' ' || t.d, ', ' order by t.n) into v_order from unnest(ok_expr, ok_dir) with ordinality as t(e, d, n) where t.n > 1;
        execute 'select coalesce(array_agg(x.id), ''{}'') from (select l.id from ' || v_from || ' where ' || v_base || ' and ' || v_exact
             || ' order by ' || v_order || ' limit $19 offset $20) x'
          into v_ids using f, v_root, v_forms || ''::text, v_labels, v_node, v_min, v_max, v_prov, v_dist, f ->> 'currency', f ->> 'excludeOwner',
             v_min_comm, v_min_rate, f ->> 'commissionType', v_created_after, v_min_rating, f ->> 'city', v_uid, v_limit, v_offset;
      else
        execute 'select coalesce(array_agg(x.id), ''{}'') from (select l.id from ' || v_from || ' where ' || v_base || ' and ' || v_tok_all
             || ' order by ' || v_order || ' limit $19 offset $20) x'
          into v_ids using f, v_root, v_forms || ''::text, v_labels, v_node, v_min, v_max, v_prov, v_dist, f ->> 'currency', f ->> 'excludeOwner',
             v_min_comm, v_min_rate, f ->> 'commissionType', v_created_after, v_min_rating, f ->> 'city', v_uid, v_limit, v_offset;
      end if;
    else
      -- Fewer exact rows than the cap: one pass over all matches (each candidate row is tested once), then the page and
      -- the total are both taken from that materialised set.
      for i in 1 .. cardinality(ok_expr) loop
        v_keys := v_keys || format(', %s as k%s', ok_expr[i], i);
        v_morder := array_append(v_morder, format('m.k%s %s', i, ok_dir[i]));
      end loop;
      execute 'with m as materialized (select l.id' || v_keys || ' from ' || v_from || ' where ' || v_base || ' and ' || v_tok_all || ')'
           || ' select (select count(*) from m), (select coalesce(array_agg(x.id), ''{}'') from (select m.id from m order by '
           || array_to_string(v_morder, ', ') || ' limit $19 offset $20) x)'
        into v_total, v_ids using f, v_root, v_forms || ''::text, v_labels, v_node, v_min, v_max, v_prov, v_dist, f ->> 'currency', f ->> 'excludeOwner',
             v_min_comm, v_min_rate, f ->> 'commissionType', v_created_after, v_min_rating, f ->> 'city', v_uid, v_limit, v_offset;
      v_total := least(v_total, 100001);
    end if;
    if v_old_thr is not null then
      begin perform set_config('pg_trgm.word_similarity_threshold', v_old_thr, true); exception when others then null; end;
    end if;
  end if;

  -- Card payload for the page rows only, in page order (same columns as before: the listing_public_cards view).
  select coalesce(jsonb_agg(to_jsonb(card) order by pg.ord), '[]'::jsonb) into v_listings
    from unnest(v_ids) with ordinality as pg(id, ord) join public.listing_public_cards card on card.id = pg.id;

  return jsonb_build_object('listings', v_listings, 'total', v_total);
end
$function$;

revoke all on function public.mobile_catalogue_page(jsonb) from public;
grant execute on function public.mobile_catalogue_page(jsonb) to anon, authenticated, service_role;

analyze public.listings;
analyze public.listing_public_stats;

commit;

-- Indexes that the new function no longer uses (NOT dropped here - check pg_stat_user_indexes / other callers first):
--   listings_root_fold_idx, listings_form_key_idx, listings_category_path_gin, listings_status_price_idx.

-- =====================================================================================================================
-- 5. OPTIONAL - word-level fuzzy search.  CHANGES RESULTS.  Remove the comment markers to enable; "truncate
--    public.catalogue_search_words" switches back to today's behaviour at any time (the function checks the table).
--
--    Today a token matches a listing when it is a substring of search_text OR word_similarity(token, search_text) >= 0.45,
--    i.e. similarity against the best stretch of the whole text. That cannot be answered from an index without calling
--    word_similarity on every candidate row: 15k-240k candidates per token at 1M rows, ~80 us each -> 1-16 s per search
--    even after section 4 (and anon has statement_timeout 3s).
--    With the dictionary below a token matches when it is a substring of search_text OR the listing contains a WORD w with
--    word_similarity(token, w) >= 0.45. The words are looked up in a small dictionary table first, the listings then come
--    from a GIN index - no per-row similarity call.
--    Measured at 1M rows: 1 word 3.2 s -> 140 ms, 3 words 1.0 s -> 163 ms, misspelled word 3.6 s -> 13 ms.
--    Measured difference on 120 random searches (60k-row sample): 59 identical, 61 returned fewer rows (4.9% of all rows,
--    the ones that only matched across a word boundary), none returned more; first page identical in 98 of 120.
--    Ordering rules are unchanged.
-- =====================================================================================================================
/*
begin;
create table if not exists public.catalogue_search_words (word text primary key);
alter table public.catalogue_search_words enable row level security;
revoke all on public.catalogue_search_words from public, anon, authenticated;
create index if not exists catalogue_search_words_trgm on public.catalogue_search_words using gin (word gin_trgm_ops);
create index if not exists listings_search_words_gin on public.listings using gin (string_to_array(search_text, ' ')) where status = 'active';

create or replace function public.catalogue_index_search_words()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public', 'pg_temp'
as $function$
begin
  if new.search_text is not null and (tg_op = 'INSERT' or new.search_text is distinct from old.search_text) then
    insert into public.catalogue_search_words (word)
      select distinct w from unnest(string_to_array(new.search_text, ' ')) w where w <> '' and length(w) <= 60
      order by 1
      on conflict do nothing;
  end if;
  return null;
end
$function$;
revoke all on function public.catalogue_index_search_words() from public, anon, authenticated;

drop trigger if exists listings_search_words on public.listings;
create trigger listings_search_words after insert or update of title, description, category, location, tags on public.listings
  for each row execute function public.catalogue_index_search_words();

insert into public.catalogue_search_words (word)
  select distinct w from public.listings l, unnest(string_to_array(l.search_text, ' ')) w where w <> '' and length(w) <= 60
  on conflict do nothing;
analyze public.catalogue_search_words;
commit;
*/
