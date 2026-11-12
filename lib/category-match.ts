import { categoryTree, type CategoryNode } from "@/lib/category-tree";
import { searchKey } from "@/lib/locale";
import type { Listing } from "@/lib/types";

type ListingRef = Pick<Listing, "category" | "attributes">;

let index: Map<string, CategoryNode[][]> | null = null;
let rootKeys: Set<string> | null = null;
const staticNodes = new WeakSet<CategoryNode>();
const labelSets = new WeakMap<CategoryNode, Set<string>>();

function build() {
  const map = new Map<string, CategoryNode[][]>();
  const walk = (nodes: CategoryNode[], trail: CategoryNode[]) => {
    for (const node of nodes) {
      const next = [...trail, node];
      staticNodes.add(node);
      const key = searchKey(node.label);
      const list = map.get(key);
      if (list) list.push(next);
      else map.set(key, [next]);
      if (node.children) walk(node.children, next);
    }
  };
  walk(categoryTree, []);
  index = map;
  rootKeys = new Set(categoryTree.map((n) => searchKey(n.label)));
}

function formKeyOf(trail: CategoryNode[]): string | undefined {
  for (let i = trail.length - 1; i >= 0; i--) if (trail[i].formKey) return trail[i].formKey as string;
  return undefined;
}

const trailCache = new Map<string, CategoryNode[]>();

/**
 * İlanın ağaçtaki TEK konumu (kökten yaprağa). Aynı etiket birden çok dalda geçebildiği için
 * (marka adları, "Fayans & Seramik", "Diğer"…) yalnız etikete bakmak ilanı yanlış kategorilerde
 * de sayıyordu. Sıra: kayıtlı kök → form şeması → marka → en sığ yol. Kayıtlı kök artık ağaçta
 * yoksa (eski, birleştirilmiş kök) yok sayılır; ilan yeni konumunda bulunur.
 */
export function listingCategoryPath(listing: ListingRef): CategoryNode[] {
  if (!index || !rootKeys) build();
  const attrs = listing.attributes ?? {};
  const leaf = searchKey(String(attrs._leaf || listing.category || ""));
  const root = searchKey(String(attrs._root || ""));
  const form = String(attrs._formKey || "");
  const brand = searchKey(String(attrs.brand || attrs.compatBrand || ""));
  const cacheKey = `${leaf}|${root}|${form}|${brand}`;
  const cached = trailCache.get(cacheKey);
  if (cached) return cached;

  let candidates = index!.get(leaf) ?? [];
  if (!candidates.length && listing.category) {
    for (const part of listing.category.split(/\s*[>/|·]\s*/).reverse()) {
      candidates = index!.get(searchKey(part)) ?? [];
      if (candidates.length) break;
    }
  }
  const narrow = (test: (trail: CategoryNode[]) => boolean) => {
    if (candidates.length < 2) return;
    const kept = candidates.filter(test);
    if (kept.length) candidates = kept;
  };
  if (root && rootKeys!.has(root)) narrow((trail) => searchKey(trail[0].label) === root);
  if (form) narrow((trail) => formKeyOf(trail) === form);
  if (brand) narrow((trail) => trail.some((n) => searchKey(n.label) === brand));
  const result = candidates.slice().sort((a, b) => a.length - b.length)[0] ?? [];
  trailCache.set(cacheKey, result);
  return result;
}

function labelSetOf(node: CategoryNode): Set<string> {
  let set = labelSets.get(node);
  if (!set) {
    set = new Set<string>();
    const walk = (n: CategoryNode) => { set!.add(searchKey(n.label)); n.children?.forEach(walk); };
    walk(node);
    labelSets.set(node, set);
  }
  return set;
}

/**
 * İlan bu düğümün (kendisi ya da alt dalı) içinde mi? Kod ağacındaki düğümler KİMLİKLE
 * karşılaştırılır; ağaçta konumu bulunamayan ilan ya da yönetici-eklentisi kategori için
 * tam etiket eşleşmesine düşülür.
 */
export function listingInCategoryNode(listing: ListingRef, node: CategoryNode): boolean {
  const path = listingCategoryPath(listing);
  if (path.length && staticNodes.has(node)) return path.includes(node);
  const labels = labelSetOf(node);
  const leaf = searchKey(String(listing.attributes?._leaf || listing.category || ""));
  return labels.has(leaf) || listing.category.split(/\s*[>/|·]\s*/).some((part) => labels.has(searchKey(part)));
}

/** İlanın kök kategorisi (yoksa undefined). */
export function listingRootNode(listing: ListingRef): CategoryNode | undefined {
  return listingCategoryPath(listing)[0];
}
