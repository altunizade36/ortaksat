/**
 * Hafif denetim/aktivite kaydı. `activity_logs` tablosuna best-effort yazar
 * (fire-and-forget). Hata olsa bile uygulama akışını ASLA bozmaz.
 * Gerçek IP edge tarafında; burada user-agent + uygulama bağlamı kaydedilir.
 */

import { supabase } from "@/lib/supabase";

export type AuditAction =
  | "sign_in"
  | "sign_up"
  | "sign_out"
  | "listing_create"
  | "listing_update"
  | "listing_status_change"
  | "message_send"
  | "report_create"
  | "report_resolve"
  | "partnership_apply"
  | "account_deletion_request";

function userAgent(): string | null {
  try {
    if (typeof navigator !== "undefined" && navigator.userAgent) return navigator.userAgent.slice(0, 300);
  } catch {
    // navigator yok (native)
  }
  return null;
}

/**
 * Aktiviteyi kaydet. `userId` verilirse (canlı UUID) ona bağlanır; yoksa anonim.
 * Beklenmesi gerekmez; await edilirse de hata fırlatmaz.
 */
export async function logActivity(
  action: AuditAction,
  opts: { userId?: string; entityType?: string; entityId?: string; metadata?: Record<string, unknown> } = {}
): Promise<void> {
  if (!supabase) return;
  try {
    await supabase.from("activity_logs").insert({
      user_id: opts.userId ?? null,
      action,
      entity_type: opts.entityType ?? null,
      entity_id: opts.entityId ?? null,
      user_agent: userAgent(),
      metadata: opts.metadata ?? {}
    });
  } catch {
    // sessiz: audit kaydı kritik akışı bozmamalı
  }
}
