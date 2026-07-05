// Vercel bilinmeyen yollar için dist-web/404.html sunar. Expo export ise
// +not-found.html üretir. Bu script onu 404.html'e kopyalar ki özel 404 sayfamız
// (generic Vercel 404 yerine) gösterilsin.
import fs from "fs";

const dir = "dist-web";
const src = `${dir}/+not-found.html`;
const dst = `${dir}/404.html`;

try {
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, dst);
    console.log("post-export: 404.html oluşturuldu (+not-found.html'den).");
  } else {
    console.warn("post-export: +not-found.html bulunamadı, 404.html atlandı.");
  }
} catch (e) {
  console.warn("post-export: 404.html kopyalanamadı:", e.message);
}
