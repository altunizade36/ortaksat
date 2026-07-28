// MaterialCommunityIcons.ttf (~573 KiB, ~7000 glif) → yalnız GERÇEKTEN kullanılan
// ikonlara subset (~30-50 KiB). Font kritik-yolda ve mobil 4G'de büyük yük.
//
// GÜVENLİ: kullanılan ikon adlarını BUILD ÇIKTISINDAN (dist-web JS) tarar — kaynakta
// name="..." literalleri + dinamik adlar (getCategoryIcon, ICON_KEYWORDS) hepsi minified
// bundle'da string olarak durur → hiçbirini kaçırmaz. Herhangi bir hata olursa orijinal
// fontu OLDUĞU GİBİ bırakır (build kırılmaz — kademeli bozulma).
//
// Çalıştır: node scripts/subset-icon-font.mjs   (post-export.mjs de çağırır)
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createHash } from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DIST = join(ROOT, "dist-web");

function walk(dir, filter, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}

export async function subsetIconFont() {
  if (!existsSync(DIST)) {
    console.warn("subset-icon-font: dist-web yok, atlanıyor.");
    return;
  }
  // 1) MCI .ttf'yi bul
  const ttfs = walk(DIST, (p) => /MaterialCommunityIcons\.[a-f0-9]+\.ttf$/i.test(p));
  if (!ttfs.length) {
    console.warn("subset-icon-font: MaterialCommunityIcons .ttf bulunamadı, atlanıyor.");
    return;
  }
  const fontPath = ttfs[0];
  const oldBase = fontPath.split(/[\\/]/).pop();
  const original = readFileSync(fontPath);

  // 2) glyphMap (ad → codepoint)
  const glyphPath = join(ROOT, "node_modules/@expo/vector-icons/build/vendor/react-native-vector-icons/glyphmaps/MaterialCommunityIcons.json");
  if (!existsSync(glyphPath)) {
    console.warn("subset-icon-font: glyphmap bulunamadı, atlanıyor.");
    return;
  }
  const glyphMap = JSON.parse(readFileSync(glyphPath, "utf8"));
  const allNames = Object.keys(glyphMap);

  // 3) KAYNAK kodu tara → kullanılan ikon adları. NEDEN kaynak, build çıktısı DEĞİL:
  //    minified bundle @expo/vector-icons glyphMap'inin TAMAMINI (7000 ad) string olarak
  //    içerir → orada tarama "hepsi kullanılıyor" der. Kaynakta glyphMap yok; yalnız
  //    gerçek name="..." literalleri + lib/categories.ts ICON_KEYWORDS/CATEGORY_ICONS
  //    değerleri (getCategoryIcon dinamik döndürse de bu değerler kaynakta literaldir).
  const SRC_DIRS = ["app", "components", "lib"].map((d) => join(ROOT, d));
  const srcFiles = SRC_DIRS.flatMap((d) => walk(d, (p) => /\.(tsx?|jsx?|mjs)$/.test(p)));
  const tokens = new Set();
  const tokenRe = /["'`]([a-z0-9][a-z0-9-]{1,39})["'`]/g;
  for (const f of srcFiles) {
    const src = readFileSync(f, "utf8");
    let m;
    while ((m = tokenRe.exec(src))) tokens.add(m[1]);
  }
  const usedNames = allNames.filter((n) => tokens.has(n));
  // Güvenlik: en az birkaç ikon bulunmalı; yoksa tarama başarısız demektir → dokunma.
  if (usedNames.length < 20) {
    console.warn(`subset-icon-font: yalnız ${usedNames.length} ikon bulundu (şüpheli) — subset ATLANDI, orijinal korunuyor.`);
    return;
  }
  const codepoints = usedNames.map((n) => glyphMap[n]);
  const text = codepoints.map((cp) => String.fromCodePoint(cp)).join("");

  // 4) subset
  const { default: subsetFont } = await import("subset-font");
  const subsetBuf = await subsetFont(original, text, { targetFormat: "sfnt" });

  // 5) Yeni içerik-hash'li ad ile yaz, eskiyi sil, TÜM (build çıktısı) JS'lerde referansı değiştir
  const jsFiles = walk(join(DIST, "_expo"), (p) => p.endsWith(".js"));
  const newHash = createHash("md5").update(subsetBuf).digest("hex").slice(0, 20);
  const newBase = `MaterialCommunityIcons.${newHash}.ttf`;
  const newPath = join(dirname(fontPath), newBase);
  writeFileSync(newPath, subsetBuf);
  let patched = 0;
  for (const f of jsFiles) {
    const src = readFileSync(f, "utf8");
    if (src.includes(oldBase)) {
      writeFileSync(f, src.split(oldBase).join(newBase));
      patched++;
    }
  }
  if (patched === 0) {
    // Referans bulunamadı → riskli, yeni dosyayı sil, eskiyi bırak.
    unlinkSync(newPath);
    console.warn("subset-icon-font: JS'de font referansı bulunamadı — subset geri alındı, orijinal korunuyor.");
    return;
  }
  if (newPath !== fontPath) unlinkSync(fontPath);

  const kb = (n) => (n / 1024).toFixed(1);
  console.log(`subset-icon-font: ${usedNames.length} ikon | ${kb(original.length)} KiB → ${kb(subsetBuf.length)} KiB | ${patched} JS dosyasında referans güncellendi.`);
}

// Doğrudan çalıştırıldıysa (node scripts/subset-icon-font.mjs) tek başına koş.
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("subset-icon-font.mjs")) {
  subsetIconFont().catch((err) => {
    console.warn(`subset-icon-font: subset başarısız (${err?.message ?? err}) — orijinal font korunuyor.`);
  });
}
