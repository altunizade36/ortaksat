import { districtsOfProvince, locKey, provinces } from "@/lib/locations";

type GeocodedPlace = { region?: string | null; city?: string | null; subregion?: string | null; district?: string | null; isoCountryCode?: string | null };
const key = (text?: string | null) => locKey(text || "").replace(/\b(ili|ilcesi|province|city|district)\b/g, "").replace(/\s+/g, " ").trim();

/** Resolve only known TR locations. A district is always scoped to its province;
 * neighbourhood/street coordinates must never become a guessed public address. */
export function matchGeocodedLocation(place?: GeocodedPlace | null): { provinceId: number; districtId?: number } | undefined {
  if (!place || place.isoCountryCode && place.isoCountryCode.toUpperCase() !== "TR") return;
  const candidates = [place.region, place.city, place.subregion];
  const province = candidates.map(name => provinces.find(p => key(p.name) === key(name))).find(Boolean);
  if (!province) return;
  const districts = districtsOfProvince(province.id);
  const district = [place.subregion, place.city, place.district].map(name => districts.find(d => key(d.name) === key(name))).find(Boolean);
  return { provinceId: province.id, ...(district ? { districtId: district.id } : {}) };
}
