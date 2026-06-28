import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const roots = ["app", "components", "data", "lib", "docs", "store"];
const extraFiles = ["README.md", "PRODUCT_LOGIC.md", "STORE_RELEASE_CHECKLIST.md", "app.json"];
const extensions = new Set([".ts", ".tsx", ".md", ".json"]);
const mojibakePattern = /Ã|Ä|Å|Â|�|KeÅ|Ä°|ÅŸ|Åž|MenÃ|GiriÅ|SatÄ|GÃ¼|Å|Ä±|Ã¼|Ã¶|Ã§/;

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(fullPath, files);
    else if (extensions.has(path.extname(entry.name))) files.push(fullPath);
  }
  return files;
}

const files = [
  ...roots.flatMap((root) => walk(root)),
  ...extraFiles
];

const failures = [];

for (const file of files) {
  const text = readFileSync(file, "utf8");
  const lines = text.split(/\r?\n/);
  lines.forEach((line, index) => {
    if (mojibakePattern.test(line)) {
      failures.push(`${file}:${index + 1}: ${line.trim().slice(0, 160)}`);
    }
  });
}

if (failures.length > 0) {
  console.error("Bozuk Türkçe karakter izleri bulundu:");
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log("Türkçe karakter kontrolü temiz.");
