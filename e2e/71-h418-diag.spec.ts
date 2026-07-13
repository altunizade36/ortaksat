import { test, devices } from "@playwright/test";
test.use({ ...devices["iPhone 13"] });

test("SSG HTML vs istemci DOM farkı", async ({ page, request }) => {
  test.setTimeout(120_000);
  // 1) Sunucudan gelen ham SSG HTML
  const res = await request.get("https://www.ortaksat.com/iletisim");
  const html = await res.text();
  const bodyMatch = html.match(/<div id="root">([\s\S]*?)<\/div>\s*<script/);
  const serverHtml = (bodyMatch?.[1] ?? html).replace(/\s+/g, " ");
  console.log(`SUNUCU HTML uzunluk: ${serverHtml.length}`);

  // 2) İstemci: hidrasyondan SONRA DOM
  await page.goto("/iletisim", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4500);
  const clientHtml = (await page.evaluate(() => document.getElementById("root")?.innerHTML ?? "")).replace(/\s+/g, " ");
  console.log(`ISTEMCI DOM uzunluk: ${clientHtml.length}`);

  // 3) İlk farklılık noktası
  let i = 0;
  while (i < Math.min(serverHtml.length, clientHtml.length) && serverHtml[i] === clientHtml[i]) i++;
  console.log(`\nİLK FARK indeks ${i}:`);
  console.log(`  SUNUCU : ...${serverHtml.slice(Math.max(0, i - 90), i + 140)}`);
  console.log(`  ISTEMCI: ...${clientHtml.slice(Math.max(0, i - 90), i + 140)}`);
});
