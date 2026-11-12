import type { Conversation } from "@/lib/types";

export type ConversationGroup = "buyers" | "sellers" | "partner";
/** Tabs describe the other participant, not a permanent role assigned to a user. */
export function conversationGroup(conversation: Conversation, userId: string): ConversationGroup {
  if (conversation.partnerId) return "partner";
  return conversation.sellerId === userId ? "buyers" : "sellers";
}

/**
 * Hiç mesaj yazılmamış "hayalet" konuşma mı?
 *
 * İlan/ortaklık ekranındaki "Mesaj" düğmesi, kullanıcı tek satır yazmadan da konuşma satırını
 * oluşturur. Karşı tarafın gelen kutusunda içi boş, önizlemesiz bir satır beliriyordu (ve geri
 * dönüp hiç yazmayan her ziyaretçi için bir tane daha). Boş konuşma, ilk mesaj gelene kadar
 * listede gösterilmez; doğrudan açılan (seçili) konuşma her zaman görünür.
 *
 * `lastMessageAt === createdAt` şartı güvenlik içindir: istemci yalnız son ~1000 mesajı tutar;
 * mesajı OLAN ama yerelde yüklenmemiş eski bir konuşma (lastMessageAt ilerlemiş) asla gizlenmez.
 *
 * O karşılaştırma SANİYEYE kırpılmış damgalarla yapılır; ilk mesaj çoğu akışta konuşmadan birkaç
 * yüz ms sonra yazıldığından iki damga aynı saniyeye düşer. Bu yüzden sunucunun HAM damgalarından
 * "mesajı var" bilgisi ayrıca tutulur (bkz. noteThreadActivity) ve o konuşma asla gizlenmez.
 */
export function isEmptyThread(conversation: Conversation, hasLocalMessages: boolean): boolean {
  return !hasLocalMessages && !threadsWithActivity.has(conversation.id) && conversation.lastMessageAt === conversation.createdAt;
}

// Sunucuda en az bir mesajı olduğu BİLİNEN konuşmalar (yalnız büyür; yanlış-pozitifin tek etkisi
// boş bir satırın listede görünmesidir). Kimlikler konuşmaya özgü UUID'dir → hesaplar arası sızmaz.
const threadsWithActivity = new Set<string>();

/**
 * Konuşma satırı sunucudan okunurken çağrılır: `last_message_at`, `created_at`'ten FARKLIYSA
 * (ham, mikrosaniye hassasiyetli metinler) konuşmaya mesaj yazılmıştır.
 */
export function noteThreadActivity(conversationId: string | null | undefined, lastMessageAtRaw: unknown, createdAtRaw: unknown): void {
  if (!conversationId) return;
  if (typeof lastMessageAtRaw === "string" && typeof createdAtRaw === "string" && lastMessageAtRaw !== createdAtRaw) threadsWithActivity.add(conversationId);
}

/** Sunucudan bu konuşmaya ait bir MESAJ satırı görüldü (realtime). */
export function noteThreadHasMessages(conversationId: string | null | undefined): void {
  if (conversationId) threadsWithActivity.add(conversationId);
}

