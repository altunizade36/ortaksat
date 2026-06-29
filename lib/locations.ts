import { districts, provinces, type District, type Province } from "@/data/tr-locations";

export type { Province, District };
export { provinces, districts };

const TR_MAP: Record<string, string> = { "ç": "c", "ğ": "g", "ı": "i", "ö": "o", "ş": "s", "ü": "u", "â": "a", "î": "i", "û": "u" };

/** Turkish-aware normalize for search (lowercase, strip diacritics). */
export function locKey(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .split("")
    .map((c) => TR_MAP[c] ?? c)
    .join("")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getProvince(id?: number | null): Province | undefined {
  if (id == null) return undefined;
  return provinces.find((p) => p.id === id);
}

export function getDistrict(id?: number | null): District | undefined {
  if (id == null) return undefined;
  return districts.find((d) => d.id === id);
}

export function districtsOfProvince(provinceId?: number | null): District[] {
  if (provinceId == null) return [];
  return districts.filter((d) => d.provinceId === provinceId).sort((a, b) => a.name.localeCompare(b.name, "tr"));
}

export function searchProvinces(query: string): Province[] {
  const k = locKey(query);
  if (!k) return provinces;
  return provinces.filter((p) => locKey(p.name).includes(k));
}

export function searchDistricts(provinceId: number | null | undefined, query: string): District[] {
  const list = districtsOfProvince(provinceId);
  const k = locKey(query);
  if (!k) return list;
  return list.filter((d) => locKey(d.name).includes(k));
}

/** Human-readable location string at a given visibility level. */
export type AddressVisibility = "city_only" | "district_only" | "neighborhood" | "full_address_private";

export function formatLocation(input: { provinceId?: number | null; districtId?: number | null; neighborhood?: string | null }, visibility: AddressVisibility = "neighborhood"): string {
  const province = getProvince(input.provinceId);
  const district = getDistrict(input.districtId);
  const parts: string[] = [];
  if (province) parts.push(province.name);
  if (visibility !== "city_only" && district) parts.push(district.name);
  if (visibility === "neighborhood" && input.neighborhood?.trim()) parts.push(input.neighborhood.trim());
  return parts.join(" / ");
}

/** Short label for cards: İl / İlçe only. */
export function shortLocation(input: { provinceId?: number | null; districtId?: number | null }): string {
  return formatLocation(input, "district_only");
}

/** Resolve a free-text legacy location string (e.g. "İstanbul") to a province id, for back-compat with mock listings. */
export function resolveProvinceByName(name?: string | null): Province | undefined {
  if (!name) return undefined;
  const k = locKey(name);
  return provinces.find((p) => locKey(p.name) === k) ?? provinces.find((p) => k.includes(locKey(p.name)));
}
