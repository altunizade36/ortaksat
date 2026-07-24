// Kategori/marka/model/şema/filtre DENETİMİ — master talimatın "Doğrulama" bölümü.
// category-tree.ts'i TypeScript ile derleyip GERÇEK veriyi yükler, sonra eksik/boş/
// mükerrer her şeyi raporlar. "Mevcut veriye güvenme" → gerçek export'ları çalıştırır.
//
// Kullanım: node scripts/audit-categories.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = join(__dirname, "..", "lib", "category-tree.ts");

// 1) category-tree.ts'i CommonJS'e derle (import yok → bağımsız yüklenir).
const source = readFileSync(SRC, "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText;

const moduleObj = { exports: {} };
const sandbox = { module: moduleObj, exports: moduleObj.exports, require, console };
vm.createContext(sandbox);
new vm.Script(js).runInContext(sandbox);
const T = moduleObj.exports;

// --- yardımcılar ---
const problems = [];
const add = (sev, cat, msg) => problems.push({ sev, cat, msg });

// 2) MARKA→MODEL kapsamı: her marka listesi için model haritasında kaç model var.
const brandModelChecks = [
  ["Otomobil", T.CAR_BRANDS, T.MODELS_BY_BRAND, 6],
  ["Motosiklet", T.MOTO_BRANDS, T.MOTO_MODELS, 4],
  ["Bilgisayar", T.COMPUTER_BRANDS, T.COMPUTER_MODELS, 3],
  ["Televizyon", T.TV_BRANDS, T.TV_MODELS, 3],
  ["Ticari", T.COMMERCIAL_BRANDS, T.COMMERCIAL_MODELS, 3]
];
// GERÇEKTEN AZ MODELLİ markalar — tam lineup'ı zaten kısa; sahte model eklemek
// "gerçek veri" kuralını çiğner. Bunları "zayıf" saymayız (eksik DEĞİL, tam-ama-kısa).
const KNOWN_SMALL = new Set([
  "Togg", "Lucid", "Fisker", "Jaecoo", "Skywell", "Omoda",  // otomobil: gerçek lineup 2-5 model
  "Yuki", "Motolux", "Falcon", "Bimota"          // moto: niş marka, bilinen modelleri bu kadar
]);
const coverage = {};
for (const [name, brands, models, minModels] of brandModelChecks) {
  if (!Array.isArray(brands) || !models) { add("HATA", "veri", `${name}: marka/model verisi yüklenemedi`); continue; }
  const real = brands.filter((b) => b && b !== "Diğer");
  const noModel = real.filter((b) => !models[b] || models[b].length === 0);
  const thin = real.filter((b) => models[b] && models[b].length > 0 && models[b].length < minModels && !KNOWN_SMALL.has(b));
  coverage[name] = { total: real.length, withModels: real.length - noModel.length, noModel, thin };
  if (noModel.length) add("EKSİK", `${name} model`, `${noModel.length}/${real.length} markanın MODELİ YOK: ${noModel.join(", ")}`);
  if (thin.length) add("ZAYIF", `${name} model`, `${thin.length} marka <${minModels} model: ${thin.map((b) => `${b}(${models[b].length})`).join(", ")}`);
}

// 3) AĞAÇ: her yaprak formKey (miras dahil) almalı; her formKey'in şeması olmalı.
const schemas = T.formSchemas || {};
const schemaKeys = new Set(Object.keys(schemas));
const usedFormKeys = new Set();
const leavesNoSchema = [];
const siblingDups = [];      // GERÇEK sorun: aynı ebeveyn altında AYNI slug (çakışma)
const emptyChildren = [];    // children:[] ama yaprak sayılmayan düğüm
function walk(nodes, inheritedFk, pathLabels) {
  // Kardeş slug çakışması: aynı seviyede aynı slug → path-scoped çözüm bile ayıramaz.
  const sibSlugs = new Map();
  for (const n of nodes) {
    sibSlugs.set(n.slug, (sibSlugs.get(n.slug) || 0) + 1);
    if (sibSlugs.get(n.slug) === 2) siblingDups.push(`${pathLabels.join(" > ") || "(kök)"} altında "${n.slug}" tekrar`);
  }
  for (const n of nodes) {
    const fk = n.formKey ?? inheritedFk;
    const path = [...pathLabels, n.label];
    if (n.children && n.children.length === 0) emptyChildren.push(path.join(" > "));
    const isLeaf = !n.children || n.children.length === 0;
    if (isLeaf) {
      if (!fk) leavesNoSchema.push(path.join(" > "));
      else usedFormKeys.add(fk);
    } else {
      if (fk) usedFormKeys.add(fk);
      walk(n.children, fk, path);
    }
  }
}
walk(T.categoryTree || [], undefined, []);

// formKey referansı var ama şema tanımı yok
const missingSchemas = [...usedFormKeys].filter((k) => !schemaKeys.has(k));
if (missingSchemas.length) add("HATA", "şema", `Kullanılan ama TANIMSIZ formKey: ${missingSchemas.join(", ")}`);
if (leavesNoSchema.length) add("EKSİK", "şema", `${leavesNoSchema.length} yaprak formKey'siz (örnek): ${leavesNoSchema.slice(0, 8).join(" | ")}`);

// tanımlı ama HİÇ kullanılmayan şema (ölü şema)
const unusedSchemas = [...schemaKeys].filter((k) => !usedFormKeys.has(k) && k !== "alisverisGenel");
if (unusedSchemas.length) add("NOT", "şema", `Kullanılmayan şema: ${unusedSchemas.join(", ")}`);

// 4) ENUM/OPTION: her select/multiselect alanının seçenekleri dolu olmalı.
let emptyOpts = 0, fieldTotal = 0, selectTotal = 0;
for (const [sk, schema] of Object.entries(schemas)) {
  for (const f of schema.fields || []) {
    fieldTotal++;
    if (f.type === "select" || f.type === "multiselect") {
      selectTotal++;
      const opts = f.options || f.choices || [];
      if (!Array.isArray(opts) || opts.length === 0) { emptyOpts++; add("EKSİK", "enum", `${sk}.${f.key} (${f.type}) seçenek BOŞ`); }
    }
  }
}

// 5) GERÇEK MÜKERRER: aynı ebeveyn altında aynı slug (path-scoped çözüm bile ayıramaz).
//    Farklı ebeveynlerdeki tekrar (örn "1+1" Satılık/Kiralık altında) SORUN DEĞİL.
if (siblingDups.length) add("HATA", "mükerrer", `${siblingDups.length} KARDEŞ slug çakışması: ${siblingDups.slice(0, 10).join(" | ")}`);
else add("NOT", "mükerrer", "Kardeş-seviye slug çakışması yok (farklı ebeveynlerdeki tekrarlar path-scoped, sorun değil)");
if (emptyChildren.length) add("EKSİK", "boş dal", `${emptyChildren.length} düğüm children:[] (boş dal): ${emptyChildren.slice(0, 8).join(" | ")}`);

// --- RAPOR ---
console.log("═══════════ KATEGORİ/MARKA/MODEL/ŞEMA DENETİMİ ═══════════\n");
console.log("MARKA→MODEL KAPSAMI:");
for (const [name, c] of Object.entries(coverage)) {
  console.log(`  ${name}: ${c.withModels}/${c.total} markada model var${c.noModel.length ? ` — MODELSİZ: ${c.noModel.length}` : " ✓"}`);
}
console.log(`\nŞEMA: ${schemaKeys.size} tanımlı, ${usedFormKeys.size} kullanılıyor, ${fieldTotal} alan (${selectTotal} select/multiselect, ${emptyOpts} boş)`);
console.log(`YAPRAK: ${leavesNoSchema.length} formKey'siz`);

const order = { HATA: 0, EKSİK: 1, ZAYIF: 2, NOT: 3 };
problems.sort((a, b) => (order[a.sev] ?? 9) - (order[b.sev] ?? 9));
console.log(`\n─────── BULGULAR (${problems.length}) ───────`);
for (const p of problems) console.log(`[${p.sev}] ${p.cat}: ${p.msg}`);

const crit = problems.filter((p) => p.sev === "HATA" || p.sev === "EKSİK").length;
console.log(`\n${crit === 0 ? "✓ KRİTİK EKSİK YOK" : `✗ ${crit} KRİTİK/EKSİK bulgu — tamamlanmalı`}`);
process.exit(0);
