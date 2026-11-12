# Saved search and listing gallery review — 26 October 2026

## Changes

- Saved mobile searches restore supported currencies and normalize the legacy newest-sort key. Province/district IDs must exist and match. Malformed JSON, incorrect field shapes and unsafe object keys are ignored. Zero and explicit false selections remain intact. Account-specific owner exclusion is not carried into a portable saved preference.
- Currency is visible/removable in catalogue criteria and selectable in the filter panel. User reset removes it; the general reset helper can still retain constraints supplied by a containing flow. Range labels use the chosen currency.
- Listing mapping no longer fabricates an unrelated stock product image when the cover is missing. It uses a real additional photo when available; otherwise it retains an empty image.
- Gallery sources trim/deduplicate real image URIs. Mobile detail shows a photo-free placeholder and no false count. Its image pages and fullscreen images have bounded dimensions; photo changes reset selection/lightbox and viewport resizing retains the current image. Preview gallery sizing was corrected as well.
- Web listing detail deduplicates the cover and shows a non-interactive photo-free placeholder, without an enlarge action for a nonexistent photo.

## Verification

- TypeScript passed; production web export completed at dist-check-mobile/saved-gallery-web-complete.
- Pure tests passed for saved currency/sort, valid and invalid location relationships, malformed records, zero/false values, safe keys, real-image fallback and deduplication. Existing 987-field / 57-schema filter checks passed.
- Mobile browser UI: three-photo gallery, positive hero dimensions, second-photo selection, fullscreen open/close, selection retained after viewport resize, truthful no-photo listing, saved-search currency/sort restoration and currency reset. No uncaught JavaScript errors.
- Production web UI at 390px/1440px: no-photo gallery disabled, no empty enlarge action and a duplicated cover counted once. No overflow or uncaught JavaScript errors.
- Android emulator: actual public listing opened, real hero image and four bounded thumbnails inspected visually. No live listing was edited and no message/application was sent.
- Browser tests mock Supabase HTTP/WebSocket traffic. No production database/schema/API changes or public deployment were performed.

Evidence: audit/mobile-v4/saved-gallery-ui.json, gallery-detail-native.png, listing-no-photo.png, and audit/web-review/gallery-ui.json.

Legacy saved fields without a mobile counterpart (such as old stock/commission thresholds) are outside this batch. Public deployment and native release remain separate work.
