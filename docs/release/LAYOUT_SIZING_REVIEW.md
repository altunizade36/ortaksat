# Layout sizing review — 25 October 2026

## Corrected

- Horizontal category, filter, tab and thumbnail strips now use an intrinsic-height shared HorizontalScroll. The vertical page can retain flexGrow: 1 for footer positioning without stretching its horizontal children.
- Category headers show the current category with a bounded title and breadcrumb. Listing rows have a fixed-height image and naturally sized text.
- Shared listing cards no longer nest vertical flex: 1 / flexGrow chains. Actions follow the content without an expanding blank area. Prices fit narrow cards.
- Mobile web cards use natural layout instead of offscreen size containment. Desktop content-visibility optimization is retained.
- Paging/fullscreen photo galleries retain their original ScrollView sizing. Photo limits and upload behavior are unchanged.

## Validation

- TypeScript check and both mobile-preview and production-web static exports passed.
- 11 root categories and 23 root/child layout scenarios at each of 320px and 390px: empty content, owner filter and child navigation, then populated listing rows and empty partnership tabs.
- Favorite cards at 320px, 390px and 1440px: stable heights after scrolling, comparison toggle and opening/closing a collection dialog. No horizontal document overflow or uncaught JavaScript errors.
- Eight routes at 320px/390px retain a full-width 148px footer aligned above bottom navigation.
- Android emulator visually verified empty Emlak/Konut and partnership requests, including actual category navigation.
- Browser tests mock Supabase HTTP/WebSocket traffic; no live listings, favorites, collections or partnerships were changed.

Evidence: audit/mobile-v4/layout-sizing-mobile.json, layout-sizing-web.json, footer-boundary-results.json, category-child-sizing-native.png and partner-sizing-native.png.

These changes are local and have not been deployed to the public website or distributed as a native release.
