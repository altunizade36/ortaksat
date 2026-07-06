// Second-pass localization dictionary: Turkish -> English pairs newly wrapped
// with translateCopy() during the second i18n cleanup sweep. Keys are the exact
// Turkish source strings; keys are deduplicated.
export const pass2Dict: Record<string, string> = {
  // app/(tabs)/partner.tsx — mobile-branch MiniBarChart (does not auto-wrap)
  "Son 14 gün · getirdiğin talep": "Last 14 days · leads you brought",
  "talep": "leads",

  // app/notifications.tsx — accessibilityLabel fragments
  "ilana git": "go to listing",
  "bildirimleri": "notifications",
  "aç": "open"
};
