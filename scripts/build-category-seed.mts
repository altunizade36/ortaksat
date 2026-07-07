/**
 * category_seed.json üreteci.
 *
 * Kaynaklar:
 * - Türkçe dikey taksonomi (emlak/vasıta/iş/hizmet/yedek parça/ürün) →
 *   lib/category-tree.ts (sahibinden/arabam/hepsiemlak/armut/kariyer.net
 *   ilan mantığından türetilmiş, form şemalarıyla).
 * - Google Product Taxonomy (TR, id'li) → data/taxonomy/google-tr.txt
 *   (ürün kategorilerine google_product_category_id eşlenir).
 *
 * Çıktı: data/category_seed.json — düz (flat) satırlar; her satır DB'ye
 * (public.categories) yüklenmeye hazır: path, parent_path, kind, form_schema_key,
 * google eşleşmesi, attributes.
 *
 * Çalıştır: npx tsx scripts/build-category-seed.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { categoryTree, getFormSchema, type CategoryNode } from "../lib/category-tree.ts";

// --- Google taksonomi lookup ------------------------------------------------
const gtxt = readFileSync("data/taxonomy/google-tr.txt", "utf8");
function norm(s: string): string {
  return s.toLocaleLowerCase("tr-TR").replace(/&/g, "ve").replace(/[^a-zçğıöşü0-9]+/g, " ").trim();
}
// Türkçe çoğul/iyelik eklerini kabaca at (eşleştirme için; mükemmel değil).
function stem(w: string): string {
  return w.replace(/(lari|leri|lar|ler|ları|leri|si|sı|su|sü|i|ı|u|ü)$/u, "").replace(/\s+/g, " ").trim();
}
function stemPhrase(s: string): string {
  return norm(s).split(" ").map(stem).filter((x) => x.length > 1).join(" ");
}
// Google'daki HER segmenti (yaprak değil, her düğüm) indeksle: stem → {id, path, depth}.
const googleIdx = new Map<string, { id: number; path: string; depth: number }>();
for (const line of gtxt.split(/\r?\n/)) {
  if (!line || line.startsWith("#")) continue;
  const m = line.match(/^(\d+)\s+-\s+(.+)$/);
  if (!m) continue;
  const id = Number(m[1]);
  const path = m[2].trim();
  const segs = path.split(" > ");
  const leaf = segs[segs.length - 1];
  const key = stemPhrase(leaf);
  const depth = segs.length;
  const prev = googleIdx.get(key);
  // Aynı ada birden çok kategori olabilir; daha derin (spesifik) olanı tercih et.
  if (key && (!prev || depth > prev.depth)) googleIdx.set(key, { id, path, depth });
}

function matchGoogle(label: string, ancestors: string[]): { id: number; path: string } | null {
  const cand = [
    stemPhrase([...ancestors.slice(-1), label].join(" ")), // parent+label
    stemPhrase(label)                                       // sadece label
  ];
  for (const c of cand) {
    if (c && googleIdx.has(c)) { const g = googleIdx.get(c)!; return { id: g.id, path: g.path }; }
  }
  // contains: label kökü bir google anahtarında geçiyorsa (kısa değilse)
  const ls = stemPhrase(label);
  if (ls.length >= 4) {
    for (const [k, g] of googleIdx) {
      if (k === ls || k.endsWith(" " + ls) || k.startsWith(ls + " ")) return { id: g.id, path: g.path };
    }
  }
  return null;
}

// --- kind (üst kategoriye göre) ---------------------------------------------
const KIND: Record<string, string> = {
  "Emlak": "realestate",
  "Vasıta": "vehicle",
  "Yedek Parça, Aksesuar & Tuning": "part",
  "İkinci El & Sıfır Alışveriş": "product",
  "İş Makineleri & Sanayi": "industrial",
  "Ustalar & Hizmetler": "service",
  "Özel Ders & Eğitim": "service",
  "İş İlanları": "job",
  "Yardımcı Arayanlar": "job",
  "Hayvanlar Alemi": "pet",
  "Arayanlar / Talep İlanları": "request",
  "Dijital Ürünler & Hizmetler": "digital",
  "Yapı Market & Bahçe": "product",
  "Müzik Enstrümanları": "product",
  "Sağlık & Medikal": "product",
  "Diğer": "other"
};
// Google eşleşmesi yalnız ürün-benzeri türlerde denenir.
const PRODUCTY = new Set(["product", "part", "pet", "digital", "industrial"]);

type Row = {
  path: string;
  parent_path: string | null;
  slug: string;
  name: string;
  full_name: string;
  level: number;
  sort_order: number;
  kind: string;
  is_leaf: boolean;
  form_schema_key: string | null;
  google_product_category_id: number | null;
  google_product_category: string | null;
  attributes: unknown[];
};

const rows: Row[] = [];
const schemaEmitted = new Set<string>();

function walk(node: CategoryNode, parents: CategoryNode[], rootKind: string, order: number) {
  const ancestors = parents.map((p) => p.label);
  const slugParents = parents.map((p) => p.slug);
  const path = [...slugParents, node.slug].join("/");
  const parent_path = slugParents.length ? slugParents.join("/") : null;
  const isLeaf = !node.children || node.children.length === 0;
  const g = PRODUCTY.has(rootKind) ? matchGoogle(node.label, ancestors) : null;
  // Form alanlarını yalnız bir kez (şema başına) attributes'a koy — şişmesin.
  let attributes: unknown[] = [];
  if (node.formKey && !schemaEmitted.has(node.formKey)) {
    // Bu satır bu şemanın "temsilcisi"; alanları buraya gömülür.
    // (DB'de form_schema_key ile eşleşen tüm kategoriler aynı alanları paylaşır.)
  }
  rows.push({
    path,
    parent_path,
    slug: node.slug,
    name: node.label,
    full_name: [...ancestors, node.label].join(" > "),
    level: parents.length,
    sort_order: order,
    kind: rootKind,
    is_leaf: isLeaf,
    form_schema_key: node.formKey ?? null,
    google_product_category_id: g?.id ?? null,
    google_product_category: g?.path ?? null,
    attributes
  });
  node.children?.forEach((c, i) => walk(c, [...parents, node], rootKind, i));
}

categoryTree.forEach((top, i) => {
  const kind = KIND[top.label] ?? "product";
  walk(top, [], kind, i);
});

// Form şemalarını ayrı bir sözlüğe çıkar (kategori satırları form_schema_key ile bağlanır).
const usedKeys = [...new Set(rows.map((r) => r.form_schema_key).filter(Boolean))] as string[];
const schemas: Record<string, unknown> = {};
for (const k of usedKeys) {
  const s = getFormSchema(k);
  schemas[k] = { key: s.key, title: s.title, fields: s.fields };
}

const out = {
  meta: {
    generated_from: ["lib/category-tree.ts", "Google Product Taxonomy 2021-09 (tr-TR)"],
    total_categories: rows.length,
    top_categories: categoryTree.length,
    google_mapped: rows.filter((r) => r.google_product_category_id).length,
    form_schemas: usedKeys.length
  },
  categories: rows,
  form_schemas: schemas
};
writeFileSync("data/category_seed.json", JSON.stringify(out, null, 2), "utf8");
console.log(`category_seed.json yazıldı: ${rows.length} kategori, ${out.meta.google_mapped} Google eşleşmeli, ${usedKeys.length} form şeması`);
// Kind dağılımı
const byKind: Record<string, number> = {};
for (const r of rows) byKind[r.kind] = (byKind[r.kind] ?? 0) + 1;
console.log("kind dağılımı:", JSON.stringify(byKind));
