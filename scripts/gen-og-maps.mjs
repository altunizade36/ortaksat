// Sosyal crawler OG meta'sı (middleware.ts) için slug→ad haritalarını üretir.
// category-og-map.json data/category_seed.json'dan türetilir → kategoriler
// değişince otomatik senkron kalır. city-og-map.json 81 il sabit olduğundan
// elle üretilir (lib/cities.ts PROVINCE_BY_SLUG) ve nadiren değişir.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const seedPath = join(root, "data", "category_seed.json");
const outPath = join(root, "data", "category-og-map.json");

if (!existsSync(seedPath)) {
  console.warn("gen-og-maps: category_seed.json yok, atlanıyor.");
  process.exit(0);
}

const seed = JSON.parse(readFileSync(seedPath, "utf8"));
const map = {};
for (const c of seed.categories ?? []) {
  if (c.slug && c.name && !(c.slug in map)) map[c.slug] = c.name;
}
writeFileSync(outPath, JSON.stringify(map));
console.log(`gen-og-maps: category-og-map.json yazıldı — ${Object.keys(map).length} kategori`);
