/** Kategori ağacı denetimi: düğüm başına çocuk sayısı + "Diğer" seçeneği var mı? */
import { categoryTree, type CategoryNode } from "../lib/category-tree";

type Row = { path: string; depth: number; children: number; hasDiger: boolean; isLeaf: boolean };
const rows: Row[] = [];

function walk(n: CategoryNode, trail: string[]) {
  const path = [...trail, n.label];
  const kids = n.children ?? [];
  const hasDiger = kids.some((c) => /^diğer/i.test(c.label.trim()));
  rows.push({ path: path.join(" › "), depth: path.length, children: kids.length, hasDiger, isLeaf: kids.length === 0 });
  kids.forEach((c) => walk(c, path));
}
categoryTree.forEach((t) => walk(t, []));

const parents = rows.filter((r) => !r.isLeaf);
const leaves = rows.filter((r) => r.isLeaf);
const missingDiger = parents.filter((r) => !r.hasDiger);

console.log(`TOPLAM DÜĞÜM: ${rows.length} | EBEVEYN: ${parents.length} | YAPRAK: ${leaves.length}`);
console.log(`"Diğer" EKSİK EBEVEYN: ${missingDiger.length} / ${parents.length} (%${((missingDiger.length / parents.length) * 100).toFixed(1)})\n`);

// Üst kategori bazında yaprak sayısı (zayıflar)
console.log("=== ÜST KATEGORİ BAZINDA (toplam yaprak) ===");
categoryTree.forEach((t) => {
  let count = 0;
  const c = (n: CategoryNode) => { const k = n.children ?? []; if (!k.length) count++; else k.forEach(c); };
  c(t);
  const flag = count < 60 ? "!!" : "ok";
  console.log(`${flag} ${t.label.padEnd(38)} ${String(count).padStart(5)} yaprak  ${String((t.children ?? []).length).padStart(3)} alt-dal`);
});

// 2. seviye düğümler: kaç çocuğu var (zayıf dallar)
console.log("\n=== ZAYIF DALLAR (çocuk sayısı < 15, ebeveyn) ===");
const weak = parents.filter((r) => r.children < 15).sort((a, b) => a.children - b.children);
console.log(`toplam zayıf dal: ${weak.length}`);
weak.slice(0, 40).forEach((r) => console.log(`   ${String(r.children).padStart(3)} çocuk · ${r.path}`));

console.log(`\n=== "Diğer" EKSİK OLAN İLK 25 DAL ===`);
missingDiger.slice(0, 25).forEach((r) => console.log(`   ${r.path} (${r.children} çocuk)`));
