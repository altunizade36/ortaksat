# Navigation review — 25 October 2026

## Changes

- Tab navigation uses fullHistory instead of the default firstRoute behavior. Repeated tab visits are retained for Android hardware Back and screen Back actions.
- Shared mobile/web headers prefer actual navigator history. A directly opened screen with no history returns to its relevant section (messages, seller listings, account settings, categories or discovery), rather than always home.
- Category child selections and category picker/filter category changes push actual category routes. Parent criteria and sort are stored in the existing route entry so Back restores them after a web remount. Filter clearing keeps the active category.
- Listing detail uses the shared Back handler.
- Mobile listing creation handles Back through the previous form step, then leaves the route from the first step. Hardware Back follows the same step behavior; publishing/picking does not interrupt an active operation. Preview returns to partnership settings. Open native photo/draft/category modals retain their own close handling.
- Category selection handles search clearing / previous category consistently for its header and Android Back.
- Selected category chips and create steps expose aria-pressed on web.

## Validation

- TypeScript passed.
- Production web export passed: dist-check-mobile/navigation-web-final.
- Mobile preview export passed; final mobile UI checks used the current Metro client and assets over a local static shell, with mocked Supabase HTTP/WebSocket traffic. No live data writes.
- Browser checks: category chain Satılık → Konut → Emlak → Kategoriler; retained parent owner filter; filter dismissal; favorites returning to source; repeated tabs; contextual direct-link fallbacks; previous create step without leaving the form. No uncaught JavaScript errors.
- Production web checks at 390px and 1440px: information page → contact → header Back restores previous page.
- Installed TabRouter checks: fullHistory repeated tab GO_BACK sequence and OS handling at root, plus contextual fallbacks.
- Android emulator: repeated Home/Explore visits unwind in actual visit order with hardware Back. Home → Emlak → Konut → hardware Back → Emlak → header Back → Home passed.

Evidence: audit/mobile-v4/back-navigation-ui.json, back-navigation-native.json, audit/web-review/back-navigation-ui.json.

Local implementation only; not deployed to the public website or released as a native binary.
