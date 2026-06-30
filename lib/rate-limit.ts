/**
 * İki katmanlı hız sınırlama:
 *  1) İstemci tarafı (anında, ağ gerektirmez) — aynı cihazdan hızlı tekrar denemeleri engeller.
 *  2) Sunucu tarafı (Supabase RPC `check_rate_limit`) — gerçek koruma; kullanıcı/aksiyon bazında sayar.
 * Edge/gerçek IP limiti Supabase tarafında ayrıca yapılandırılır.
 */

import { supabase } from "@/lib/supabase";

type Action = "listing_create" | "message_send" | "signup" | "signin" | "password_reset" | "support_ticket" | "report";

const POLICY: Record<Action, { max: number; windowSeconds: number }> = {
  listing_create: { max: 8, windowSeconds: 3600 },
  message_send: { max: 30, windowSeconds: 60 },
  signup: { max: 5, windowSeconds: 3600 },
  signin: { max: 8, windowSeconds: 300 },
  password_reset: { max: 4, windowSeconds: 3600 },
  support_ticket: { max: 5, windowSeconds: 3600 },
  report: { max: 12, windowSeconds: 3600 }
};

// İstemci içi hafıza (uygulama açıkken). Cihaz yeniden başlarsa sıfırlanır; asıl koruma sunucuda.
const clientHits: Record<string, number[]> = {};

function clientAllows(action: Action): boolean {
  const { max, windowSeconds } = POLICY[action];
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  const hits = (clientHits[action] ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    clientHits[action] = hits;
    return false;
  }
  hits.push(now);
  clientHits[action] = hits;
  return true;
}

export type RateLimitResult = { allowed: boolean; reason?: string };

const BLOCK_MESSAGE = "Çok sık denediniz. Lütfen birkaç dakika sonra tekrar deneyin.";

/**
 * Bir aksiyona izin var mı? Önce istemci, sonra (varsa) sunucu sayacını kontrol eder.
 * Sunucu erişilemezse istemci kararıyla devam eder (fail-open, ama istemci yine sınırlar).
 */
export async function rateLimit(action: Action): Promise<RateLimitResult> {
  if (!clientAllows(action)) {
    return { allowed: false, reason: BLOCK_MESSAGE };
  }

  if (supabase) {
    try {
      const { max, windowSeconds } = POLICY[action];
      const { data, error } = await supabase.rpc("check_rate_limit", {
        p_action: action,
        p_max_count: max,
        p_window_seconds: windowSeconds
      });
      if (!error && data === false) {
        return { allowed: false, reason: BLOCK_MESSAGE };
      }
    } catch {
      // Sunucu sayacı yoksa/erişilemezse istemci kararıyla devam.
    }
  }

  return { allowed: true };
}
