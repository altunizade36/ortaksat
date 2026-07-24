// KATEGORİ ARTEFAKT ÜRETECİ — master talimatın kanıt gereksinimi.
// category-tree.ts + explore.tsx GERÇEK verisini TypeScript ile derleyip çalıştırır,
// sonra 7 JSON'u OTOMATİK üretir (elle yazılmış özet YOK): category-tree.json,
// filters.json, brands.json, models.json, listing-fields.json, enums.json,
// audit-report.json. Her bulguda dosya:satır. Çıktı: audit/ klasörü.
//
// Kullanım: node scripts/generate-category-artifacts.mjs
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const TREE_FILE = "lib/category-tree.ts";
const EXPLORE_FILE = "app/(tabs)/explore.tsx";
const OUT = join(ROOT, "audit");
mkdirSync(OUT, { recursive: true });

// --- kaynak yükle + satır indeksi ---
const treeSrc = readFileSync(join(ROOT, TREE_FILE), "utf8");
const treeLines = treeSrc.split(/\r?\n/);
const exploreSrc = readFileSync(join(ROOT, EXPLORE_FILE), "utf8");
const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// bir düzenli-ifadenin category-tree.ts'te ilk eşleştiği 1-tabanlı satır no
function lineOf(re, from = 0) {
  for (let i = from; i < treeLines.length; i++) if (re.test(treeLines[i])) return i + 1;
  return null;
}
const constLine = (name) => lineOf(new RegExp(`(export )?const ${esc(name)}\\b`));
const brandLine = (brand) => lineOf(new RegExp(`^\\s*"?${esc(brand)}"?\\s*:\\s*\\[`));

