import { test } from "@playwright/test";
import { createConfirmedUser, uniqueEmail, apiSignInToken, restInsertAsUser, runSql } from "./helpers/supabase-admin";
const PW = "GucluSifre123!";
test("Kullanıcı kendi kategori önerisini havuza yazabiliyor (RLS + kolon uyumu)", async () => {
  const email = uniqueEmail("sugins");
  const uid = await createConfirmedUser(email, PW, "E2E SugIns");
  const token = await apiSignInToken(email, PW);
  const path = `E2E TEST YOLU ${Date.now().toString().slice(-6)}`;
  const r = await restInsertAsUser(token!, "category_suggestions", {
    id: crypto.randomUUID(), user_id: uid, suggested_path: `Emlak › Diğer → ${path}`,
    note: "E2E: kullanıcı Diğer'i seçti", status: "pending"
  });
  console.log(`INSERT: ok=${r.ok} status=${r.status} ${r.ok ? "" : r.body.slice(0, 120)}`);
  const row = await runSql<Array<Record<string, unknown>>>(`select suggested_path, status from category_suggestions where suggested_path ilike '%${path}%'`);
  console.log(`DB'DE: ${row.length ? JSON.stringify(row[0]) : "YOK ✗"}`);
});
