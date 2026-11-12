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

// Her karo, ağaçtaki TEK bir düğüme `slug` ile bağlanır (slug'lar ağaçta benzersizdir). Eskiden yalnız
// etiket önekiyle aranıyordu: "Oyun" → "Oyuncak"a, "Hobi" → "Hobi & El Sanatları"na düşüyordu. Karo adı,
// açtığı düğümün ilanlarını anlatır ("Spor & Outdoor", "Sağlık & Medikal"); `match` yalnız durum anahtarıdır.
//
// ELEKTRONİK: ağaçta telefon + bilgisayar + elektroniği birlikte kapsayan TEK düğüm yok — üçü "İkinci El &
// Sıfır Alışveriş" kökünün kardeş dallarıdır (Elektronik = TV/tablet/ses/kamera…, Telefon & Aksesuar,
// Bilgisayar & Oyun) ve o kökün zaten kendi karosu var; sunucu kataloğu da tek düğüm süzer (`node`).
// Bu yüzden karo adıyla birebir aynı düğümü ("Elektronik") açar, kardeş dallar `related` ile bağlanır:
// listede "İlgili kategoriler" çipleri olarak tek dokunuşta açılır ve aynı karo görselini (telefon + dizüstü) kullanır.
export const mobileCategories: { label: string; match: string; slug: string; tile: number; related?: string[] }[] = [
  { label: "Emlak", match: "Emlak", slug: "emlak", tile: 0 }, { label: "Vasıta", match: "Vasıta", slug: "vasita", tile: 1 },
  { label: "Elektronik", match: "Elektronik", slug: "elektronik", tile: 2, related: ["telefon-ve-aksesuar", "bilgisayar-ve-oyun"] }, { label: "Ev & Yaşam", match: "Ev", slug: "ev-ve-yasam", tile: 3 },
  { label: "İkinci El & Sıfır Alışveriş", match: "İkinci El", slug: "ikinci-el-ve-sifir-alisveris", tile: 4 }, { label: "İş Makineleri & Sanayi", match: "İş Makineleri", slug: "is-makineleri-ve-sanayi", tile: 5 },
  { label: "Ustalar & Hizmetler", match: "Ustalar", slug: "ustalar-ve-hizmetler", tile: 6 }, { label: "Özel Ders & Eğitim", match: "Özel Ders", slug: "ozel-ders-ve-egitim", tile: 7 },
  { label: "Spor & Outdoor", match: "Spor", slug: "spor-ve-outdoor", tile: 8 }, { label: "Moda & Aksesuar", match: "Moda", slug: "moda", tile: 9 },
  { label: "İş İlanları", match: "İş İlanları", slug: "is-ilanlari", tile: 10 }, { label: "Hayvanlar", match: "Hayvan", slug: "hayvanlar-alemi", tile: 11 },
  { label: "Yedek Parça & Aksesuar", match: "Yedek Parça", slug: "yedek-parca-aksesuar-donanim-ve-tuning", tile: 12 }, { label: "Oyun & Konsol", match: "Oyun & Konsol", slug: "oyun-ve-konsol", tile: 13 },
  { label: "Sağlık & Medikal", match: "Sağlık", slug: "saglik-ve-medikal", tile: 14 }, { label: "Tüm Kategoriler", match: "all", slug: "", tile: 15 },
];
/** Bir kategori yolunun karo görseli: yolun EN DERİN karo düğümü (yoksa "tüm kategoriler" karosu). */
export function categoryTile(trail: CategoryNode[]): number {
  for (let i = trail.length - 1; i >= 0; i--) {
    const tile = mobileCategories.find(c => c.slug && c.slug === trail[i].slug) ?? mobileCategories.find(c => c.related?.includes(trail[i].slug));
    if (tile) return tile.tile;
  }
  return 15;
}
/** Aynı karo grubundaki DİĞER dallar (Elektronik ↔ Telefon & Aksesuar ↔ Bilgisayar & Oyun); grup dışı düğümde boş. */
export function relatedCategories(nodes: CategoryNode[], slug: string): CategoryNode[] {
  const group = mobileCategories.map(c => [c.slug, ...(c.related ?? [])]).find(g => g.length > 1 && g.includes(slug));
  if (!group) return [];
  return group.filter(s => s !== slug).map(s => { const trail = categoryTrail(nodes, s); return trail[trail.length - 1]; }).filter((n): n is CategoryNode => !!n);
}
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
  // Karo anahtarları önce benzersiz slug ile çözülür; önek araması yalnız yedek yoldur.
  const tileSlug = mobileCategories.find(c => c.match === prefix)?.slug;
  if (tileSlug) {
    const exact = categoryTrail(nodes, tileSlug);
    if (exact.length) return exact[exact.length - 1];
  }
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
