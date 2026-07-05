import { defineConfig, devices } from "@playwright/test";
import * as fs from "fs";
import * as path from "path";

// .env.e2e'yi (gitignored) yükle — canlı siteye karşı test ayarları.
const envPath = path.join(__dirname, ".env.e2e");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

export default defineConfig({
  testDir: "./e2e",
  // Canlı siteye karşı çalışıyoruz; veri yarışını önlemek için sıralı.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  outputDir: "e2e-artifacts",
  use: {
    baseURL: process.env.E2E_BASE_URL || "https://ortaksat.com",
    trace: "on",
    screenshot: "on",
    video: "on",
    viewport: { width: 1440, height: 900 },
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul"
  },
  projects: [
    { name: "desktop-chromium", use: { ...devices["Desktop Chrome"] } }
  ]
});
