/**
 * Bildirim zaman damgası ayrıştırma.
 *
 * Bildirimlerin `createdAt` alanı İKİ biçimde gelir:
 *   - hesap-özeti / yenileme / iyimser kopya: tam ISO ("2026-11-12T10:30:00.12+00:00")
 *   - realtime (data/app-store): "YYYY-MM-DD HH:MM" (UTC damgasının İLK 16 karakteri,
 *     saat dilimi bilgisi KESİLMİŞ).
 * İkincisini `new Date(...)` ile okumak: Chrome'da YEREL saat sayılır (TR'de 3 saat ileri,
 * "az önce" hiç bitmez), Safari/Hermes'te ise Invalid Date ("Invalid Date" yazısı, yanlış gün
 * grubu). Bu yardımcı saat dilimsiz biçimi UTC olarak okur.
 */
const NAIVE = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})(?::(\d{2}(?:\.\d+)?))?$/;

export function notificationDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const m = NAIVE.exec(raw.trim());
  const d = m ? new Date(`${m[1]}T${m[2]}:${m[3] ?? "00"}Z`) : new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Sıralama için epoch-ms (ayrıştırılamazsa 0). */
export function notificationMs(raw: string | undefined | null): number {
  return notificationDate(raw)?.getTime() ?? 0;
}

/** Yerel takvim gününe göre grup: bugün / dün / son 7 gün / daha eski. */
export function notificationDayBucket(raw: string | undefined | null): "today" | "yesterday" | "week" | "older" {
  const d = notificationDate(raw);
  if (!d) return "older";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfThatDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const ago = Math.round((startOfToday - startOfThatDay) / 86400000);
  if (ago <= 0) return "today";
  if (ago === 1) return "yesterday";
  return ago < 7 ? "week" : "older";
}

/** "12 Kas 14:05" / "Nov 12, 14:05". Intl'e bağlı değil (Hermes'te tr-TR eksik olabiliyor). */
export function notificationDateTime(raw: string | undefined | null, language: "tr" | "en" = "tr"): string {
  const d = notificationDate(raw);
  if (!d) return "";
  const months = language === "en"
    ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    : ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];
  const p = (n: number) => String(n).padStart(2, "0");
  const year = d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : "";
  const time = `${p(d.getHours())}:${p(d.getMinutes())}`;
  return language === "en" ? `${months[d.getMonth()]} ${d.getDate()}${year}, ${time}` : `${d.getDate()} ${months[d.getMonth()]}${year} ${time}`;
}
