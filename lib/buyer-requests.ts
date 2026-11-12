import { supabase } from "./supabase";
import { categoryTrail } from "./mobile-catalog";
import { emptyMobileFilters } from "./mobile-filters";
import { fetchMobileCatalogue } from "./mobile-catalogue-service";
import type { CategoryNode } from "./category-tree";

export type BuyerRequest = {
  id: string; user_id: string; title: string; description: string; category_trail: string[];
  budget_min: number; budget_max: number; currency: "TRY" | "USD" | "EUR";
  province_id: number | null; district_id: number | null; allow_partners: boolean;
  status: "active" | "closed"; expires_at: string; created_at: string; updated_at: string;
};
export type BuyerOffer = { id: string; request_id: string; seller_id: string; listing_id: string; note: string; status: "pending" | "accepted" | "rejected"; created_at: string };
export async function loadBuyerRequests({ mine, search = "", provinceId, offset = 0 }: { mine?: string; search?: string; provinceId?: number; offset?: number }) {
  if (!supabase) throw Error("Service unavailable");
  let query = supabase.from("buyer_requests").select("*", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + 23);
  if (mine) query = query.eq("user_id", mine);
  else query = query.eq("status", "active").gt("expires_at", new Date().toISOString());
  if (provinceId) query = query.eq("province_id", provinceId);
  if (search.trim()) query = query.ilike("title", `%${search.trim().replace(/[\\%_]/g, c => `\\${c}`)}%`);
  const { data, count, error } = await query;
  if (error) throw error;
  return { rows: (data || []) as BuyerRequest[], total: count || 0 };
}
export async function loadBuyerRequest(id: string) {
  if (!supabase) throw Error("Service unavailable");
  const { data, error } = await supabase.from("buyer_requests").select("*").eq("id", id).single();
  if (error || !data) throw error || Error("Request unavailable");
  return data as BuyerRequest;
}
export async function saveBuyerRequest(row: Omit<BuyerRequest, "created_at" | "updated_at">, editing: boolean) {
  if (!supabase) throw Error("Service unavailable");
  let { data, error } = editing
    ? await supabase.from("buyer_requests").update(row).eq("id", row.id).eq("user_id", row.user_id).select("id").single()
    : await supabase.from("buyer_requests").insert(row).select("id").single();
  if (!editing && error?.code === "23505") ({data,error}=await supabase.from("buyer_requests").update(row).eq("id",row.id).eq("user_id",row.user_id).select("id").single());
  if (error || !data) throw error || Error("Request not saved");
}
export function requestTrail(tree: CategoryNode[], labels: string[]) {
  let nodes = tree; const path: CategoryNode[] = [];
  for (const label of labels) { const node = nodes.find(n => n.label === label); if (!node) return []; path.push(node); nodes = node.children || []; }
  return path.length ? categoryTrail(tree, path[path.length - 1].slug) : [];
}
export async function matchBuyerRequest(request: BuyerRequest, tree: CategoryNode[], offset = 0) {
  const trail = requestTrail(tree, request.category_trail);
  if (!trail.length) throw Error("Category unavailable");
  const filters = { ...emptyMobileFilters(), min: String(request.budget_min), max: String(request.budget_max), currency: request.currency, excludeOwner: request.user_id, loc: { provinceId: request.province_id || undefined, districtId: request.district_id || undefined } };
  return fetchMobileCatalogue({ trail, filters, sort: "newest", offset });
}
export async function loadBuyerOffers(id: string) {
  if (!supabase) throw Error("Service unavailable");
  const { data, error } = await supabase.from("buyer_request_offers").select("*").eq("request_id", id).order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as BuyerOffer[];
}
export async function sendBuyerOffer(row: Pick<BuyerOffer, "id" | "request_id" | "seller_id" | "listing_id" | "note">) {
  if (!supabase) throw Error("Service unavailable");
  const { error } = await supabase.from("buyer_request_offers").insert(row);
  if (error && error.code !== "23505") throw error;
  if (error) {
    const { data, error: lookupError } = await supabase.from("buyer_request_offers").select("id").eq("request_id", row.request_id).eq("listing_id", row.listing_id).eq("seller_id", row.seller_id).maybeSingle();
    if (lookupError || !data) throw error;
  }
}
export async function decideBuyerOffer(id: string, status: "accepted" | "rejected") {
  if (!supabase) throw Error("Service unavailable");
  const { data, error } = await supabase.from("buyer_request_offers").update({ status }).eq("id", id).eq("status", "pending").select("id").single();
  if (error || !data) throw error || Error("Offer not updated");
}
