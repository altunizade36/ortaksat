// TÜRKÇE ADRESLER — sunucu tarafı. `data/url-aliases.json` eşlemesinden `vercel.json` içindeki
// yönlendirme (İngilizce → Türkçe, kalıcı) ve yeniden yazma (Türkçe → aynı sayfa dosyası) kurallarını üretir.
//
//   node scripts/sync-url-aliases.mjs          → vercel.json'ı günceller (yinelenebilir; elle yazılan kurallara dokunmaz)
//   node scripts/sync-url-aliases.mjs --check  → fark varsa hata koduyla çıkar (hiçbir şey yazmaz)
//
// Eşlemeye yeni bir satır eklenince bu betik YENİDEN çalıştırılmalı; yoksa Türkçe adres sunucuda 404 verir.
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const data = JSON.parse(readFileSync(join(root, "data", "url-aliases.json"), "utf8"));
const vercelPath = join(root, "vercel.json");
const raw = readFileSync(vercelPath, "utf8");
const vercel = JSON.parse(raw);

// İç rota tek sayfa mı (app/x.tsx, app/(tabs)/x.tsx, app/x/index.tsx) yoksa parametreli mi (app/x/[id].tsx)?
function routeShape(internal) {
  const name = internal.slice(1);
  const single = ["app", "app/(tabs)"].some((dir) => existsSync(join(root, dir, `${name}.tsx`)) || existsSync(join(root, dir, name, "index.tsx")));
  let param = null;
  for (const dir of ["app", "app/(tabs)"]) {
    const folder = join(root, dir, name);
    if (existsSync(folder)) { const file = readdirSync(folder).find((f) => /^\[[a-z]+\]\.tsx$/i.test(f)); if (file) param = file.replace(/\.tsx$/, ""); }
  }
  return { single, param };
}

const redirects = [], rewrites = [];
for (const [internal, pub] of data.paths) {
  const { single, param } = routeShape(internal);
  if (!single && !param) throw new Error(`Eşlemedeki rota bulunamadı: ${internal}`);
  if (single) {
    redirects.push({ source: internal, destination: pub, permanent: true });
    rewrites.push({ source: pub, destination: internal });
  }
  if (param) {
    redirects.push({ source: `${internal}/:id`, destination: `${pub}/:id`, permanent: true });
    rewrites.push({ source: `${pub}/:id`, destination: `${internal}/${param}` });
  }
}

const aliasSources = new Set([...redirects, ...rewrites].map((rule) => rule.source));
const keep = (rules) => (rules ?? []).filter((rule) => !aliasSources.has(rule.source));
// Takma ad yönlendirmeleri elle yazılanlardan ÖNCE (ör. /create-action → /create zinciri tek adımda Türkçeye varsın).
vercel.redirects = [...redirects, ...keep(vercel.redirects).map((rule) => {
  // Elle yazılmış bir yönlendirmenin HEDEFİ eşlemede varsa doğrudan Türkçesine gitsin (çift yönlendirme olmasın).
  const hit = data.paths.find(([internal]) => rule.destination === internal);
  return hit ? { ...rule, destination: hit[1] } : rule;
})];
// Takma ad yeniden yazmaları elle yazılanlardan ÖNCE (Türkçe adres önce eşlensin).
vercel.rewrites = [...rewrites, ...keep(vercel.rewrites)];

const next = JSON.stringify(vercel, null, 2) + "\n";
if (process.argv.includes("--check")) {
  if (JSON.stringify(JSON.parse(raw)) !== JSON.stringify(vercel)) { console.error("vercel.json adres eşlemesiyle uyumsuz: node scripts/sync-url-aliases.mjs çalıştır."); process.exit(1); }
  console.log("vercel.json adres eşlemesiyle uyumlu.");
} else {
  writeFileSync(vercelPath, raw.includes("\r\n") ? next.replace(/\n/g, "\r\n") : next, "utf8");
  console.log(`vercel.json güncellendi: ${redirects.length} yönlendirme + ${rewrites.length} yeniden yazma (takma ad).`);
}
