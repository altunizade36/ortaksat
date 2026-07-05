import { cleanupAllE2E, resetAuthRateLimits } from "./helpers/supabase-admin";

/** Test öncesi: önceki koşulardan kalan e2e verisini + auth hız-sınırlarını temizle. */
export default async function globalSetup() {
  try {
    const r = await cleanupAllE2E();
    await resetAuthRateLimits();
    console.log(`[global-setup] temizlendi: ${r.users} kullanıcı, ${r.listings} ilan + auth rate-limit sıfırlandı`);
  } catch (e) {
    console.log("[global-setup] temizlik atlandı:", (e as Error).message);
  }
}
