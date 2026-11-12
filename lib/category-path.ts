import { resolveFormKey, suggestCategories, type CategoryNode } from "./category-tree";
import { searchKey } from "./locale";

// NOT: bu dosya lib/category-match.ts'i İÇE AKTARMAZ (category-match, savedCategoryPath'i
// buradan alabilsin diye — döngüsel bağımlılık olmasın).

/** Restore identifiers against the current tree; cached children/form keys are never trusted. */
export function resolveCategoryPath(tree: CategoryNode[], saved: unknown): CategoryNode[] {
  if (!Array.isArray(saved)) return [];
  const path: CategoryNode[] = [];
  let level = tree;
  for (const entry of saved) {
    if (!entry || typeof entry !== "object") break;
    const item = entry as { key?: unknown; slug?: unknown };
    const node = level.find(n => typeof item.key === "string" && n.key === item.key)
      ?? level.find(n => typeof item.slug === "string" && n.slug === item.slug);
    if (!node) break;
    path.push(node); level = node.children ?? [];
  }
  return path;
}

/** Yol bir YAPRAKTA mı bitiyor (altında seçilecek başka kategori yok)? */
export function isLeafCategoryPath(path: CategoryNode[]): boolean {
  const last = path[path.length - 1];
  return !!last && !(last.children && last.children.length);
}

/**
 * İlanın kategori meta alanları — TEK kaynak (oluşturma, düzenleme, toplu yükleme aynısını yazar).
 * `_path` kökten yaprağa slug dizisidir: aynı etiket (Satılık, Diğer, model adları…) aynı kök +
 * aynı form şeması altında defalarca geçtiği için `_root` + `_leaf` + `_formKey` yolu TEK başına
 * belirleyemiyor (6821 yaprağın 1295'i yanlış dala çözülüyordu). Slug'lar ağaçta benzersizdir.
 */
export function categoryPathAttributes(path: CategoryNode[]): { _root: string; _leaf: string; _formKey: string; _path: string[] } {
  return {
    _root: path[0]?.label ?? "",
    _leaf: path[path.length - 1]?.label ?? "",
    _formKey: resolveFormKey(path),
    _path: path.map((n) => n.slug)
  };
}

type CategoryRef = { category?: string | null; attributes?: Record<string, unknown> | null };

/**
 * Kayıtlı `attributes._path`'i ağaçta çözer. Yalnız TAMAMI çözülürse ve kayıtlı `_leaf` / `_root`
 * ile tutarlıysa döner (eski bir istemci ya da başka bir akış `_leaf`'i değiştirip `_path`'i
 * bayat bırakmışsa güvenilmez) — aksi halde null; çağıran etiket-tabanlı çözücüye düşer.
 */
export function savedCategoryPath(tree: CategoryNode[], listing: CategoryRef): CategoryNode[] | null {
  const attrs = listing.attributes ?? {};
  const saved = attrs._path;
  if (!Array.isArray(saved) || !saved.length) return null;
  const path: CategoryNode[] = [];
  let level = tree;
  for (const id of saved) {
    if (typeof id !== "string") return null;
    const node = level.find((n) => n.slug === id) ?? level.find((n) => n.key === id);
    if (!node) return null;
    path.push(node);
    level = node.children ?? [];
  }
  const leaf = searchKey(String(attrs._leaf || listing.category || ""));
  if (leaf && searchKey(path[path.length - 1].label) !== leaf) return null;
  const root = searchKey(String(attrs._root || ""));
  if (root && searchKey(path[0].label) !== root) return null;
  return path;
}

// Her tuşta 7467 etiketi yeniden normalize etmemek için (NFD + regex) düğüm başına önbellek.
const labelKeys = new WeakMap<CategoryNode, string>();

/**
 * Kategori araması (ilan verme seçicileri): önce akıllı öneriler ("araba" → Vasıta › Otomobil,
 * yazım toleransı), ardından ağacın TAMAMINDA etiket eşleşmesi. suggestCategories aynı etiket +
 * aynı formu tek öneriye indirdiği için ikinci geçiş şart: yoksa "Arazi, SUV › Audi › A4" gibi
 * eş-etiketli dallar aramayla hiç seçilemiyordu.
 */
export function searchCategoryTree(tree: CategoryNode[], query: string, limit = 12): CategoryNode[][] {
  const term = searchKey(query.trim());
  if (term.length < 2) return [];
  const out: CategoryNode[][] = [];
  const seen = new Set<CategoryNode>();
  const push = (path: CategoryNode[]) => {
    const last = path[path.length - 1];
    if (!last || seen.has(last)) return;
    seen.add(last);
    out.push(path);
  };
  for (const hit of suggestCategories(query, Math.min(6, limit))) push(hit.path);
  const ranked: Array<{ path: CategoryNode[]; rank: number }> = [];
  const stack: CategoryNode[] = [];
  const walk = (nodes: CategoryNode[]) => {
    for (const node of nodes) {
      stack.push(node);
      let label = labelKeys.get(node);
      if (label === undefined) { label = searchKey(node.label); labelKeys.set(node, label); }
      if (label.includes(term)) ranked.push({ path: stack.slice(), rank: label === term ? 0 : label.startsWith(term) ? 1 : 2 });
      if (node.children) walk(node.children);
      stack.pop();
    }
  };
  walk(tree);
  ranked.sort((a, b) => a.rank - b.rank || a.path.length - b.path.length);
  for (const item of ranked) {
    if (out.length >= limit) break;
    push(item.path);
  }
  return out.slice(0, limit);
}

/**
 * "Emlak > Konut > Satılık" biçimli TAM YOL metnini (toplu yükleme) ağaçta çözer. Yolun SONU
 * verilen parçalarla eşleşmelidir ("Konut > Satılık" da olur). Tek etiket → undefined (çağıran
 * ada göre eşlemeye düşer). Birden çok eşleşmede: kökten tam yol → yaprak → en sığ.
 */
export function matchCategoryLabelPath(tree: CategoryNode[], raw: string): { node: CategoryNode; path: CategoryNode[] } | undefined {
  const parts = raw.split(/\s*[>›»]\s*/).map((part) => searchKey(part)).filter(Boolean);
  if (parts.length < 2) return undefined;
  const hits: CategoryNode[][] = [];
  const walk = (nodes: CategoryNode[], trail: CategoryNode[]) => {
    for (const node of nodes) {
      const path = [...trail, node];
      if (path.length >= parts.length && parts.every((part, i) => searchKey(path[path.length - parts.length + i].label) === part)) hits.push(path);
      if (node.children) walk(node.children, path);
    }
  };
  walk(tree, []);
  if (!hits.length) return undefined;
  const score = (path: CategoryNode[]) => (path.length === parts.length ? 0 : 2) + (isLeafCategoryPath(path) ? 0 : 1);
  hits.sort((a, b) => score(a) - score(b) || a.length - b.length);
  return { node: hits[0][hits[0].length - 1], path: hits[0] };
}
