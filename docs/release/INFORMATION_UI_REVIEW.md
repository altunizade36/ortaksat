# Information and opportunity screens — 24 October 2026

Shared layouts now cover About, Help, Contact and legal documents, including published CMS content. Contact uses the supplied OrtakSat brand and support email only; it validates a local draft and opens the user's email app, without claiming that a message was sent. Support tickets remain available.

Legal documents retain the full default text and add search, section selection, reading estimates and related links. Formal data-controller identity has not been supplied and remains an owner/legal-review item; complete legal compliance is not asserted. Application timing and fees were checked against [KVKK legislation](https://www.aile.gov.tr/kvkk/mevzuat/); identity requirements against the [authority's guidance](https://www.kvkk.gov.tr/Icerik/2033/Aydinlatma-Yukumlulugu-).

Notifications share a role-aware target resolver across web and mobile. Missing or private conversation IDs cannot open another user's chat. Untargeted notifications display full details. Opportunity pagination retains cards after failure and retries the same offset; advanced management remains available.

The compact footer is full width, 148px high and does not grow. Short pages push it to the bottom; long pages scroll to it. Eight main routes at 320/390px and seven information/notification pages were checked against the bottom-navigation boundary.

Passed checks: TypeScript, notification target tests, information UI tests, footer boundary tests, partnership filtering/approval and pagination recovery tests. UI application data is mocked; no email was sent and no live listing was published. Results are under `audit/mobile-v4`.

These changes are local and have not been released to production.

The preceding location work is also included: shared province/district/neighborhood fields for create/edit on web and mobile, Turkish search, dependent-field reset, retry/manual neighborhood entry, visibility preview, and preserved neighborhood ID/name. Packaged data relationships were checked for 81 provinces and 973 districts. The screen does not collect an exact street/door address without a linked private-address persistence flow.

The production-style web check covers seven information/opportunity routes at 320, 390 and 1440px. A hydration defect that initially rendered a zero-width footer was found and fixed by deferring explicit viewport width until mount. See `audit/web-review/information-ui-results.json`.