// --- category-tree.ts'i CommonJS'e derleyip çalıştır (import yok → bağımsız) ---
const js = ts.transpileModule(treeSrc, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
const mod = { exports: {} };
const sandbox = { module: mod, exports: mod.exports, require, console };
vm.createContext(sandbox);
new vm.Script(js).runInContext(sandbox);
const T = mod.exports;

const findings = [];
const flag = (severity, cat, message, line = null) => findings.push({ severity, category: cat, message, file: TREE_FILE, line });

// ═══════════ 1) BRANDS ═══════════
const brandArrayNames = Object.keys(T).filter((k) => /BRANDS$/.test(k) && Array.isArray(T[k]));
const brands = {};
let brandGrandTotal = new Set();
for (const name of brandArrayNames) {
  const arr = T[name].filter((b) => b && b !== "Diğer");
  arr.forEach((b) => brandGrandTotal.add(b));
  brands[name] = { file: TREE_FILE, line: constLine(name), count: arr.length, brands: arr };
}
brands._summary = { totalArrays: brandArrayNames.length, uniqueBrands: brandGrandTotal.size };

// ═══════════ 2) MODELS ═══════════
const isModelMap = (v) => v && typeof v === "object" && !Array.isArray(v) && Object.values(v).length > 0 && Object.values(v).every((x) => Array.isArray(x));
const modelMapNames = Object.keys(T).filter((k) => isModelMap(T[k]) && k !== "ALL_MODELS_BY_BRAND");
const models = {};
let modelGrand = 0, brandWithModels = new Set();
for (const name of modelMapNames) {
  const map = T[name];
  const perBrand = {};
  let total = 0;
  for (const [brand, list] of Object.entries(map)) {
    perBrand[brand] = { file: TREE_FILE, line: brandLine(brand), count: list.length, models: list };
    total += list.length;
    brandWithModels.add(brand);
    // eksik kontrolü: boş model listesi
    if (list.length === 0) flag("HATA", "model", `${name}.${brand} model listesi BOŞ`, brandLine(brand));
    // mükerrer model (aynı listede)
    const dup = list.filter((m, i) => list.indexOf(m) !== i);
    if (dup.length) flag("EKSİK", "model", `${name}.${brand} MÜKERRER model: ${[...new Set(dup)].join(", ")}`, brandLine(brand));
  }
  models[name] = { file: TREE_FILE, line: constLine(name), brandCount: Object.keys(map).length, totalModels: total, perBrand };
  modelGrand += total;
}
models._summary = { totalMaps: modelMapNames.length, brandsWithModels: brandWithModels.size, totalModels: modelGrand };

// ═══════════ 3) LISTING-FIELDS + ENUMS (formSchemas) ═══════════
const schemas = T.formSchemas || {};
const schemaKeyLine = (fk) => lineOf(new RegExp(`^\\s*${esc(fk)}\\s*:\\s*\\{`), (constLine("formSchemas") || 1) - 1);
const listingFields = {};
const enums = { schemaEnums: {}, standaloneEnums: {} };
let fieldTotal = 0, selectTotal = 0, emptyOpts = 0, boolTotal = 0, multiTotal = 0;
for (const [fk, schema] of Object.entries(schemas)) {
  const sLine = schemaKeyLine(fk);
  const fields = (schema.fields || []).map((f) => {
    fieldTotal++;
    const opts = f.options || f.choices || [];
    const isChoice = f.type === "select" || f.type === "multiselect";
    if (f.type === "select") selectTotal++;
    if (f.type === "multiselect") multiTotal++;
    if (f.type === "bool") boolTotal++;
    if (isChoice) {
      if (!Array.isArray(opts) || opts.length === 0) { emptyOpts++; flag("HATA", "enum", `${fk}.${f.key} (${f.type}) seçenekleri BOŞ`, sLine); }
      else {
        enums.schemaEnums[`${fk}.${f.key}`] = { file: TREE_FILE, line: sLine, type: f.type, optionCount: opts.length, options: opts };
        const dup = opts.filter((o, i) => opts.indexOf(o) !== i);
        if (dup.length) flag("EKSİK", "enum", `${fk}.${f.key} MÜKERRER seçenek: ${[...new Set(dup)].join(", ")}`, sLine);
      }
    }
    return { key: f.key, label: f.label ?? null, type: f.type, required: Boolean(f.required), optionCount: isChoice ? opts.length : 0 };
  });
  listingFields[fk] = { file: TREE_FILE, line: sLine, title: schema.title, fieldCount: fields.length, fields };
}
// standalone enum sabitleri (marka/model olmayan string dizileri)
for (const k of Object.keys(T)) {
  if (/BRANDS$/.test(k)) continue;
  const v = T[k];
  if (Array.isArray(v) && v.length > 0 && v.every((x) => typeof x === "string") && !isModelMap(v)) {
    // yalnız muhtemel enum sabitleri (BÜYÜK_HARF adlar)
    if (/^[A-Z][A-Z0-9_]+$/.test(k)) enums.standaloneEnums[k] = { file: TREE_FILE, line: constLine(k), count: v.length, values: v };
  }
}
listingFields._summary = { schemas: Object.keys(schemas).length, totalFields: fieldTotal, select: selectTotal, multiselect: multiTotal, bool: boolTotal, emptyOptions: emptyOpts };
enums._summary = { schemaEnums: Object.keys(enums.schemaEnums).length, standaloneEnums: Object.keys(enums.standaloneEnums).length };

// ═══════════ 4) FILTERS (explore.tsx'ten GERÇEK çıkar) ═══════════
const sortMatch = exploreSrc.match(/const SORT_ORDER:\s*SortMode\[\]\s*=\s*\[([^\]]+)\]/);
const sortModes = sortMatch ? sortMatch[1].split(",").map((s) => s.trim().replace(/["']/g, "")).filter(Boolean) : [];
const sortLabelsBlock = exploreSrc.match(/const SORT_LABELS[^{]*\{([^}]+)\}/);
const sortLabels = {};
if (sortLabelsBlock) for (const m of sortLabelsBlock[1].matchAll(/(\w+):\s*"([^"]+)"/g)) sortLabels[m[1]] = m[2];
const paramMatch = exploreSrc.match(/useLocalSearchParams<\{([^}]+)\}>/);
const filterParams = paramMatch ? [...paramMatch[1].matchAll(/(\w+)\?:/g)].map((m) => m[1]) : [];
const filters = {
  file: EXPLORE_FILE,
  sortModes: { count: sortModes.length, modes: sortModes, labels: sortLabels },
  urlFilterParams: { count: filterParams.length, params: filterParams },
  // her şemadaki filtrelenebilir alanlar (select/multiselect = filtre)
  perSchemaFilterableFields: Object.fromEntries(Object.entries(listingFields).filter(([k]) => k !== "_summary").map(([fk, s]) => [fk, s.fields.filter((f) => f.type === "select" || f.type === "multiselect").map((f) => f.key)])),
  _summary: { sortModes: sortModes.length, urlParams: filterParams.length }
};
if (sortModes.length === 0) flag("HATA", "filtre", "SORT_ORDER çıkarılamadı (sıralama filtresi yok?)", null);

// ═══════════ 5) CATEGORY-TREE (walk + counts + resolved formKey) ═══════════
const schemaKeys = new Set(Object.keys(schemas));
const usedFormKeys = new Set();
let nodeTotal = 0, leafTotal = 0, maxDepth = 0;
const leavesNoSchema = [];
function annotate(nodes, inheritedFk, depth, parentLabels) {
  const sibSlugs = new Map();
  return nodes.map((n) => {
    nodeTotal++;
    maxDepth = Math.max(maxDepth, depth);
    const fk = n.formKey ?? inheritedFk;
    const isLeaf = !n.children || n.children.length === 0;
    // kardeş slug çakışması (GERÇEK hata)
    sibSlugs.set(n.slug, (sibSlugs.get(n.slug) || 0) + 1);
    if (sibSlugs.get(n.slug) === 2) flag("HATA", "mükerrer", `"${[...parentLabels, ""].join(" > ")}" altında kardeş slug çakışması: "${n.slug}"`, lineOf(new RegExp(esc(n.label))));
    if (n.children && n.children.length === 0) flag("EKSİK", "boş-dal", `Boş children[] dalı: ${[...parentLabels, n.label].join(" > ")}`, null);
    const out = { label: n.label, slug: n.slug, formKey: fk ?? null };
    if (isLeaf) {
      leafTotal++;
      if (!fk) { leavesNoSchema.push([...parentLabels, n.label].join(" > ")); flag("HATA", "şema", `formKey'siz yaprak: ${[...parentLabels, n.label].join(" > ")}`, null); }
      else usedFormKeys.add(fk);
    } else {
      if (fk) usedFormKeys.add(fk);
      out.childCount = n.children.length;
      out.children = annotate(n.children, fk, depth + 1, [...parentLabels, n.label]);
    }
    return out;
  });
}
const annotatedTree = annotate(T.categoryTree || [], undefined, 1, []);

// tanımsız / kullanılmayan şema
for (const fk of usedFormKeys) if (!schemaKeys.has(fk)) flag("HATA", "şema", `Kullanılan ama TANIMSIZ formKey: ${fk}`, null);
const unusedSchemas = [...schemaKeys].filter((k) => !usedFormKeys.has(k) && k !== "alisverisGenel");
for (const fk of unusedSchemas) flag("NOT", "şema", `Kullanılmayan şema (ölü): ${fk}`, schemaKeyLine(fk));

// per-top-category istatistik (master madde 3)
function subtreeStats(node) {
  let subs = 0, leaves = 0, fks = new Set();
  (function rec(n) {
    for (const c of n.children || []) {
      subs++;
      if (c.formKey) fks.add(c.formKey);
      if (!c.children || c.children.length === 0) leaves++;
      else rec(c);
    }
  })(node);
  return { subcategories: subs, leaves, distinctSchemas: fks.size };
}
const perTopCategory = (T.categoryTree || []).map((top) => {
  const st = subtreeStats(top);
  const fks = new Set();
  (function rec(n) { for (const c of n.children || []) { if (c.formKey) fks.add(c.formKey); rec(c); } })(top);
  let fieldCount = 0, enumCount = 0;
  for (const fk of fks) { const s = schemas[fk]; if (s) { fieldCount += (s.fields || []).length; enumCount += (s.fields || []).filter((f) => f.type === "select" || f.type === "multiselect").length; } }
  return { top: top.label, slug: top.slug, subcategories: st.subcategories, leaves: st.leaves, distinctSchemas: st.distinctSchemas, listingFields: fieldCount, enums: enumCount };
});

const categoryTreeOut = {
  file: TREE_FILE,
  generatedFrom: "GERÇEK modül (TypeScript transpile + vm çalıştırma)",
  summary: { topCategories: (T.categoryTree || []).length, totalNodes: nodeTotal, leaves: leafTotal, maxDepth, distinctSchemasUsed: usedFormKeys.size },
  perTopCategory,
  tree: annotatedTree
};

// ═══════════ 6) AUDIT-REPORT ═══════════
const bySeverity = findings.reduce((a, f) => { a[f.severity] = (a[f.severity] || 0) + 1; return a; }, {});
const critical = findings.filter((f) => f.severity === "HATA" || f.severity === "EKSİK");
const auditReport = {
  generatedFrom: "GERÇEK sistem — category-tree.ts + explore.tsx otomatik denetim",
  counts: {
    topCategories: (T.categoryTree || []).length,
    totalNodes: nodeTotal,
    leaves: leafTotal,
    brandArrays: brandArrayNames.length,
    uniqueBrands: brandGrandTotal.size,
    modelMaps: modelMapNames.length,
    totalModels: modelGrand,
    schemas: Object.keys(schemas).length,
    listingFields: fieldTotal,
    selectFields: selectTotal,
    multiselectFields: multiTotal,
    boolFields: boolTotal,
    emptyEnums: emptyOpts,
    sortModes: sortModes.length,
    urlFilterParams: filterParams.length
  },
  checks: {
    "Eksik kategori (formKey'siz yaprak)": leavesNoSchema.length,
    "Boş enum": emptyOpts,
    "Kardeş slug çakışması": findings.filter((f) => f.category === "mükerrer").length,
    "Boş dal": findings.filter((f) => f.category === "boş-dal").length,
    "Tanımsız formKey": findings.filter((f) => f.category === "şema" && /TANIMSIZ/.test(f.message)).length,
    "Kullanılmayan şema": unusedSchemas.length,
    "Mükerrer model/enum": findings.filter((f) => /MÜKERRER/.test(f.message)).length
  },
  bySeverity,
  criticalCount: critical.length,
  findings
};

// ═══════════ YAZ ═══════════
const files = {
  "category-tree.json": categoryTreeOut,
  "brands.json": brands,
  "models.json": models,
  "listing-fields.json": listingFields,
  "enums.json": enums,
  "filters.json": filters,
  "audit-report.json": auditReport
};
for (const [name, data] of Object.entries(files)) {
  writeFileSync(join(OUT, name), JSON.stringify(data, null, 2), "utf8");
  const bytes = JSON.stringify(data).length;
  console.log(`✓ audit/${name}  (${(bytes / 1024).toFixed(1)} KB)`);
}
console.log("\n─────── ÖZET (dosyalardan) ───────");
console.log(`Üst kategori: ${(T.categoryTree || []).length} | Düğüm: ${nodeTotal} | Yaprak: ${leafTotal} | Derinlik: ${maxDepth}`);
console.log(`Marka dizisi: ${brandArrayNames.length} (${brandGrandTotal.size} tekil) | Model haritası: ${modelMapNames.length} (${modelGrand} model)`);
console.log(`Şema: ${Object.keys(schemas).length} | Alan: ${fieldTotal} | select: ${selectTotal} multiselect: ${multiTotal} bool: ${boolTotal} | BOŞ enum: ${emptyOpts}`);
console.log(`Sıralama modu: ${sortModes.length} | URL filtre parametresi: ${filterParams.length}`);
console.log(`\nBULGU: ${findings.length} (KRİTİK: ${critical.length}) — ${JSON.stringify(bySeverity)}`);
console.log(critical.length === 0 ? "✓ KRİTİK/EKSİK BULGU YOK — audit/audit-report.json içinde kanıt" : `✗ ${critical.length} kritik bulgu — audit/audit-report.json`);
process.exit(0);
