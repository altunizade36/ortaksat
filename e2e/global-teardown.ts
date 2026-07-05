import { cleanupAllE2E } from "./helpers/supabase-admin";

/** Test sonrası: oluşturulan TÜM e2e test verisini canlı DB'den sil. */
export default async function globalTeardown() {
  try {
    const r = await cleanupAllE2E();
    console.log(`[global-teardown] e2e test verisi silindi: ${r.users} kullanıcı, ${r.listings} ilan`);
  } catch (e) {
    console.log("[global-teardown] TEMİZLİK HATASI (elle temizle gerekebilir):", (e as Error).message);
  }
}
