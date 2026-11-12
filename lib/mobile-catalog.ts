import type { CategoryNode } from "@/lib/category-tree";
import { listingInCategoryNode } from "@/lib/category-match";
import type { Listing } from "@/lib/types";
import { searchKey } from "@/lib/locale";
import { savedCategoryPath } from "@/lib/category-path";

// Labels such as “Diğer Model” occur under several brands. Resolve a saved
// listing using its brand as well, instead of silently choosing the first path.
export function listingCategoryTrail(nodes: CategoryNode[], listing: Pick<Listing, "category" | "attributes">): CategoryNode[] {
  const exact = savedCategoryPath(nodes, listing);
  if (exact) return exact;
  const root = String(listing.attributes?._root || "");
  const leaf = String(listing.attributes?._leaf || listing.category);
  const brand = String(listing.attributes?.brand || listing.attributes?.compatBrand || "");
  const candidates: CategoryNode[][] = [];
  function visit(items: CategoryNode[], trail: CategoryNode[]) {
    for (const node of items) {
      const next = [...trail, node];
      if ([node.slug, node.key, node.label].includes(leaf)) candidates.push(next);
      if (node.children) visit(node.children, next);
    }
  }
  visit(root ? nodes.filter(n => searchKey(n.label) === searchKey(root)) : nodes, []);
  if (brand) {
    const matched = candidates.find(path => path.some(n => searchKey(n.label) === searchKey(brand)));
    if (matched) return matched;
    // A parent category can be saved without a brand-specific branch.
    if (candidates.length > 1) return [];
  }
  return candidates.length === 1 ? candidates[0] : [];
}

export const mobileCategories = [
  { label: "Emlak", match: "Emlak", tile: 0 }, { label: "Vasıta", match: "Vasıta", tile: 1 },
  { label: "Elektronik", match: "Elektronik", tile: 2 }, { label: "Ev & Yaşam", match: "Ev", tile: 3 },
  { label: "İkinci El & Sıfır Alışveriş", match: "İkinci El", tile: 4 }, { label: "İş Makineleri & Sanayi", match: "İş Makineleri", tile: 5 },
  { label: "Ustalar & Hizmetler", match: "Ustalar", tile: 6 }, { label: "Özel Ders & Eğitim", match: "Özel Ders", tile: 7 },
  { label: "Hobi & Spor", match: "Hobi", tile: 8 }, { label: "Moda & Aksesuar", match: "Moda", tile: 9 },
  { label: "İş İlanları", match: "İş İlanları", tile: 10 }, { label: "Hayvanlar", match: "Hayvan", tile: 11 },
  { label: "Yedek Parça & Aksesuar", match: "Yedek Parça", tile: 12 }, { label: "Oyun & Konsol", match: "Oyun", tile: 13 },
  { label: "Sağlık & Güzellik", match: "Sağlık", tile: 14 }, { label: "Tüm Kategoriler", match: "all", tile: 15 },
];
export function categoryTrail(nodes: CategoryNode[], slug: string): CategoryNode[] {
  let queue = nodes.map((node) => [node]);
  while (queue.length) {
    const next: CategoryNode[][] = [];
    for (const trail of queue) {
      const last = trail[trail.length - 1];
      if (last.slug === slug || last.key === slug || last.label === slug) return trail;
      for (const child of last.children ?? []) next.push([...trail, child]);
    }
    queue = next;
  }
  return [];
}
export function searchCategoryPaths(nodes: CategoryNode[], query: string): CategoryNode[][] {
  const term = searchKey(query.trim());
  if (!term) return [];
  const found: CategoryNode[][] = [];
  function visit(items: CategoryNode[], path: CategoryNode[]) {
    for (const node of items) {
      const next = [...path, node];
      if (searchKey(node.label).includes(term)) found.push(next);
      if (node.children) visit(node.children, next);
    }
  }
  visit(nodes, []);
  return found;
}
export function categoryByPrefix(nodes: CategoryNode[], prefix: string): CategoryNode | undefined {
  let layer = nodes;
  while (layer.length) {
    const node = layer.find((n) => searchKey(n.label).startsWith(searchKey(prefix)));
    if (node) return node;
    layer = layer.flatMap((n) => n.children ?? []);
  }
}
export function categoryLabels(node: CategoryNode): string[] { return [node.label, ...(node.children ?? []).flatMap(categoryLabels)]; }
export function inCategory(listing: Listing, trail: CategoryNode[]) {
  if (!trail.length) return true;
  return listingInCategoryNode(listing, trail[trail.length - 1]);
}
