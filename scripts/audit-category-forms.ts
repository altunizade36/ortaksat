/**
 * Kategori → form şeması kapsam denetimi.
 * Her YAPRAK için resolveFormKey() sonucunu ve o formKey'in gerçek bir şemaya
 * karşılık gelip gelmediğini (yoksa generic "alisverisGenel"e düşer) raporlar.
 */
import { categoryTree, resolveFormKey, getFormSchema, type CategoryNode } from "../lib/category-tree";

type Row = { top: string; path: string; formKey: string; generic: boolean; fieldCount: number };

const rows: Row[] = [];

function walk(node: CategoryNode, trail: CategoryNode[], top: string) {
  const path = [...trail, node];
  if (node.children && node.children.length) {
    node.children.forEach((c) => walk(c, path, top));
    return;
  }
  const fk = resolveFormKey(path);
  const schema = getFormSchema(fk);
  const generic = schema.key === "alisverisGenel" && fk !== "alisverisGenel";
  rows.push({
    top,
    path: path.map((p) => p.label).join(" › "),
    formKey: fk || "(YOK)",
    generic: generic || !fk,
    fieldCount: schema.fields.length
  });
}

categoryTree.forEach((t) => walk(t, [], t.label));

const total = rows.length;
const bad = rows.filter((r) => r.generic);
const byTop = new Map<string, { n: number; bad: number }>();
rows.forEach((r) => {
  const e = byTop.get(r.top) ?? { n: 0, bad: 0 };
  e.n++;
  if (r.generic) e.bad++;
  byTop.set(r.top, e);
});

console.log(`TOPLAM YAPRAK: ${total}`);
console.log(`GENERIC FORMA DÜŞEN: ${bad.length} (%${((bad.length / total) * 100).toFixed(1)})\n`);
console.log("ÜST KATEGORİ BAZINDA (generic/toplam):");
[...byTop.entries()]
  .sort((a, b) => b[1].bad - a[1].bad)
  .forEach(([t, e]) => {
    const pct = ((e.bad / e.n) * 100).toFixed(0);
    console.log(`  ${e.bad > 0 ? "!!" : "ok"} ${t.padEnd(38)} ${String(e.bad).padStart(4)}/${String(e.n).padEnd(4)} (%${pct})`);
  });

console.log("\nGENERIC'E DÜŞEN ÖRNEK YOLLAR (ilk 30):");
bad.slice(0, 30).forEach((r) => console.log(`  - ${r.path}   [formKey=${r.formKey}]`));

// Hangi formKey'ler şemasız?
const missing = new Map<string, number>();
bad.forEach((r) => missing.set(r.formKey, (missing.get(r.formKey) ?? 0) + 1));
if (missing.size) {
  console.log("\nŞEMASI OLMAYAN formKey'ler (yaprak sayısı):");
  [...missing.entries()].sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`  ${k.padEnd(28)} ${n}`));
}

// ---- ŞEMA DERİNLİĞİ: hangi kategoriler ZAYIF form alıyor? ----
console.log("\n\n=== ŞEMA DERİNLİĞİ (yaprakların gördüğü alan sayısı) ===");
const perTop = new Map<string, { keys: Map<string, number>; fieldSum: number; n: number; min: number }>();
rows.forEach((r) => {
  const e = perTop.get(r.top) ?? { keys: new Map(), fieldSum: 0, n: 0, min: 999 };
  e.keys.set(r.formKey, (e.keys.get(r.formKey) ?? 0) + 1);
  e.fieldSum += r.fieldCount;
  e.n++;
  e.min = Math.min(e.min, r.fieldCount);
  perTop.set(r.top, e);
});
console.log("üst kategori".padEnd(38) + "yaprak  farklıŞema  ortAlan  enAzAlan");
[...perTop.entries()]
  .sort((a, b) => a[1].fieldSum / a[1].n - b[1].fieldSum / b[1].n)
  .forEach(([t, e]) => {
    const avg = (e.fieldSum / e.n).toFixed(1);
    const weak = Number(avg) < 10;
    console.log(`${weak ? "!!" : "ok"} ${t.padEnd(36)} ${String(e.n).padStart(5)}  ${String(e.keys.size).padStart(8)}  ${String(avg).padStart(7)}  ${String(e.min).padStart(7)}`);
  });

// En çok yaprağı kapsayan formKey'ler (tek şema binlerce yaprağa mı bakıyor?)
const keyCount = new Map<string, { n: number; fields: number }>();
rows.forEach((r) => {
  const e = keyCount.get(r.formKey) ?? { n: 0, fields: r.fieldCount };
  e.n++;
  keyCount.set(r.formKey, e);
});
console.log("\n=== EN ÇOK KULLANILAN ŞEMALAR (yaprak sayısı / alan sayısı) ===");
[...keyCount.entries()]
  .sort((a, b) => b[1].n - a[1].n)
  .slice(0, 14)
  .forEach(([k, e]) => console.log(`  ${e.fields < 10 ? "!!" : "ok"} ${k.padEnd(26)} ${String(e.n).padStart(5)} yaprak  ${String(e.fields).padStart(3)} alan`));
