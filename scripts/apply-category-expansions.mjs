// Kategori genişletme verisini (data/category-expansions.json) lib/category-tree.ts içindeki
// <category-expansions:begin> … <category-expansions:end> bloğuna yazar, sonra ağacı yükleyip doğrular.
//
// Kullanım:  node scripts/apply-category-expansions.mjs
//
// JSON biçimi:
// {
//   "constants":  { "CAR_BRANDS": ["Yeni"], "MODELS_BY_BRAND": { "Renault": ["R 5"] } },
//   "expansions": [ { "path": ["İkinci El & Sıfır Alışveriş", "Küçük Ev Aletleri", "Robot Süpürge"],
//                     "add": ["Tür"], "brands": { "Roborock": ["S8", "Q7"], "Dreame": [] } } ]
// }
// Kurallar: yalnız gerçek marka/model; "Diğer"/"Diğer Model" otomatik eklenir; aynı ebeveynde tekrar yok sayılır.
// Mevcut kategorilerin adresleri DEĞİŞMEZ (yeni düğümler slug atamasında en sona bırakılır).
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const treePath = join(root, "lib", "category-tree.ts");
const dataPath = join(root, "data", "category-expansions.json");
const data = JSON.parse(readFileSync(dataPath, "utf8"));
const BEGIN = "// <category-expansions:begin>";
const END = "// <category-expansions:end>";

const src = readFileSync(treePath, "utf8");
const a = src.indexOf(BEGIN), b = src.indexOf(END);
if (a < 0 || b < 0) throw new Error("işaretli blok bulunamadı");
const block = [
  BEGIN,
  "// OTOMATİK ÜRETİLDİ — elle düzenleme; data/category-expansions.json'u düzenleyip betiği çalıştır.",
  `const CONSTANT_ADDITIONS: Record<string, string[] | Record<string, string[]>> = ${JSON.stringify(data.constants ?? {})};`,
  `const CATEGORY_EXPANSIONS: Array<{ path: string[]; add?: string[]; brands?: Record<string, string[]> }> = ${JSON.stringify(data.expansions ?? [])};`,
  ""
].join("\n");
const out = src.slice(0, a) + block + src.slice(b);
writeFileSync(treePath, out);

// Doğrulama: ağacı derleyip yükle.
const require = createRequire(join(root, "package.json"));
const ts = require("typescript");
const js = ts.transpileModule(out, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const m = { exports: {} };
new vm.Script(js).runInContext(vm.createContext({ module: m, exports: m.exports, require, console }));
const T = m.exports;
let nodes = 0; const slugs = new Set(); let dup = 0;
(function walk(ns) { for (const n of ns) { nodes++; if (slugs.has(n.slug)) dup++; slugs.add(n.slug); if (n.children) walk(n.children); } })(T.categoryTree);
console.log(`düğüm: ${nodes} | mükerrer slug: ${dup} | genişletme girdisi: ${(data.expansions ?? []).length}`);
if (T.EXPANSION_MISSES.length) {
  console.log(`BULUNAMAYAN YOL (${T.EXPANSION_MISSES.length}):`);
  for (const p of T.EXPANSION_MISSES) console.log("  - " + p);
  process.exitCode = 1;
}
if (dup) process.exitCode = 1;
