/**
 * E2E test yardımcıları — Supabase Management API (SQL) üzerinden test hesaplarını
 * doğrular (e-posta onayı) ve test sonunda TÜM test verisini temizler.
 * Canlı DB'ye yazıyoruz; bu yüzden her test hesabı `e2e_` ön ekiyle işaretlenir ve
 * temizlik bu ön eki hedefler (gerçek kullanıcı/ilan asla silinmez).
 */

// .env.e2e'yi (gitignored) kendi başına yükle — global setup/teardown config dışında da çalışsın.
import * as fs from "fs";
import * as path from "path";
(() => {
  const p = path.join(process.cwd(), ".env.e2e");
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
})();

const MGMT = process.env.E2E_SUPABASE_MGMT || "";
const REF = process.env.E2E_PROJECT_REF || "akyzzdwbzgsnhdircuce";
const SUPA_URL = process.env.E2E_SUPABASE_URL || "https://akyzzdwbzgsnhdircuce.supabase.co";
const ANON = process.env.E2E_SUPABASE_ANON || "";

export const E2E_PREFIX = "e2e_";
export const E2E_LISTING_TAG = "[E2E-TEST]"; // ilan başlıklarına eklenir, temizlikte hedeflenir

/** Management API ile ham SQL çalıştırır (service_role gerektirmez). */
export async function runSql<T = unknown>(query: string): Promise<T> {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${MGMT}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query })
  });
  if (!res.ok) throw new Error(`SQL failed ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return (await res.json()) as T;
}

function esc(s: string): string {
  return s.replace(/'/g, "''");
}

/** Public signup endpoint (anon key) ile hesap oluşturur — UI'ı atlar, hazırlık içindir. */
export async function apiSignUp(email: string, password: string, fullName: string): Promise<void> {
  const res = await fetch(`${SUPA_URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, data: { full_name: fullName } })
  });
  if (!res.ok) throw new Error(`signup failed ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** Test kullanıcısının e-postasını onaylar (OTP okumaya gerek kalmadan giriş yapılabilsin). */
export async function confirmUser(email: string): Promise<void> {
  // confirmed_at generated bir kolon (email_confirmed_at'ten türer) — sadece onu set et.
  await runSql(
    `update auth.users set email_confirmed_at = now()
     where email = '${esc(email.toLowerCase())}';`
  );
}

/** Onaylı test hesabını DOĞRUDAN SQL ile oluşturur — GoTrue signup/email hız
 * sınırını (rapid test'te tetiklenen "Çok sık denendi") tamamen atlar. bcrypt
 * (pgcrypto) parola GoTrue girişiyle uyumludur; on_auth_user_created trigger'ı
 * profiles satırını otomatik açar. Token kolonları '' set edilir (NULL→string
 * giriş bug'ını önler). */
export async function createConfirmedUser(email: string, password: string, fullName: string): Promise<string> {
  const e = esc(email.toLowerCase());
  const rows = await runSql<Array<{ id: string }>>(`
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, email_change, email_change_token_new, recovery_token
    ) values (
      '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
      '${e}', crypt('${esc(password)}', gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"full_name":"${esc(fullName)}"}'::jsonb, now(), now(),
      '', '', '', ''
    )
    returning id;
  `);
  const id = rows[0]?.id;
  if (!id) throw new Error(`createConfirmedUser: kullanıcı oluşturulamadı (${email})`);
  return id;
}

/** Bir e-postanın kullanıcı id'sini döndürür (yoksa null). */
export async function getUserId(email: string): Promise<string | null> {
  const rows = await runSql<Array<{ id: string }>>(
    `select id from auth.users where email = '${esc(email.toLowerCase())}' limit 1;`
  );
  return rows[0]?.id ?? null;
}

/** TÜM e2e test verisini canlı DB'den siler. Sadece e2e_ hesapları ve [E2E-TEST] ilanları.
 * NO ACTION olan FK'ler (commissions, orders) önce elle temizlenir; sonra ilanlar; en son
 * auth.users (profiles→listings→bağlılar cascade). Gerçek veri asla etkilenmez. */
export async function cleanupAllE2E(): Promise<{ users: number; listings: number }> {
  const targetListings = `(
    select id from listings
    where title like '%${E2E_LISTING_TAG}%'
       or owner_id in (select id from auth.users where email like '${E2E_PREFIX}%')
  )`;
  const del = await runSql<Array<Record<string, unknown>>>(`
    delete from commissions where listing_id in ${targetListings};
    delete from orders where listing_id in ${targetListings};
    with tl as (delete from listings where id in ${targetListings} returning id),
         tu as (delete from auth.users where email like '${E2E_PREFIX}%' returning id)
    select (select count(*) from tl) as listings, (select count(*) from tu) as users;
  `);
  const last = Array.isArray(del) ? (del[del.length - 1] as { users?: number; listings?: number }) : {};
  const row = (last || {}) as { users?: number; listings?: number };
  return { users: Number(row.users || 0), listings: Number(row.listings || 0) };
}

/** Satıcı + alıcı + ilan + konuşma + birkaç mesajlı tam senaryo kurar (mesajlaşma UI testi için). */
export async function seedConversation(sellerId: string, buyerId: string): Promise<{ listingId: string; conversationId: string }> {
  const lr = await runSql<Array<{ id: string }>>(`
    insert into listings (owner_id, title, slug, description, price, commission_type, commission_value, category, location, status, partnership_mode, currency)
    values ('${sellerId}', 'E2E Mesaj Koltuk ${E2E_LISTING_TAG}', 'e2e-msg-${Date.now()}', 'E2E mesaj testi ürünü koltuk takımı temiz konforlu.', 8500, 'rate', 10, 'Ev & Yaşam', 'İstanbul', 'active', 'open', 'TRY')
    returning id;`);
  const listingId = lr[0].id;
  const cr = await runSql<Array<{ id: string }>>(`
    insert into conversations (id, listing_id, seller_id, buyer_id, participant_ids, status, last_message_at, created_at)
    values (gen_random_uuid(), '${listingId}', '${sellerId}', '${buyerId}', ARRAY['${sellerId}','${buyerId}']::uuid[], 'open', now(), now())
    returning id;`);
  const conversationId = cr[0].id;
  const lines = [
    { s: buyerId, r: sellerId, b: "Merhaba, bu koltuk takımı hâlâ mevcut mu?" },
    { s: sellerId, r: buyerId, b: "Merhaba! Evet, stokta mevcut. Size nasıl yardımcı olabilirim?" },
    { s: buyerId, r: sellerId, b: "Fiyatta biraz esneklik var mı? Ayrıca teslimat nasıl oluyor?" },
    { s: sellerId, r: buyerId, b: "Fiyat ilanda güncel. Teslimatı kargo veya elden ayarlayabiliriz." },
    { s: buyerId, r: sellerId, b: "Harika, düşünüp size döneceğim. Teşekkürler!" }
  ];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i];
    await runSql(`insert into messages (id, listing_id, sender_id, receiver_id, body, read, conversation_id, created_at)
      values (gen_random_uuid(), '${listingId}','${m.s}','${m.r}','${esc(m.b)}', ${i < lines.length - 1}, '${conversationId}', now() + interval '${i} second');`);
  }
  return { listingId, conversationId };
}

/** Auth hız-sınırı sayaçlarını sıfırlar (test tekrar edilebilir olsun).
 * Güvenli: gerçek trafik yokken auth rate-limit satırları yalnızca testlerden gelir. */
export async function resetAuthRateLimits(): Promise<void> {
  await runSql(
    `delete from rate_limits where action in ('signup','signin','password_reset');`
  );
}

/** Benzersiz test e-postası üretir. */
export function uniqueEmail(tag: string): string {
  const stamp = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;
  return `${E2E_PREFIX}${tag}_${stamp}@ortaksat-e2e.com`;
}
