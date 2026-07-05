/**
 * Güvenlik geçmişi: kullanıcının kendi activity_logs kayıtlarından giriş/oturum
 * olaylarını okur ve okunabilir hale getirir (tarayıcı, işletim sistemi, zaman).
 * IP kaydı edge tarafında tutulmadığı için burada gösterilmez; user_agent'tan
 * güvenli, yaklaşık tarayıcı/OS çıkarımı yapılır.
 */

import { supabase } from "@/lib/supabase";

export type LoginEvent = {
  id: string;
  action: string;
  browser: string;
  os: string;
  when: string; // ISO
  isCurrent: boolean;
};

const ACTION_LABEL: Record<string, string> = {
  sign_in: "Giriş yapıldı",
  sign_up: "Hesap oluşturuldu",
  sign_out: "Çıkış yapıldı",
  account_deletion_request: "Hesap silme talebi"
};

export function actionLabel(action: string): string {
  return ACTION_LABEL[action] ?? action;
}

/** user_agent'tan yaklaşık tarayıcı adı. */
export function parseBrowser(ua: string | null | undefined): string {
  const s = ua ?? "";
  if (!s) return "Bilinmeyen tarayıcı";
  if (/Edg\//.test(s)) return "Microsoft Edge";
  if (/OPR\/|Opera/.test(s)) return "Opera";
  if (/SamsungBrowser/.test(s)) return "Samsung Internet";
  if (/Chrome\//.test(s) && !/Chromium/.test(s)) return "Chrome";
  if (/Firefox\//.test(s)) return "Firefox";
  if (/Safari\//.test(s) && /Version\//.test(s)) return "Safari";
  if (/Expo|okhttp/.test(s)) return "Mobil uygulama";
  return "Tarayıcı";
}

/** user_agent'tan yaklaşık işletim sistemi. */
export function parseOS(ua: string | null | undefined): string {
  const s = ua ?? "";
  if (!s) return "Bilinmeyen cihaz";
  if (/iPhone|iPad|iPod/.test(s)) return "iOS";
  if (/Android/.test(s)) return "Android";
  if (/Windows NT 10/.test(s)) return "Windows";
  if (/Windows/.test(s)) return "Windows";
  if (/Mac OS X|Macintosh/.test(s)) return "macOS";
  if (/Linux/.test(s)) return "Linux";
  return "Cihaz";
}

/** Kullanıcının son giriş/oturum olaylarını getirir (en yeni önce). */
export async function fetchLoginHistory(userId: string, limit = 15): Promise<LoginEvent[]> {
  if (!supabase || !userId) return [];
  try {
    const { data, error } = await supabase
      .from("activity_logs")
      .select("id, action, user_agent, created_at")
      .eq("user_id", userId)
      .in("action", ["sign_in", "sign_up", "sign_out", "account_deletion_request"])
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    const currentUA = typeof navigator !== "undefined" ? navigator.userAgent : "";
    return data.map((row, idx) => ({
      id: String(row.id),
      action: row.action as string,
      browser: parseBrowser(row.user_agent as string | null),
      os: parseOS(row.user_agent as string | null),
      when: row.created_at as string,
      // En yeni sign_in ve aynı user-agent = bu cihaz (yaklaşık).
      isCurrent: idx === 0 && !!currentUA && (row.user_agent as string | null) === currentUA
    }));
  } catch {
    return [];
  }
}
