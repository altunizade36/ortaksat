import { serverSendBlockReason } from "@/lib/live-service";

// Sunucunun (private.guard_messaging_sender) verdiği iletiler — AYNEN.
export const SEND_BLOCK_SUSPENDED = "Hesabın askıda olduğu için mesaj gönderemezsin.";
export const SEND_BLOCK_CHAT_LIMIT = "Çok kısa sürede çok fazla yeni sohbet başlattın. Biraz sonra tekrar dene.";

/**
 * Bu sohbette mesaj NEDEN gönderilemiyor? (askıdaki hesap / saatlik yeni sohbet sınırı / geçersiz ek)
 *
 * Sunucu bu durumlarda açık bir Türkçe ileti döndürür; veri katmanı (lib/live-service.ts) o iletiyi sohbet
 * bazında saklar. Bu kanca saklanan GERÇEK sunucu iletisini döndürür — sunucudaki denetimi istemcide
 * yeniden hesaplamaz, bu yüzden sunucu kuralı değişince burası değişmek zorunda kalmaz.
 *
 *  - `suspended` (store.isSuspended) doğruysa hemen "askıda" iletisi.
 *  - Aksi halde yalnız bu sohbette BAŞARISIZ mesaj varken sunucunun son ret iletisi (yoksa null).
 */
export function useSendBlockReason({ conversationId, failedCount, suspended }: {
  meId?: string | undefined;
  conversationId: string | undefined;
  sellerId?: string | undefined;
  failedCount: number;
  suspended: boolean;
}): string | null {
  if (suspended) return SEND_BLOCK_SUSPENDED;
  if (failedCount <= 0) return null;
  return serverSendBlockReason(conversationId);
}
