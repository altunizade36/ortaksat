# Search, filter and product result review — 25 October 2026

## Changes

- Mobile catalogue results have an editable, category-scoped search field, a search action, keyboard submission and a clear action. Submissions normalize whitespace and keep applied category/price/location criteria. Search dismisses the native keyboard.
- A logical filter count and removable quick filters expose applied criteria. All/clear resets every user criterion while preserving containing-flow currency/owner constraints. An enforced partnership-only flow stays open-only; an ordinary reset can clear an initially applied open-only criterion.
- Changing the draft filter category preserves shared filters (price/location/flags) and clears category-specific attributes/ranges/text fields.
- Failed count previews are distinguished from loading, with a readable message and a working apply action. Invalid ranges remain blocked.
- Empty searches offer a real search reset; unfiltered empty categories link to other categories. Loading content does not suggest changing filters prematurely.
- Invite-only products are labeled as invitations, favorite actions describe their current operation, and photo counts cannot display 1/0.

## Verification

- TypeScript passed. Production web export: dist-check-mobile/search-web-final.
- Filter regression checks passed across 987 fields / 57 schemas, including zero/false criteria, count grouping, context-preserving resets and enforced open-only reset.
- Browser UI checks passed for search normalization/preserved criteria, category changes, complete reset, All, preview count failure/apply, empty-search recovery, invitation labels, 320/390px and no uncaught JavaScript errors. Supabase HTTP/WebSocket traffic was mocked; no live data writes.
- Current Metro client/assets were tested over an unchanged local category-index shell; navigation to modified screens used SPA links. Modal exit animations were allowed to finish before typing.
- Android emulator: current catalogue visually inspected; keyboard submission produced a real empty result, then clear restored the category's existing listing.

Evidence: audit/mobile-v4/search-filter-ui.json, search-native-results.json, search-filter-320.png, search-filter-390.png, search-filter-native.png and search-empty-native.png.

Server search/ranking semantics and database functions were not changed in this UI batch. These changes remain local; no public deployment/native binary release was performed.
