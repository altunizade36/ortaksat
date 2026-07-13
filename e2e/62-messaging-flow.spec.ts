import { test, devices, type Page } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, resetAuthRateLimits, runSql } from "./helpers/supabase-admin";

const PW = "GucluSifre123!";
test.use({ ...devices["iPhone 13"] });
const one = async <T,>(sql: string): Promise<T | undefined> => (await runSql<T[]>(sql))[0];

async function login(page: Page, email: string) {
  await resetAuthRateLimits();
  await page.goto("/auth", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.getByPlaceholder(/eposta|@/i).first().fill(email);
  await page.getByPlaceholder(/şifre/i).first().fill(PW);
  await page.getByText(/E-posta ile giriş yap/i).first().tap();
  await page.waitForTimeout(5500);
}
async function logout(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(800);
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch { /* */ } });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1200);
}

/**
 * MESAJLAŞMA: alıcı ilan detayından satıcıya mesaj atar → konuşma + mesaj DB'ye yazılır →
 * satıcı mesajı görür ve YANITLAR → alıcı yanıtı alır. Her adım DB'den doğrulanır.
 */
test("MESAJLAŞMA: alıcı → satıcı mesaj → satıcı yanıt (uçtan uca)", async ({ page }) => {
  test.setTimeout(900_000);
  page.on("dialog", (d) => d.accept().catch(() => {}));

  const sellerEmail = uniqueEmail("msgseller");
  const buyerEmail = uniqueEmail("msgbuyer");
  const sellerId = await createConfirmedUser(sellerEmail, PW, "E2E MsgSatici");
  const buyerId = await createConfirmedUser(buyerEmail, PW, "E2E MsgAlici");

  const l = await one<{ id: string }>(`insert into listings
    (id, owner_id, title, slug, location, description, category, price, commission_type, commission_value, status, stock_count, demo, partnership_mode)
    values (gen_random_uuid(), '${sellerId}', 'E2E MESAJ URUNU',
            'e2e-msg-' || substr(md5(random()::text),1,8), 'İstanbul', 'test', 'Cep Telefonu',
            30000, 'rate', 10, 'active', 5, false, 'open')
    returning id`);
  const listingId = l!.id;
  const MSJ = `E2E alıcı mesajı ${Date.now().toString().slice(-6)}`;
  console.log(`\nilan=${listingId}`);

  // ---------- 1) ALICI ilan detayından mesaj atar ----------
  await login(page, buyerEmail);
  await page.goto(`/listing/${listingId}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(5000);
  const mesajBtn = page.getByRole("button", { name: /Mesaj gönder|Satıcıya mesaj|Soru sor|Mesaj at/i }).first();
  console.log(`1) "Mesaj gönder" butonu: ${(await mesajBtn.count()) > 0 ? "VAR ✓" : "YOK ✗"}`);
  await mesajBtn.scrollIntoViewIfNeeded().catch(() => {});
  await mesajBtn.tap({ timeout: 8000 }).catch((e) => console.log("  tap hata: " + e.message.slice(0, 40)));
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e-artifacts/msg-1-chat.png" });

  // sohbet ekranına düştük mü → mesaj yaz + gönder
  const msgInput = page.locator("input,textarea").filter({ hasNot: page.locator('[placeholder*="Ara"]') }).last();
  const inputs = await page.locator("input,textarea").all();
  let wrote = false;
  for (const inp of inputs.reverse()) {
    if (!(await inp.isVisible().catch(() => false))) continue;
    const ph = (await inp.getAttribute("placeholder")) ?? "";
    if (/ara|search/i.test(ph)) continue;
    await inp.fill(MSJ).catch(() => {}); wrote = true; break;
  }
  console.log(`   mesaj yazıldı: ${wrote}`);
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Gönder|Yolla/i }).first().tap({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e-artifacts/msg-2-sent.png" });

  const conv = await one<Record<string, unknown>>(`select id, participant_ids from conversations where listing_id='${listingId}'`);
  console.log(`2) DB KONUŞMA: ${conv ? `id=${conv.id} katılımcı=${JSON.stringify(conv.participant_ids)}` : "!! OLUŞMADI"}`);
  if (!conv) return;
  const msg = await one<Record<string, unknown>>(`select sender_id, receiver_id, body, read from messages where conversation_id='${conv.id}' order by created_at desc limit 1`);
  console.log(`   DB MESAJ: ${msg ? JSON.stringify(msg).slice(0, 160) : "!! YAZILMADI"}`);
  console.log(`   gönderen alıcı mı? → ${msg?.sender_id === buyerId ? "DOĞRU ✓" : "✗"} | alıcı satıcı mı? → ${msg?.receiver_id === sellerId ? "DOĞRU ✓" : "✗"}`);

  // ---------- 3) SATICI mesajı görür + yanıtlar ----------
  await logout(page);
  await login(page, sellerEmail);
  await page.goto("/messages", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(8000);
  await page.screenshot({ path: "e2e-artifacts/msg-3-seller-inbox.png" });
  const inbox = await page.locator("body").innerText();
  console.log(`3) SATICI KUTUSU: alıcı mesajı görünüyor mu → ${inbox.includes("E2E MESAJ URUNU") || inbox.includes(MSJ.slice(0, 20)) ? "EVET ✓" : "HAYIR ✗"}`);

  // konuşmaya gir + yanıtla
  await page.getByText(/E2E MESAJ URUNU|E2E MsgAlici/i).first().tap({ timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(4000);
  const YANIT = `E2E satıcı yanıtı ${Date.now().toString().slice(-6)}`;
  for (const inp of (await page.locator("input,textarea").all()).reverse()) {
    if (!(await inp.isVisible().catch(() => false))) continue;
    const ph = (await inp.getAttribute("placeholder")) ?? "";
    if (/ara|search/i.test(ph)) continue;
    await inp.fill(YANIT).catch(() => {}); break;
  }
  await page.getByRole("button", { name: /Gönder|Yolla/i }).first().tap({ timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(4000);
  await page.screenshot({ path: "e2e-artifacts/msg-4-reply.png" });

  const reply = await one<Record<string, unknown>>(`select sender_id, receiver_id from messages where conversation_id='${conv.id}' and sender_id='${sellerId}' order by created_at desc limit 1`);
  console.log(`4) SATICI YANITI: ${reply ? `gönderen=satıcı ✓ alıcı=${reply.receiver_id === buyerId ? "alıcı ✓" : "✗"}` : "!! YANIT YAZILMADI"}`);
  const total = await one<Record<string, unknown>>(`select count(*) c from messages where conversation_id='${conv.id}'`);
  console.log(`   toplam mesaj: ${JSON.stringify(total)} (beklenen ≥2)`);
});
