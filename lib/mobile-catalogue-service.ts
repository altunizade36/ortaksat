import { supabase } from "@/lib/supabase";
import { mapListing } from "@/lib/supabase-data";
import { categoryLabels } from "@/lib/mobile-catalog";
import type { CategoryNode } from "@/lib/category-tree";
import type { MobileFilters } from "@/lib/mobile-filters";
import type { Listing } from "@/lib/types";

export async function fetchMobileCatalogue({ trail, filters, query = "", sort = "recommended", offset = 0, limit = 24 }: {
  trail: CategoryNode[]; filters: MobileFilters; query?: string; sort?: string; offset?: number; limit?: number;
}): Promise<{ listings: Listing[]; total: number }> {
  if (!supabase) throw new Error("Supabase is not configured");
  const node = trail[trail.length - 1];
  const { data, error } = await supabase.rpc("mobile_catalogue_page", { params: {
    root: trail[0]?.label ?? "", rootOnly: trail.length === 1,
    labels: node ? categoryLabels(node) : [], forms: subtreeFormKeys(trail), filters, q: query.trim(), sort, offset, limit,
  } });
  if (error) throw error;
  if (!data || !Array.isArray(data.listings) || !Number.isFinite(data.total)) throw new Error("Invalid catalogue response");
  return { listings: data.listings.map(mapListing), total: data.total };
}

// Aynı etiket (ör. bir marka adı) kök içinde birden çok dalda geçebilir; sunucu ilanın
// form şemasını bu listeyle sınayarak yanlış dala düşen ilanları eler.
function subtreeFormKeys(trail: CategoryNode[]): string[] {
  const node = trail[trail.length - 1];
  if (!node) return [];
  const keys = new Set<string>();
  const walk = (n: CategoryNode) => { if (n.formKey) keys.add(n.formKey as string); n.children?.forEach(walk); };
  walk(node);
  if (!keys.size) for (let i = trail.length - 1; i >= 0; i--) if (trail[i].formKey) { keys.add(trail[i].formKey as string); break; }
  return [...keys];
}
