import { emptyMobileFilters, type MobileFilters } from "./mobile-filters";
import { getDistrict, getProvince, provinces } from "./locations";
import { searchKey } from "./locale";

type RecordValue = Record<string, unknown>;
const record = (value: unknown): RecordValue => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
const safeKey = (key: string) => !["__proto__", "prototype", "constructor"].includes(key);
// NOT: aralıklar her zaman { min, max } SIRASIYLA yazılır — katalog isteği anahtarı JSON.stringify ile
// üretildiği için farklı anahtar sırası aynı ölçütü iki ayrı istek sayardı (bkz. mobile/catalogue.tsx).
const sorts: Record<string, string> = { recommended: "recommended", newest: "newest", new: "newest", priceAsc: "priceAsc", priceDesc: "priceDesc", commission: "commission" };

/** Saved links and synced records can be older or malformed; restore only supported criteria. */
export function restoreMobileSearch(raw?: string): { filters: MobileFilters; category: string; sort: string } {
  const filters = emptyMobileFilters();
  let saved: RecordValue = {};
  try { saved = record(JSON.parse(typeof raw === "string" ? raw : "{}")); } catch { /* invalid saved link */ }
  const mobile = saved.mobile;
  if (mobile && typeof mobile === "object" && !Array.isArray(mobile)) {
    const source = record(mobile);
    for (const key of ["min", "max"] as const) if (typeof source[key] === "string") filters[key] = source[key];
    for (const key of ["open", "photos", "urgent", "warranty", "owner", "exchange"] as const) filters[key] = source[key] === true;
    if (typeof source.currency === "string" && ["TRY", "USD", "EUR"].includes(source.currency)) filters.currency = source.currency as MobileFilters["currency"];
    const loc = record(source.loc);
    const province = Number.isInteger(loc.provinceId) ? getProvince(loc.provinceId as number) : undefined;
    const district = Number.isInteger(loc.districtId) ? getDistrict(loc.districtId as number) : undefined;
    if (province) {
      filters.loc.provinceId = province.id;
      if (district?.provinceId === province.id) filters.loc.districtId = district.id;
    }
    for (const [key, value] of Object.entries(record(source.attrs))) {
      if (safeKey(key) && (typeof value === "string" || Array.isArray(value) && value.every(v => typeof v === "string"))) filters.attrs[key] = Array.isArray(value) ? [...value] : value;
    }
    for (const [key, value] of Object.entries(record(source.ranges))) {
      const range = record(value);
      if (safeKey(key) && typeof range.min === "string" && typeof range.max === "string") filters.ranges[key] = { min: range.min, max: range.max };
    }
    for (const [key, value] of Object.entries(record(source.texts))) if (safeKey(key) && typeof value === "string") filters.texts[key] = value;
  } else {
    if (typeof saved.price === "string") { const [min, max] = saved.price.split("-"); filters.min = min || ""; filters.max = max || ""; }
    filters.open = saved.open === true;
    if (typeof saved.city === "string") filters.loc.provinceId = provinces.find(p => searchKey(p.name) === searchKey(saved.city as string))?.id;
    for (const [key, value] of Object.entries(record(saved.attr))) if (safeKey(key) && Array.isArray(value) && value.every(v => typeof v === "string")) filters.attrs[key] = [...value];
    for (const [key, value] of Object.entries(record(saved.num))) {
      const range = record(value);
      if (safeKey(key) && typeof range.min === "string" && typeof range.max === "string") filters.ranges[key] = { min: range.min, max: range.max };
    }
  }
  // excludeOwner is a live flow/account constraint, not a portable saved preference.
  return { filters, category: typeof saved.cat === "string" ? saved.cat : "", sort: typeof saved.sort === "string" && Object.hasOwn(sorts, saved.sort) ? sorts[saved.sort] : "recommended" };
}
