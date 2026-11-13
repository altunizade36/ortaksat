import { readFile, writeFile, mkdir } from "node:fs/promises";

const manifest = JSON.parse(
  await readFile("data/city-cover-manifest.json", "utf8"),
);
const cards = manifest.entries
  .map(
    (entry) =>
      `<figure><img src="${entry.url}" alt="${entry.city}" loading="eager"><figcaption><strong>${entry.city}</strong><span>${entry.title}</span></figcaption></figure>`,
  )
  .join("");
const html = `<!doctype html><meta charset="utf-8"><style>
body{margin:16px;background:#eef3fb;color:#09275e;font:13px system-ui}main{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}figure{margin:0;background:#fff;border:1px solid #dce6f5;border-radius:10px;overflow:hidden}img{display:block;width:100%;aspect-ratio:3/1;object-fit:cover}figcaption{display:flex;gap:6px;padding:7px}span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:#687386}</style><main>${cards}</main>`;
await mkdir("audit/city-covers", { recursive: true });
await writeFile("audit/city-covers/review.html", html, "utf8");
console.log(`Kapak inceleme sayfası hazır: ${manifest.entries.length} il.`);
