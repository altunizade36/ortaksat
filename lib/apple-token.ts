import { Platform } from "react-native";

import { supabase } from "@/lib/supabase";

/**
 * "Apple ile giriş" belirteç yönetimi (sunucu: supabase/functions/apple-token). App Store kuralı 5.1.1(v):
 * hesap silinirken Apple bağlantısı Apple tarafında iptal edilmeli.
 * İkisi de ASLA hata fırlatmaz ve giriş / silme akışını bekletmez (en çok birkaç saniye).
 */
export async function storeAppleAuthorizationCode(code: string | null | undefined): Promise<void> {
  if (Platform.OS !== "ios" || !code || !supabase) return;
  try { await supabase.functions.invoke("apple-token", { body: { action: "store", code } }); } catch { /* yoksay */ }
}

const REVOKE_WAIT_MS = 5000;
export async function revokeAppleToken(): Promise<void> {
  const client = supabase;
  if (!client) return;
  try {
    await Promise.race([
      client.functions.invoke("apple-token", { body: { action: "revoke" } }).catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, REVOKE_WAIT_MS))
    ]);
  } catch { /* yoksay */ }
}
