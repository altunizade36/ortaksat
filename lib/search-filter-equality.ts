/** Compare persisted JSON filters independently of object key and selected-value order. */
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, ordered(v)]));
  return value;
}
export function searchFiltersKey(value: unknown): string {
  return JSON.stringify(ordered(value ?? {}));
}
export function sameSearchFilters(a: unknown, b: unknown): boolean {
  return searchFiltersKey(a) === searchFiltersKey(b);
}
