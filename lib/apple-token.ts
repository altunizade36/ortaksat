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

/**
 * Web + Android (tarayıcı yönlendirmesi): giriş servisi Apple yenileme belirtecini YALNIZ dönüş anında verir.
 * `identities` içinde en son kullanılan kimlik Apple ise saklanır (Google ile girişte Google belirteci gönderilmez).
 */
export async function storeAppleWebRefreshToken(
  refreshToken: string | null | undefined,
  identities: Array<{ provider?: string; last_sign_in_at?: string | null }> | null | undefined
): Promise<void> {
  if (!refreshToken || !supabase) return;
  const latest = [...(identities ?? [])].sort((a, b) => (b.last_sign_in_at ?? "").localeCompare(a.last_sign_in_at ?? ""))[0];
  if (latest?.provider !== "apple") return;
  try { await supabase.functions.invoke("apple-token", { body: { action: "store_token", refresh_token: refreshToken } }); } catch { /* yoksay */ }
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
