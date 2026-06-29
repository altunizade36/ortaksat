import { supabase } from "@/lib/supabase";
import { districtsOfProvince, provinces, type District, type Province } from "@/lib/locations";

/**
 * Konum servis köprüsü. Supabase ayarlıysa il/ilçe/mahalle API'den çekilir ve
 * öneriler DB'ye yazılır; değilse uygulama paketteki il/ilçe verisiyle çalışır.
 */

export async function fetchProvinces(): Promise<Province[]> {
  if (!supabase) return provinces;
  const { data, error } = await supabase.from("provinces").select("id,name,slug").eq("is_active", true).order("name");
  if (error || !data) return provinces;
  return data as Province[];
}

export async function fetchDistricts(provinceId: number): Promise<District[]> {
  if (!supabase) return districtsOfProvince(provinceId);
  const { data, error } = await supabase.from("districts").select("id,province_id,name,slug").eq("province_id", provinceId).eq("is_active", true).order("name");
  if (error || !data) return districtsOfProvince(provinceId);
  return data as District[];
}

export type Neighborhood = { id: number; provinceId: number; districtId: number; name: string; slug: string };

export async function fetchNeighborhoods(districtId: number): Promise<Neighborhood[]> {
  if (!supabase) return [];
  const { data, error } = await supabase.from("neighborhoods").select("id,province_id,district_id,name,slug").eq("district_id", districtId).eq("is_active", true).order("name");
  if (error || !data) return [];
  return data.map((d: { id: number; province_id: number; district_id: number; name: string; slug: string }) => ({ id: d.id, provinceId: d.province_id, districtId: d.district_id, name: d.name, slug: d.slug }));
}

/** Eksik mahalle/ilçe önerisi — Supabase varsa DB'ye yazar. */
export async function submitLocationSuggestionLive(input: { provinceId?: number; districtId?: number; suggestedName: string; type?: string; note?: string }): Promise<boolean> {
  if (!supabase) return false;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { error } = await supabase.from("location_suggestions").insert({
    user_id: auth.user.id,
    province_id: input.provinceId ?? null,
    district_id: input.districtId ?? null,
    suggested_name: input.suggestedName,
    type: input.type ?? "neighborhood",
    note: input.note ?? null
  });
  return !error;
}

/** Eksik kategori önerisi — Supabase varsa DB'ye yazar. */
export async function submitCategorySuggestionLive(input: { listingId?: string; suggestedPath: string; note?: string }): Promise<boolean> {
  if (!supabase) return false;
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return false;
  const { error } = await supabase.from("category_suggestions").insert({
    user_id: auth.user.id,
    listing_id: input.listingId ?? null,
    suggested_path: input.suggestedPath,
    note: input.note ?? null
  });
  return !error;
}
